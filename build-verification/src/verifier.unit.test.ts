import { Buffer } from "node:buffer";
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import {
  buildContractCodeLedgerKey,
  buildContractInstanceLedgerKey,
  NetworkConfig,
  StrKey,
} from "@colibri/core";
import type { RpcLedgerEntriesClient } from "@colibri/core";
import * as E from "@/error.ts";
import { sha256Hex } from "@/hash.ts";
import {
  ContractBuildVerifier,
  createVerificationLedgerEntries,
  verifyContractBuild,
  writeVerificationEvidence,
} from "@/verifier.ts";
import type {
  ContainerImagePolicy,
  ContractBuildRunner,
  ContractBuildRunnerInput,
  ContractBuildRunnerOutput,
  ContractBuildVerificationEvidence,
  ContractMetadataEntry,
} from "@/types.ts";

const encoder = new TextEncoder();
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await Deno.remove(directory, { recursive: true });
  }
});

const uleb = (value: number): number[] => {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return bytes;
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const wasm = (entries: readonly ContractMetadataEntry[] = []): Uint8Array => {
  const base = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  if (entries.length === 0) return base;
  const name = encoder.encode("contractmetav0");
  const body = concat(
    new Uint8Array([...uleb(name.length), ...name]),
    ...entries.map(({ key, value }) =>
      new Uint8Array(
        xdr.ScMetaEntry.scMetaV0(new xdr.ScMetaV0({ key, val: value })).toXDR(),
      )
    ),
  );
  return concat(base, new Uint8Array([0, ...uleb(body.length), ...body]));
};

const tar = (): Uint8Array => {
  const header = new Uint8Array(512);
  header.set(encoder.encode("source/file.txt"), 0);
  header.set(encoder.encode("0000644\0"), 100);
  header.set(encoder.encode("00000000001\0"), 124);
  header[156] = "0".charCodeAt(0);
  return concat(header, encoder.encode("x"), new Uint8Array(511 + 1024));
};

class RecordingRunner implements ContractBuildRunner {
  input?: ContractBuildRunnerInput;
  constructor(readonly output: ContractBuildRunnerOutput) {}
  run(input: ContractBuildRunnerInput): Promise<ContractBuildRunnerOutput> {
    this.input = input;
    return Promise.resolve(this.output);
  }
}

const manifestFixture = async () => {
  const bytes = encoder.encode(
    JSON.stringify({ mediaType: "application/vnd.oci.image.manifest.v1+json" }),
  );
  const digest = await sha256Hex(bytes);
  return {
    image: `docker.io/stellar/stellar-cli@sha256:${digest}`,
    fetcher: () => Promise.resolve(new Response(Uint8Array.from(bytes))),
  };
};

const output = (rebuilt: Uint8Array): ContractBuildRunnerOutput => ({
  wasm: rebuilt,
  artifactPath: "/source/target/wasm32v1-none/release/example.wasm",
  stdout: "built",
  stderr: "",
  durationMs: 12,
});

describe("ContractBuildVerifier", () => {
  it("completes strict SEP-58 verification with authoritative evidence", async () => {
    const archive = tar();
    const sourceSha256 = await sha256Hex(archive);
    const manifest = await manifestFixture();
    const target = wasm([
      { key: "cliver", value: "27" },
      { key: "bldimg", value: manifest.image },
      { key: "source_sha256", value: sourceSha256 },
    ]);
    const runner = new RecordingRunner(output(target));
    const result = await verifyContractBuild({
      target: { wasm: target, label: "fixture" },
      source: { type: "archive", name: "source.tar", bytes: archive },
    }, {
      network: { networkConfig: NetworkConfig.TestNet() },
      runner,
      fetch: manifest.fetcher,
    });
    assertEquals(result.status, "verified");
    if (result.status !== "verified") throw new Error("unreachable");
    assertEquals(result.evidence.recipeProvenance, "onChainSep58Metadata");
    assertEquals(result.evidence.target.label, "fixture");
    assertEquals(result.evidence.source.sha256, sourceSha256);
    assertEquals(result.evidence.network, {
      networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      rpcUrl: NetworkConfig.TestNet().rpcUrl,
    });
    assertEquals(result.evidence.build.networkEnabled, false);
    assertEquals(runner.input?.allowNetwork, false);
  });

  it("records granular RPC URL network evidence for raw targets", async () => {
    const directory = await Deno.makeTempDir();
    temporaryDirectories.push(directory);
    const manifest = await manifestFixture();
    const target = wasm();
    const result = await verifyContractBuild({
      mode: "outOfBand",
      target: { wasm: target },
      source: { type: "path", path: directory },
      recipe: { image: manifest.image },
    }, {
      network: {
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "granular network",
      },
      runner: new RecordingRunner(output(target)),
      fetch: manifest.fetcher,
    });
    assertEquals(result.status, "verified");
    if (result.status === "verified") {
      assertEquals(result.evidence.network, {
        networkPassphrase: "granular network",
        rpcUrl: "https://rpc.example.com",
      });
    }
  });

  it("reports mismatched bytes only after a completed build", async () => {
    const directory = await Deno.makeTempDir();
    temporaryDirectories.push(directory);
    const manifest = await manifestFixture();
    const target = wasm();
    const result = await verifyContractBuild({
      mode: "outOfBand",
      target: { wasm: target },
      source: { type: "path", path: directory },
      recipe: { image: manifest.image },
    }, {
      runner: new RecordingRunner(output(new Uint8Array([...target, 0]))),
      fetch: manifest.fetcher,
      allowBuildNetwork: true,
      network: {
        rpc: {
          getLedgerEntries: () =>
            Promise.resolve({ entries: [], latestLedger: 1 }),
        },
        networkPassphrase: "evidence network",
      },
    });
    assertEquals(result.status, "mismatch");
    if (result.status !== "mismatch") throw new Error("unreachable");
    assertEquals(result.evidence.recipeProvenance, "callerSupplied");
    assertEquals(result.evidence.network, {
      networkPassphrase: "evidence network",
      rpcUrl: undefined,
    });
    assertEquals(result.evidence.build.networkEnabled, true);
  });

  it("returns notApplicable for targets without SEP-58 metadata", async () => {
    const result = await verifyContractBuild({ target: { wasm: wasm() } });
    assertEquals(result, {
      status: "notApplicable",
      reason: "missingSep58Metadata",
      targetWasmHash: await sha256Hex(wasm()),
    });
  });

  it("validates constructor limits and network alternatives", () => {
    assertThrows(
      () => new ContractBuildVerifier({ limits: { timeoutMs: 0 } }),
      E.InvalidVerifierOptionsError,
    );
    assertThrows(() =>
      new ContractBuildVerifier({
        network: {
          rpcUrl: "http://localhost",
          rpc: {
            getLedgerEntries: () =>
              Promise.resolve({ entries: [], latestLedger: 1 }),
          },
          networkPassphrase: "x",
        } as never,
      }), E.InvalidVerifierOptionsError);
    assertThrows(
      () =>
        new ContractBuildVerifier({
          network: { rpcUrl: "http://localhost" } as never,
        }),
      E.InvalidVerifierOptionsError,
    );
    assertEquals(
      createVerificationLedgerEntries({
        networkConfig: NetworkConfig.TestNet(),
      }).rpc instanceof Object,
      true,
    );
    assertEquals(
      createVerificationLedgerEntries({
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "network",
      }).rpc instanceof Object,
      true,
    );
  });

  it("requires network inputs for a deployed target", async () => {
    await assertRejects(
      () => verifyContractBuild({ target: { wasmHash: "a".repeat(64) } }),
      E.MissingTargetNetworkError,
    );
  });

  it("wraps target RPC initialization failures", async () => {
    const networkConfig = NetworkConfig.CustomNet({
      networkPassphrase: "custom",
    });
    await assertRejects(
      () =>
        verifyContractBuild({ target: { wasmHash: "a".repeat(64) } }, {
          network: { networkConfig },
        }),
      E.TargetRpcInitializationFailedError,
    );
  });

  it("wraps wasm-hash and contract-id RPC failures independently", async () => {
    const rpc: RpcLedgerEntriesClient = {
      getLedgerEntries: () => Promise.reject(new Error("offline")),
    };
    const options = { network: { rpc, networkPassphrase: "network" } as const };
    await assertRejects(
      () =>
        verifyContractBuild({ target: { wasmHash: "a".repeat(64) } }, options),
      E.TargetResolutionFailedError,
    );
    const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
    await assertRejects(
      () => verifyContractBuild({ target: { contractId } }, options),
      E.TargetResolutionFailedError,
    );
  });

  it("returns notApplicable for a Stellar Asset Contract instance", async () => {
    const contractId = StrKey.encodeContract(Buffer.alloc(32, 2));
    const key = buildContractInstanceLedgerKey({ contractId });
    const val = xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        ext: new xdr.ExtensionPoint(0),
        contract: Address.fromString(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
        val: xdr.ScVal.scvContractInstance(
          new xdr.ScContractInstance({
            executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
            storage: [],
          }),
        ),
      }),
    );
    const rpc: RpcLedgerEntriesClient = {
      getLedgerEntries: () =>
        Promise.resolve({
          entries: [{ key, val } as unknown as Api.LedgerEntryResult],
          latestLedger: 1,
        }),
    };
    assertEquals(
      await verifyContractBuild({ target: { contractId } }, {
        network: { rpc, networkPassphrase: "network" },
      }),
      { status: "notApplicable", reason: "stellarAssetContract" },
    );
  });

  it("resolves contract code and wasm-hash targets through an RPC client", async () => {
    const targetWasm = wasm();
    const hash = await sha256Hex(targetWasm);
    const contractId = StrKey.encodeContract(Buffer.alloc(32, 3));
    const instanceKey = buildContractInstanceLedgerKey({ contractId });
    const codeKey = buildContractCodeLedgerKey({ hash });
    const instanceVal = xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        ext: new xdr.ExtensionPoint(0),
        contract: Address.fromString(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
        val: xdr.ScVal.scvContractInstance(
          new xdr.ScContractInstance({
            executable: xdr.ContractExecutable.contractExecutableWasm(
              Buffer.from(hash, "hex"),
            ),
            storage: [],
          }),
        ),
      }),
    );
    const codeVal = xdr.LedgerEntryData.contractCode(
      new xdr.ContractCodeEntry({
        ext: new xdr.ContractCodeEntryExt(0),
        hash: Buffer.from(hash, "hex"),
        code: Buffer.from(targetWasm),
      }),
    );
    const byKey = new Map([
      [instanceKey.toXDR("base64"), {
        key: instanceKey,
        val: instanceVal,
        lastModifiedLedgerSeq: 2,
      }],
      [codeKey.toXDR("base64"), {
        key: codeKey,
        val: codeVal,
        lastModifiedLedgerSeq: 3,
      }],
    ]);
    const rpc: RpcLedgerEntriesClient = {
      getLedgerEntries: (...keys) =>
        Promise.resolve({
          entries: keys.flatMap((key) => {
            const found = byKey.get(key.toXDR("base64"));
            return found ? [found] : [];
          }),
          latestLedger: 4,
        }),
    };
    const options = { network: { rpc, networkPassphrase: "network" } as const };
    assertEquals(
      (await verifyContractBuild({ target: { contractId } }, options)).status,
      "notApplicable",
    );
    assertEquals(
      (await verifyContractBuild({ target: { wasmHash: hash } }, options))
        .status,
      "notApplicable",
    );
  });

  it("wraps a contract-code lookup failure after resolving its instance", async () => {
    const contractId = StrKey.encodeContract(Buffer.alloc(32, 4));
    const hash = "a".repeat(64);
    const key = buildContractInstanceLedgerKey({ contractId });
    const val = xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        ext: new xdr.ExtensionPoint(0),
        contract: Address.fromString(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
        val: xdr.ScVal.scvContractInstance(
          new xdr.ScContractInstance({
            executable: xdr.ContractExecutable.contractExecutableWasm(
              Buffer.from(hash, "hex"),
            ),
            storage: [],
          }),
        ),
      }),
    );
    let calls = 0;
    const rpc: RpcLedgerEntriesClient = {
      getLedgerEntries: () => {
        calls += 1;
        return calls === 1
          ? Promise.resolve({
            entries: [{ key, val } as never],
            latestLedger: 1,
          })
          : Promise.reject(new Error("code lookup failed"));
      },
    };
    await assertRejects(() =>
      verifyContractBuild({ target: { contractId } }, {
        network: { rpc, networkPassphrase: "network" },
      }), E.TargetResolutionFailedError);
  });

  it("requires an out-of-band recipe even for untyped JavaScript callers", async () => {
    await assertRejects(
      () =>
        verifyContractBuild(
          {
            mode: "outOfBand",
            target: { wasm: wasm() },
            source: { type: "path", path: "." },
          } as never,
        ),
      E.MissingOutOfBandRecipeError,
    );
  });

  it("wraps an untyped custom image-policy failure", async () => {
    const directory = await Deno.makeTempDir();
    temporaryDirectories.push(directory);
    const manifest = await manifestFixture();
    const policy: ContainerImagePolicy = {
      validate: () => {
        throw new Error("declined");
      },
    };
    await assertRejects(
      () =>
        verifyContractBuild({
          mode: "outOfBand",
          target: { wasm: wasm() },
          source: { type: "path", path: directory },
          recipe: { image: manifest.image },
        }, { imagePolicy: policy, fetch: manifest.fetcher }),
      E.ImagePolicyRejectedError,
    );

    const stringPolicy: ContainerImagePolicy = {
      validate: () => {
        throw "declined";
      },
    };
    await assertRejects(
      () =>
        verifyContractBuild({
          mode: "outOfBand",
          target: { wasm: wasm() },
          source: { type: "path", path: directory },
          recipe: { image: manifest.image },
        }, { imagePolicy: stringPolicy, fetch: manifest.fetcher }),
      E.ImagePolicyRejectedError,
    );

    const typed = new E.ImagePolicyRejectedError(manifest.image, "typed");
    const typedPolicy: ContainerImagePolicy = {
      validate: () => {
        throw typed;
      },
    };
    const caught = await assertRejects(
      () =>
        verifyContractBuild({
          mode: "outOfBand",
          target: { wasm: wasm() },
          source: { type: "path", path: directory },
          recipe: { image: manifest.image },
        }, { imagePolicy: typedPolicy, fetch: manifest.fetcher }),
      E.ImagePolicyRejectedError,
    );
    assertEquals(caught, typed);
  });

  it("writes evidence and wraps filesystem failures", async () => {
    const directory = await Deno.makeTempDir();
    temporaryDirectories.push(directory);
    const path = `${directory}/evidence.json`;
    const evidence = { mode: "outOfBand" } as ContractBuildVerificationEvidence;
    await writeVerificationEvidence(path, evidence);
    assertEquals(JSON.parse(await Deno.readTextFile(path)).mode, "outOfBand");
    await assertRejects(
      () => writeVerificationEvidence(directory, evidence),
      E.EvidenceWriteFailedError,
    );
  });
});
