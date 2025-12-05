import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
} from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Contract } from "@/contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import { StrKey } from "@/strkeys/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { calculateContractId } from "@/common/helpers/calculate-contract-id.ts";

// Salts must be 32 bytes (64 hex characters)
const SALT_A = Buffer.from(
  "0000000000000000000000000000000000000000000000000000000000000001",
  "hex"
);
const SALT_B = Buffer.from(
  "0000000000000000000000000000000000000000000000000000000000000002",
  "hex"
);
const SALT_C = Buffer.from(
  "0000000000000000000000000000000000000000000000000000000000000003",
  "hex"
);

describe("[Testnet] Contract Salt Deployment", disableSanitizeConfig, () => {
  const networkConfig = NetworkConfig.TestNet();

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

  const config: TransactionConfig = {
    fee: "10000000", // 1 XLM
    timeout: 30,
    source: admin.address(),
    signers: [admin.signer()],
  };

  let wasmHash: string;

  beforeAll(async () => {
    await initializeWithFriendbot(networkConfig.friendbotUrl, admin.address());

    // Upload the wasm once for all salt tests
    const wasm = await loadWasmFile(
      "./_internal/tests/compiled-contracts/types_harness.wasm"
    );

    const contract = new Contract({
      networkConfig,
      contractConfig: {
        wasm: wasm,
      },
    });

    await contract.uploadWasm(config);
    wasmHash = contract.getWasmHash() as string;
  });

  describe("Deployment with predefined salt", () => {
    it("deploys contract with SALT_A and returns expected contract ID", async () => {
      // Calculate expected contract ID before deployment
      const expectedContractId = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_A
      );

      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract.deploy({
        config: config,
        salt: SALT_A,
      });

      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      const contractId = contract.getContractId();
      assertEquals(contractId, expectedContractId);
    });

    it("deploys contract with SALT_B and returns expected contract ID", async () => {
      // Calculate expected contract ID before deployment
      const expectedContractId = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_B
      );

      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract.deploy({
        config: config,
        salt: SALT_B,
      });

      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      const contractId = contract.getContractId();
      assertEquals(contractId, expectedContractId);
    });

    it("deploys contract with SALT_C and returns expected contract ID", async () => {
      // Calculate expected contract ID before deployment
      const expectedContractId = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_C
      );

      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract.deploy({
        config: config,
        salt: SALT_C,
      });

      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      const contractId = contract.getContractId();
      assertEquals(contractId, expectedContractId);
    });

    it("different salts produce different contract IDs", () => {
      const expectedContractIdA = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_A
      );
      const expectedContractIdB = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_B
      );
      const expectedContractIdC = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_C
      );

      // All three should be different
      assertNotEquals(expectedContractIdA, expectedContractIdB);
      assertNotEquals(expectedContractIdB, expectedContractIdC);
      assertNotEquals(expectedContractIdA, expectedContractIdC);
    });
  });

  describe("Deployment with random salt (no salt provided)", () => {
    it("deploys contract without salt and returns a random contract ID", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract.deploy({
        config: config,
      });

      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      const contractId1 = contract.getContractId();

      // Deploy another contract without salt
      const contract2 = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract2.deploy({
        config: config,
      });

      assertExists(contract2.getContractId());
      assert(StrKey.isContractId(contract2.getContractId()));

      const contractId2 = contract2.getContractId();

      // Both should be valid but different (random salts)
      assertNotEquals(contractId1, contractId2);
    });

    it("random deployment returns different ID than predefined salt deployments", async () => {
      // Calculate expected IDs for predefined salts
      const expectedContractIdA = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_A
      );
      const expectedContractIdB = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_B
      );
      const expectedContractIdC = calculateContractId(
        networkConfig.networkPassphrase,
        admin.address(),
        SALT_C
      );

      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract.deploy({
        config: config,
      });

      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      const randomContractId = contract.getContractId();

      // Should be different from any predefined salt contract IDs
      assertNotEquals(randomContractId, expectedContractIdA);
      assertNotEquals(randomContractId, expectedContractIdB);
      assertNotEquals(randomContractId, expectedContractIdC);
    });
  });
});
