import { Buffer } from "node:buffer";
import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import {
  buildContractCodeLedgerKey,
  buildContractDataLedgerKey,
  buildContractInstanceLedgerKey,
  NetworkConfig,
  StrKey,
} from "@colibri/core";
import type { RpcLedgerEntriesClient } from "@colibri/core";
import type { ContractId } from "@colibri/core";
import { sha256Hex } from "@/core/comparison/index.ts";
import { InvalidVerifierOptionsError } from "@/error/core.ts";
import { TEST_NOW, testWasm } from "@/testing.test.ts";
import { DefaultVerificationTargetResolver } from "@/providers/target/default.ts";
import {
  createVerificationLedgerEntries,
  normalizeVerificationNetwork,
  StellarVerificationTargetResolver,
} from "@/providers/target/stellar.ts";
import {
  MissingTargetNetworkError,
  TargetCodeLookupFailedError,
  TargetExternalReferenceLookupFailedError,
  TargetHashMismatchError,
  TargetInstanceLookupFailedError,
  TargetProviderUnexpectedError,
  TargetRpcInitializationFailedError,
} from "@/providers/target/error.ts";

const contractId = (fill: number): string =>
  StrKey.encodeContract(Buffer.alloc(32, fill));

const instanceEntry = (
  id: string,
  executable: xdr.ContractExecutable,
): { key: xdr.LedgerKey; val: xdr.LedgerEntryData } => ({
  key: buildContractInstanceLedgerKey({
    contractId: id as ContractId,
  }) as unknown as xdr.LedgerKey,
  val: xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: xdr.ExtensionPoint.v0(),
      contract: Address.fromString(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
      val: xdr.ScVal.scvContractInstance(
        new xdr.ScContractInstance({ executable, storage: [] }),
      ),
    }),
  ),
});

const codeEntry = (
  hash: string,
  wasm: Uint8Array,
): { key: xdr.LedgerKey; val: xdr.LedgerEntryData } => ({
  key: buildContractCodeLedgerKey({ hash }) as unknown as xdr.LedgerKey,
  val: xdr.LedgerEntryData.contractCode(
    new xdr.ContractCodeEntry({
      ext: xdr.ContractCodeEntryExt.v0(),
      hash: Buffer.from(hash, "hex"),
      code: Buffer.from(wasm),
    }),
  ),
});

const externalReferenceEntry = (
  owner: string,
  tag: Uint8Array,
  hash: string,
): { key: xdr.LedgerKey; val: xdr.LedgerEntryData } => {
  const tagValue = xdr.ScVal.scvExecutableTag(new xdr.XdrString(tag));
  return {
    key: buildContractDataLedgerKey({
      contractId: owner as ContractId,
      key: tagValue,
    }) as unknown as xdr.LedgerKey,
    val: xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        ext: xdr.ExtensionPoint.v0(),
        contract: Address.fromString(owner).toScAddress(),
        key: tagValue,
        durability: xdr.ContractDataDurability.persistent,
        val: xdr.ScVal.scvBytes(Buffer.from(hash, "hex")),
      }),
    ),
  };
};

const rpcFromEntries = (
  entries: readonly { key: xdr.LedgerKey; val: xdr.LedgerEntryData }[],
): RpcLedgerEntriesClient => {
  const byKey = new Map(entries.map((entry, index) => [
    entry.key.toXdr("base64") as string,
    { ...entry, lastModifiedLedgerSeq: index + 2 },
  ]));
  return {
    getLedgerEntries: (...keys) =>
      Promise.resolve({
        entries: keys.flatMap((key) => {
          const entry = byKey.get(key.toXdr("base64") as string);
          return entry ? [entry as unknown as Api.LedgerEntryResult] : [];
        }),
        latestLedger: 10,
      }),
  };
};

describe("verification target providers", () => {
  it("normalizes each exclusive Colibri or granular network input once", () => {
    const config = normalizeVerificationNetwork({
      networkConfig: NetworkConfig.TestNet(),
    });
    assertEquals(config.evidence.input, "networkConfig");
    assertEquals(config.evidence.rpcUrl, NetworkConfig.TestNet().rpcUrl);
    const rpc = rpcFromEntries([]);
    const existing = normalizeVerificationNetwork({
      rpc,
      networkPassphrase: "existing",
    });
    assertEquals(existing.evidence, {
      input: "rpc",
      networkPassphrase: "existing",
      rpcUrl: undefined,
      allowHttp: false,
    });
    const granular = normalizeVerificationNetwork({
      rpcUrl: "http://127.0.0.1:8000/rpc",
      networkPassphrase: "granular",
      allowHttp: true,
    });
    assertEquals(granular.evidence.input, "rpcUrl");
    assertEquals(granular.evidence.allowHttp, true);
    assertEquals(
      createVerificationLedgerEntries({
        rpc,
        networkPassphrase: "existing",
      }).rpc,
      rpc,
    );
    assertEquals(
      normalizeVerificationNetwork({
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "default-http-policy",
      }).evidence.allowHttp,
      false,
    );
    assertEquals(
      normalizeVerificationNetwork({
        networkConfig: {
          rpcUrl: "https://rpc.example.com",
          networkPassphrase: "config-without-http-policy",
        } as NetworkConfig,
      }).evidence.allowHttp,
      false,
    );
    assertEquals(
      createVerificationLedgerEntries({
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "direct-ledger-reader",
      }).rpc !== undefined,
      true,
    );
  });

  it("rejects conflicting, incomplete, and unconstructable network inputs", () => {
    assertThrows(
      () =>
        normalizeVerificationNetwork({
          rpc: rpcFromEntries([]),
          rpcUrl: "https://example.com",
          networkPassphrase: "x",
        } as never),
      InvalidVerifierOptionsError,
    );
    assertThrows(
      () =>
        normalizeVerificationNetwork(
          { rpcUrl: "https://example.com" } as never,
        ),
      InvalidVerifierOptionsError,
    );
    assertThrows(
      () =>
        normalizeVerificationNetwork({
          networkConfig: NetworkConfig.CustomNet({
            networkPassphrase: "custom",
          }),
        }),
      TargetRpcInitializationFailedError,
    );

    let reads = 0;
    const typedFailure = new InvalidVerifierOptionsError(
      "typed getter failure",
    );
    const network = {
      get networkConfig() {
        reads += 1;
        if (reads >= 4) throw typedFailure;
        return NetworkConfig.TestNet();
      },
    };
    assertStrictEquals(
      assertThrows(
        () => normalizeVerificationNetwork(network as never),
        InvalidVerifierOptionsError,
      ),
      typedFailure,
    );
  });

  it("resolves direct Wasm locally and copies mutable caller bytes", async () => {
    const wasm = testWasm();
    const resolver = new DefaultVerificationTargetResolver(
      undefined,
      () => TEST_NOW,
    );
    const result = await resolver.resolve({
      target: { wasm, label: "fixture" },
    });
    wasm[0] = 1;
    assertEquals(result.applicability, "wasm");
    if (result.applicability !== "wasm") throw new Error("unreachable");
    assertEquals(result.wasm[0], 0);
    assertEquals(result.wasmHash, await sha256Hex(testWasm()));
    assertEquals(result.observedAt, TEST_NOW);

    const systemClockResult = await new DefaultVerificationTargetResolver()
      .resolve({ target: { wasm: testWasm() } });
    assertEquals(Number.isNaN(Date.parse(systemClockResult.observedAt)), false);
  });

  it("requires a network and rejects direct Wasm on the Stellar-only resolver", async () => {
    await assertRejects(
      () =>
        new StellarVerificationTargetResolver().resolve({
          target: { wasmHash: "a".repeat(64) },
        }),
      MissingTargetNetworkError,
    );
    await assertRejects(
      () =>
        new StellarVerificationTargetResolver().resolve({
          target: { wasm: testWasm() },
        }),
      TargetProviderUnexpectedError,
    );
  });

  it("resolves Wasm-hash and contract-id targets with exact ledger facts", async () => {
    const wasm = testWasm();
    const hash = await sha256Hex(wasm);
    const id = contractId(1);
    const rpc = rpcFromEntries([
      instanceEntry(
        id,
        xdr.ContractExecutable.contractExecutableWasm(Buffer.from(hash, "hex")),
      ),
      codeEntry(hash, wasm),
    ]);
    const normalized = normalizeVerificationNetwork({
      rpc,
      networkPassphrase: "network",
    });
    const resolver = new StellarVerificationTargetResolver(
      normalized,
      () => TEST_NOW,
    );
    const byHash = await resolver.resolve({ target: { wasmHash: hash } });
    assertEquals(byHash.applicability, "wasm");
    assertEquals(byHash.kind, "wasmHash");
    const systemClock = await new StellarVerificationTargetResolver(normalized)
      .resolve({ target: { wasmHash: hash } });
    assertEquals(Number.isNaN(Date.parse(systemClock.observedAt)), false);
    const byId = await resolver.resolve({ target: { contractId: id } });
    assertEquals(byId.applicability, "wasm");
    assertEquals(byId.kind, "contractId");
    if (byId.applicability === "wasm") {
      assertEquals(byId.contractId, id);
      assertEquals(byId.observedAt, TEST_NOW);
    }
    const routed = new DefaultVerificationTargetResolver(
      normalized,
      () => TEST_NOW,
    );
    assertEquals(
      (await routed.resolve({ target: { contractId: id } })).kind,
      "contractId",
    );
    const routedFromPublicNetwork = new DefaultVerificationTargetResolver({
      rpc,
      networkPassphrase: "network",
    }, () => TEST_NOW);
    assertEquals(
      (await routedFromPublicNetwork.resolve({ target: { wasmHash: hash } }))
        .kind,
      "wasmHash",
    );
  });

  it("classifies Stellar Asset Contract executables without code lookup", async () => {
    const id = contractId(2);
    const resolver = new StellarVerificationTargetResolver(
      normalizeVerificationNetwork({
        rpc: rpcFromEntries([
          instanceEntry(
            id,
            xdr.ContractExecutable.contractExecutableStellarAsset(),
          ),
        ]),
        networkPassphrase: "network",
      }),
      () => TEST_NOW,
    );
    assertEquals(await resolver.resolve({ target: { contractId: id } }), {
      applicability: "stellarAssetContract",
      kind: "contractId",
      label: undefined,
      contractId: id,
      lastModifiedLedgerSeq: 2,
      observedAt: TEST_NOW,
    });
  });

  it("resolves contract-id and direct CAP-85 references with observation evidence", async () => {
    const id = contractId(20);
    const owner = contractId(21);
    const tag = new Uint8Array([0x66, 0x6c, 0x65, 0x65, 0xff]);
    const wasm = testWasm();
    const hash = await sha256Hex(wasm);
    const resolver = new StellarVerificationTargetResolver(
      normalizeVerificationNetwork({
        rpc: rpcFromEntries([
          instanceEntry(
            id,
            xdr.ContractExecutable.contractExecutableExternalRef(
              new xdr.ContractExecutableExternalRef({
                executableOwner: Address.fromString(owner).toScAddress(),
                tag,
              }),
            ),
          ),
          externalReferenceEntry(owner, tag, hash),
          codeEntry(hash, wasm),
        ]),
        networkPassphrase: "network",
      }),
      () => TEST_NOW,
    );

    const byContract = await resolver.resolve({ target: { contractId: id } });
    assertEquals(byContract.applicability, "wasm");
    if (byContract.applicability !== "wasm") throw new Error("unreachable");
    assertEquals(byContract.kind, "contractId");
    assertEquals(byContract.wasmHash, hash);
    assertEquals(byContract.externalReference, {
      executableOwner: owner,
      tag: { encoding: "base64", value: xdr.encodeBytes(tag, "base64") },
      instance: { observedAtLedger: 10, lastModifiedLedgerSeq: 2 },
      reference: { observedAtLedger: 10, lastModifiedLedgerSeq: 3 },
    });

    const direct = await resolver.resolve({
      target: { externalRef: { owner, tag }, label: "release slot" },
    });
    assertEquals(direct.applicability, "wasm");
    if (direct.applicability !== "wasm") throw new Error("unreachable");
    assertEquals(direct.kind, "externalRef");
    assertEquals(direct.contractId, undefined);
    assertEquals(direct.label, "release slot");
    assertEquals(direct.externalReference?.instance, undefined);
    assertEquals(direct.externalReference?.reference, {
      observedAtLedger: 10,
      lastModifiedLedgerSeq: 3,
    });
  });

  it("keeps external-reference lookup failures distinct", async () => {
    const owner = contractId(22);
    const resolver = new StellarVerificationTargetResolver(
      normalizeVerificationNetwork({
        rpc: rpcFromEntries([]),
        networkPassphrase: "network",
      }),
    );

    await assertRejects(
      () =>
        resolver.resolve({
          target: { externalRef: { owner, tag: "missing" } },
        }),
      TargetExternalReferenceLookupFailedError,
    );

    const id = contractId(23);
    const tag = new Uint8Array([1, 2, 3]);
    const byContract = new StellarVerificationTargetResolver(
      normalizeVerificationNetwork({
        rpc: rpcFromEntries([
          instanceEntry(
            id,
            xdr.ContractExecutable.contractExecutableExternalRef(
              new xdr.ContractExecutableExternalRef({
                executableOwner: Address.fromString(owner).toScAddress(),
                tag,
              }),
            ),
          ),
        ]),
        networkPassphrase: "network",
      }),
    );
    await assertRejects(
      () => byContract.resolve({ target: { contractId: id } }),
      TargetExternalReferenceLookupFailedError,
    );

    const missingCode = new StellarVerificationTargetResolver(
      normalizeVerificationNetwork({
        rpc: rpcFromEntries([
          externalReferenceEntry(owner, tag, "a".repeat(64)),
        ]),
        networkPassphrase: "network",
      }),
    );
    await assertRejects(
      () =>
        missingCode.resolve({
          target: { externalRef: { owner, tag } },
        }),
      TargetCodeLookupFailedError,
    );
  });

  it("rejects an impossible SAC result for a direct external reference", async () => {
    const owner = contractId(24);
    const resolver = new StellarVerificationTargetResolver({
      ledgerEntries: {
        resolveContractExecutable: () =>
          Promise.resolve({
            contractId: owner,
            executable: { type: "stellarAsset" },
            instance: { observedAtLedger: 1 },
          }),
      } as never,
      evidence: {
        networkPassphrase: "network",
        input: "rpc",
        allowHttp: false,
      },
    });

    await assertRejects(
      () =>
        resolver.resolve({
          target: { externalRef: { owner, tag: "stable" } },
        }),
      TargetProviderUnexpectedError,
    );
  });

  it("keeps instance and code lookup failures unique", async () => {
    const offline: RpcLedgerEntriesClient = {
      getLedgerEntries: () => Promise.reject(new Error("offline")),
    };
    const resolver = new StellarVerificationTargetResolver(
      normalizeVerificationNetwork({
        rpc: offline,
        networkPassphrase: "network",
      }),
    );
    await assertRejects(
      () => resolver.resolve({ target: { contractId: contractId(3) } }),
      TargetInstanceLookupFailedError,
    );
    await assertRejects(
      () => resolver.resolve({ target: { wasmHash: "a".repeat(64) } }),
      TargetCodeLookupFailedError,
    );

    const id = contractId(4);
    const hash = "b".repeat(64);
    let calls = 0;
    const codeOffline: RpcLedgerEntriesClient = {
      getLedgerEntries: () => {
        calls += 1;
        return calls === 1
          ? Promise.resolve({
            entries: [instanceEntry(
              id,
              xdr.ContractExecutable.contractExecutableWasm(
                Buffer.from(hash, "hex"),
              ),
            ) as unknown as Api.LedgerEntryResult],
            latestLedger: 1,
          })
          : Promise.reject(new Error("code offline"));
      },
    };
    await assertRejects(
      () =>
        new StellarVerificationTargetResolver(
          normalizeVerificationNetwork({
            rpc: codeOffline,
            networkPassphrase: "network",
          }),
        ).resolve({ target: { contractId: id } }),
      TargetCodeLookupFailedError,
    );
  });

  it("rejects ledger code whose observed hash differs from the target", async () => {
    const requested = "c".repeat(64);
    const returned = "d".repeat(64);
    const ledger = {
      contractCode: () =>
        Promise.resolve({
          hash: returned,
          code: testWasm(),
          lastModifiedLedgerSeq: 1,
        }),
      contractInstance: () => Promise.reject(new Error("unused")),
    };
    const resolver = new StellarVerificationTargetResolver({
      ledgerEntries: ledger as never,
      evidence: {
        networkPassphrase: "network",
        input: "rpc",
        allowHttp: false,
      },
    });
    await assertRejects(
      () => resolver.resolve({ target: { wasmHash: requested } }),
      TargetHashMismatchError,
    );

    const id = contractId(5);
    const contractResolver = new StellarVerificationTargetResolver({
      ledgerEntries: {
        resolveContractExecutable: () =>
          Promise.resolve({
            executable: { type: "wasm", wasmHash: requested },
            resolvedWasmHash: requested,
            instance: {
              observedAtLedger: 1,
              lastModifiedLedgerSeq: 1,
            },
          }),
        contractCode: () =>
          Promise.resolve({
            hash: returned,
            code: testWasm(),
            lastModifiedLedgerSeq: 2,
          }),
      } as never,
      evidence: {
        networkPassphrase: "network",
        input: "rpc",
        allowHttp: false,
      },
    });
    await assertRejects(
      () => contractResolver.resolve({ target: { contractId: id } }),
      TargetHashMismatchError,
    );
  });
});
