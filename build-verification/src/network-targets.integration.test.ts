import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Buffer } from "node:buffer";
import {
  Contract,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  StellarAssetContract,
  type TransactionConfig,
} from "@colibri/core";
import { xdr } from "stellar-sdk";
import { StellarTestLedger } from "@colibri/test-tooling";
import { EXECUTABLE_REF_MANAGER_SPEC } from "colibri-internal/tests/specs/executable-ref-manager.ts";
import type { VerificationNetwork } from "@/core/index.ts";
import { DefaultVerificationTargetResolver } from "@/providers/target/default.ts";
import type { VerificationTarget } from "@/core/index.ts";
import { ContractBuildVerifier } from "@/verifier/index.ts";

const { afterAll, beforeAll, describe, it, observer: suiteObserver } =
  recordColibriTests(import.meta.url);

const FIXTURE_ROOT = new URL(
  "../../_internal/build-verification/fixtures/",
  import.meta.url,
);
const V1_HASH =
  "5fdf963895895d6f9420b737172087489681eb45725a6bea32b5802a0f17907e";
const V2_HASH =
  "bb32277027fa9a4370b907cd33fbd6aea48ed8864e6e87ca3643c8f5e4c1c136";
const EXTERNAL_REF_TAG = "stable";

type LocalNetwork = {
  readonly rpcUrl: string;
  readonly horizonUrl: string;
  readonly friendbotUrl: string;
  readonly networkPassphrase: string;
  readonly allowHttp: true;
};

const ledger = new StellarTestLedger({
  containerName: `colibri-build-verification-${crypto.randomUUID()}`,
  containerImageVersion: "latest",
  logLevel: "silent",
});
const account = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const transactionConfig: TransactionConfig = {
  fee: "1000000",
  timeout: 60,
  source: account.address(),
  signers: [account.signer()],
};
let network: LocalNetwork;
let networkConfig: ReturnType<typeof NetworkConfig.CustomNet>;
let sourceArchive: Uint8Array;
let v1Wasm: Uint8Array;
let executableRefManagerWasm: Uint8Array;
let v1WasmHash: string;
let v2WasmHash: string;
let contractId: string;
let sacContractId: string;
let executableRefManager: Contract;

const strictSource = () => ({
  type: "archive" as const,
  bytes: sourceArchive,
  name: "upgradeable-source.tar.gz",
});

const verifier = (networkInput?: VerificationNetwork): ContractBuildVerifier =>
  new ContractBuildVerifier({
    network: networkInput,
    allowBuildNetwork: true,
    limits: { timeoutMs: 5 * 60 * 1000 },
  });

// Target resolution tests use real RPC state without rebuilding the same Rust
// archive for every equivalent input. Two full verifier calls below still build
// both revisions in isolated containers, including a post-upgrade network target.
async function resolveTarget(
  target: VerificationTarget,
  input?: VerificationNetwork,
) {
  const resolved = await new DefaultVerificationTargetResolver(input).resolve({
    target,
  });
  if (resolved.applicability !== "wasm") {
    throw new Error("Expected Wasm target");
  }
  return resolved;
}
const granularNetwork = () => ({
  rpcUrl: network.rpcUrl,
  networkPassphrase: network.networkPassphrase,
  allowHttp: true,
} as const);

describe("Quickstart build-verification targets", disableSanitizeConfig, () => {
  beforeAll(async () => {
    const [v1, v2, archive, manager] = await Promise.all([
      Deno.readFile(new URL("upgradeable-v1.wasm", FIXTURE_ROOT)),
      Deno.readFile(new URL("upgradeable-v2.wasm", FIXTURE_ROOT)),
      Deno.readFile(new URL("upgradeable-source.tar.gz", FIXTURE_ROOT)),
      Deno.readFile(
        new URL(
          "../../_internal/tests/compiled-contracts/executable_ref_manager_contract.wasm",
          import.meta.url,
        ),
      ),
    ]);
    v1Wasm = v1;
    executableRefManagerWasm = manager;
    sourceArchive = archive;
    await ledger.start();
    network = await ledger.getNetworkDetails() as LocalNetwork;
    networkConfig = NetworkConfig.CustomNet(network);
    await initializeWithFriendbot(
      network.friendbotUrl,
      account.address(),
      { rpcUrl: network.rpcUrl, allowHttp: true },
    );

    const v1Contract = suiteObserver.attach(
      new Contract({
        networkConfig,
        contractConfig: { wasm: Buffer.from(v1) },
      }),
      { name: "v1Contract" },
    );
    await v1Contract.uploadWasm(transactionConfig);
    v1WasmHash = v1Contract.getWasmHash();
    await v1Contract.deploy({ config: transactionConfig });
    contractId = v1Contract.getContractId();

    const v2Contract = suiteObserver.attach(
      new Contract({
        networkConfig,
        contractConfig: { wasm: Buffer.from(v2) },
      }),
      { name: "v2Contract" },
    );
    await v2Contract.uploadWasm(transactionConfig);
    v2WasmHash = v2Contract.getWasmHash();

    executableRefManager = suiteObserver.attach(
      new Contract({
        networkConfig,
        contractConfig: {
          wasm: executableRefManagerWasm,
          spec: EXECUTABLE_REF_MANAGER_SPEC,
        },
      }),
      { name: "executableRefManager" },
    );
    await executableRefManager.uploadWasm(transactionConfig);
    await executableRefManager.deploy({ config: transactionConfig });

    sacContractId = (await StellarAssetContract.deploy({
      code: "BLDVERIFY",
      issuer: account.address(),
      networkConfig,
      config: transactionConfig,
    })).contractId;
  });

  afterAll(async () => {
    await ledger.stop();
    await ledger.destroy();
  });

  it("resolves bytes, hash and contract forms and rebuilds revision one", async () => {
    assertEquals(v1WasmHash, V1_HASH);
    assertEquals(v2WasmHash, V2_HASH);

    // These independent reads can share the ledger and run concurrently.
    const [direct, byHash, byContractGranular] = await Promise.all([
      resolveTarget({ wasm: v1Wasm, label: "direct fixture bytes" }),
      resolveTarget({ wasmHash: v1WasmHash }, { networkConfig }),
      resolveTarget({ contractId }, granularNetwork()),
    ]);
    assertEquals(direct.kind, "wasm");
    assertEquals(direct.wasmHash, V1_HASH);
    assertEquals(byHash.kind, "wasmHash");
    assertEquals(byHash.lastModifiedLedgerSeq !== undefined, true);
    assertEquals(byHash.wasm, v1Wasm);
    assertEquals(byContractGranular.wasmHash, V1_HASH);
    assertEquals(byContractGranular.wasm, v1Wasm);

    const byContractConfig = await verifier({ networkConfig }).verify({
      target: { contractId },
      source: strictSource(),
    });
    assertEquals(byContractConfig.status, "verified");
    assertEquals(byContractConfig.evidence.target?.wasmHash, V1_HASH);
    assertEquals(byContractConfig.evidence.network?.input, "networkConfig");
  });

  it("rebuilds the upgraded contract and still resolves its previous Wasm hash", async () => {
    const deployed = suiteObserver.attach(
      new Contract({
        networkConfig,
        contractConfig: { contractId },
      }),
      { name: "deployed" },
    );
    await deployed.loadSpecFromNetwork();
    assertEquals(await deployed.read({ method: "version" }), 1);
    await deployed.invoke({
      method: "upgrade",
      methodArgs: { new_wasm_hash: Buffer.from(v2WasmHash, "hex") },
      config: transactionConfig,
    });
    assertEquals(await deployed.read({ method: "version" }), 2);

    const upgraded = await verifier(granularNetwork()).verify({
      target: { contractId },
      source: strictSource(),
    });
    assertEquals(upgraded.status, "verified");
    assertEquals(upgraded.evidence.target?.wasmHash, V2_HASH);

    const oldHash = await resolveTarget({ wasmHash: v1WasmHash }, {
      networkConfig,
    });
    assertEquals(oldHash.wasmHash, V1_HASH);
    assertEquals(oldHash.wasm, v1Wasm);
  });

  it("resolves contract instances and external references through reference upgrades", async () => {
    await executableRefManager.invoke({
      method: "set",
      methodArgs: {
        tag: EXTERNAL_REF_TAG,
        wasm_hash: xdr.decodeBytes(v1WasmHash, "hex"),
      },
      config: transactionConfig,
    });
    const externalRef = {
      owner: executableRefManager.getContractId(),
      tag: EXTERNAL_REF_TAG,
    } as const;
    const externalContract = suiteObserver.attach(
      new Contract({
        networkConfig,
        contractConfig: { externalRef },
      }),
      { name: "externalContract" },
    );
    await externalContract.loadSpecFromNetwork();
    await externalContract.deploy({ config: transactionConfig });
    assertEquals(await externalContract.read({ method: "version" }), 1);

    const byExternalContract = await resolveTarget(
      { contractId: externalContract.getContractId() },
      { networkConfig },
    );
    assertEquals(byExternalContract.wasmHash, V1_HASH);
    assertEquals(byExternalContract.wasm, v1Wasm);
    assertEquals(
      byExternalContract.externalReference?.executableOwner,
      executableRefManager.getContractId(),
    );
    assertEquals(
      byExternalContract.externalReference?.tag,
      { encoding: "base64", value: "c3RhYmxl" },
    );
    assertEquals(
      byExternalContract.externalReference?.instance !==
        undefined,
      true,
    );
    assertEquals(
      byExternalContract.externalReference?.reference !==
        undefined,
      true,
    );

    await executableRefManager.invoke({
      method: "set",
      methodArgs: {
        tag: EXTERNAL_REF_TAG,
        wasm_hash: xdr.decodeBytes(v2WasmHash, "hex"),
      },
      config: transactionConfig,
    });
    await externalContract.loadSpecFromNetwork();
    assertEquals(await externalContract.read({ method: "version" }), 2);

    const byExternalRef = await resolveTarget({ externalRef }, {
      networkConfig,
    });
    assertEquals(byExternalRef.kind, "externalRef");
    assertEquals(byExternalRef.wasmHash, V2_HASH);
    assertEquals(
      byExternalRef.externalReference?.instance,
      undefined,
    );
    assertEquals(
      byExternalRef.externalReference?.reference !== undefined,
      true,
    );
  });

  it("short-circuits Stellar asset contracts without starting a build", async () => {
    const beforeSac = Date.now();
    const sac = await verifier({ networkConfig }).verify({
      target: { contractId: sacContractId },
    });
    assertEquals(sac.status, "notApplicable");
    if (sac.status === "notApplicable") {
      assertEquals(sac.reason, "stellarAssetContract");
    }
    assertEquals(sac.evidence.execution, undefined);
    assertEquals(Date.now() - beforeSac < 30_000, true);
  });
});
