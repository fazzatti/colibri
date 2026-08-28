import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
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
import { StellarTestLedger } from "../../test-tooling/mod.ts";
import { ContractBuildVerifier, type VerificationNetwork } from "../mod.ts";

const FIXTURE_ROOT = new URL(
  "../../_internal/build-verification/fixtures/",
  import.meta.url,
);
const V1_HASH =
  "3abb668393605a6f711a82a282bdadec5d9a61a5aa4f7808d32a704839bf40bd";
const V2_HASH =
  "243831b6473ef3fe61d3563cbd07d09947369b98d34c514854389efc7a1df721";

type LocalNetwork = {
  readonly rpcUrl: string;
  readonly horizonUrl: string;
  readonly friendbotUrl: string;
  readonly networkPassphrase: string;
  readonly allowHttp: true;
};

const ledger = new StellarTestLedger({
  containerName: "colibri-build-verification-quickstart",
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
let v1WasmHash: string;
let v2WasmHash: string;
let contractId: string;
let sacContractId: string;

const strictSource = () => ({
  type: "archive" as const,
  bytes: sourceArchive,
  name: "upgradeable-source.tar",
});

const verifier = (networkInput?: VerificationNetwork): ContractBuildVerifier =>
  new ContractBuildVerifier({
    network: networkInput,
    allowBuildNetwork: true,
    limits: { timeoutMs: 5 * 60 * 1000 },
  });

beforeAll(async () => {
  const [v1, v2, archive] = await Promise.all([
    Deno.readFile(new URL("upgradeable-v1.wasm", FIXTURE_ROOT)),
    Deno.readFile(new URL("upgradeable-v2.wasm", FIXTURE_ROOT)),
    Deno.readFile(new URL("upgradeable-source.tar", FIXTURE_ROOT)),
  ]);
  v1Wasm = v1;
  sourceArchive = archive;
  await ledger.start();
  network = await ledger.getNetworkDetails() as LocalNetwork;
  networkConfig = NetworkConfig.CustomNet(network);
  await initializeWithFriendbot(
    network.friendbotUrl,
    account.address(),
    { rpcUrl: network.rpcUrl, allowHttp: true },
  );

  const v1Contract = new Contract({
    networkConfig,
    contractConfig: { wasm: Buffer.from(v1) },
  });
  await v1Contract.uploadWasm(transactionConfig);
  v1WasmHash = v1Contract.getWasmHash();
  await v1Contract.deploy({ config: transactionConfig });
  contractId = v1Contract.getContractId();

  const v2Contract = new Contract({
    networkConfig,
    contractConfig: { wasm: Buffer.from(v2) },
  });
  await v2Contract.uploadWasm(transactionConfig);
  v2WasmHash = v2Contract.getWasmHash();

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

describe("Quickstart build-verification targets", disableSanitizeConfig, () => {
  it("resolves every target shape, tracks upgrades, and short-circuits SACs", async () => {
    assertEquals(v1WasmHash, V1_HASH);
    assertEquals(v2WasmHash, V2_HASH);

    const direct = await verifier().verify({
      target: { wasm: v1Wasm, label: "direct fixture bytes" },
      source: strictSource(),
    });
    assertEquals(direct.status, "verified");
    assertEquals(direct.evidence.target?.kind, "wasm");

    const byHash = await verifier({ networkConfig }).verify({
      target: { wasmHash: v1WasmHash },
      source: strictSource(),
    });
    assertEquals(byHash.status, "verified");
    assertEquals(byHash.evidence.target?.kind, "wasmHash");
    assertEquals(
      byHash.evidence.target?.lastModifiedLedgerSeq !== undefined,
      true,
    );

    const byContractConfig = await verifier({ networkConfig }).verify({
      target: { contractId },
      source: strictSource(),
    });
    assertEquals(byContractConfig.status, "verified");
    assertEquals(byContractConfig.evidence.target?.wasmHash, V1_HASH);
    assertEquals(byContractConfig.evidence.network?.input, "networkConfig");

    const granularNetwork = {
      rpcUrl: network.rpcUrl,
      networkPassphrase: network.networkPassphrase,
      allowHttp: true,
    } as const;
    const byContractGranular = await verifier(granularNetwork).verify({
      target: { contractId },
      source: strictSource(),
    });
    assertEquals(byContractGranular.status, "verified");
    assertEquals(byContractGranular.evidence.target?.wasmHash, V1_HASH);
    assertEquals(byContractGranular.evidence.network?.input, "rpcUrl");

    const deployed = new Contract({
      networkConfig,
      contractConfig: { contractId },
    });
    await deployed.loadSpecFromDeployedContract();
    assertEquals(await deployed.read({ method: "version" }), 1);
    await deployed.invoke({
      method: "upgrade",
      methodArgs: { new_wasm_hash: Buffer.from(v2WasmHash, "hex") },
      config: transactionConfig,
    });
    assertEquals(await deployed.read({ method: "version" }), 2);

    const upgraded = await verifier(granularNetwork).verify({
      target: { contractId },
      source: strictSource(),
    });
    assertEquals(upgraded.status, "verified");
    assertEquals(upgraded.evidence.target?.wasmHash, V2_HASH);

    const oldHash = await verifier({ networkConfig }).verify({
      target: { wasmHash: v1WasmHash },
      source: strictSource(),
    });
    assertEquals(oldHash.status, "verified");
    assertEquals(oldHash.evidence.target?.wasmHash, V1_HASH);

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
