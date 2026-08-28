import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Buffer } from "node:buffer";
import {
  Contract,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import { ContractBuildVerifier } from "../mod.ts";

const FIXTURE_ROOT = new URL(
  "../../_internal/build-verification/fixtures/",
  import.meta.url,
);
const V1_HASH =
  "3abb668393605a6f711a82a282bdadec5d9a61a5aa4f7808d32a704839bf40bd";
const networkConfig = NetworkConfig.TestNet();
const account = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const transactionConfig: TransactionConfig = {
  fee: "1000000",
  timeout: 60,
  source: account.address(),
  signers: [account.signer()],
};
let sourceArchive: Uint8Array;
let wasmHash: string;
let contractId: string;

const source = () => ({
  type: "archive" as const,
  bytes: sourceArchive,
  name: "upgradeable-source.tar",
});

beforeAll(async () => {
  const [wasm, archive] = await Promise.all([
    Deno.readFile(new URL("upgradeable-v1.wasm", FIXTURE_ROOT)),
    Deno.readFile(new URL("upgradeable-source.tar", FIXTURE_ROOT)),
  ]);
  sourceArchive = archive;
  await initializeWithFriendbot(
    networkConfig.friendbotUrl,
    account.address(),
    { rpcUrl: networkConfig.rpcUrl, allowHttp: false },
  );

  const contract = new Contract({
    networkConfig,
    contractConfig: { wasm: Buffer.from(wasm) },
  });
  await contract.uploadWasm(transactionConfig);
  wasmHash = contract.getWasmHash();
  await contract.deploy({ config: transactionConfig });
  contractId = contract.getContractId();
});

describe(
  "Testnet build-verification conformance",
  disableSanitizeConfig,
  () => {
    it("deploys an ephemeral fixture and verifies NetworkConfig and granular target resolution", async () => {
      assertEquals(wasmHash, V1_HASH);
      const byContract = await new ContractBuildVerifier({
        network: { networkConfig },
        allowBuildNetwork: true,
        limits: { timeoutMs: 5 * 60 * 1000 },
      }).verify({
        target: { contractId },
        source: source(),
      });
      assertEquals(byContract.status, "verified");
      assertEquals(byContract.evidence.network?.input, "networkConfig");
      assertEquals(byContract.evidence.target?.wasmHash, V1_HASH);
      assertEquals(byContract.evidence.execution?.networkEnabled, true);

      const byHash = await new ContractBuildVerifier({
        network: {
          rpcUrl: networkConfig.rpcUrl,
          networkPassphrase: networkConfig.networkPassphrase,
        },
        allowBuildNetwork: true,
        limits: { timeoutMs: 5 * 60 * 1000 },
      }).verify({
        target: { wasmHash },
        source: source(),
      });
      assertEquals(byHash.status, "verified");
      assertEquals(byHash.evidence.network?.input, "rpcUrl");
      assertEquals(byHash.evidence.target?.kind, "wasmHash");
      assertEquals(byHash.evidence.artifact?.sha256, V1_HASH);
    });
  },
);
