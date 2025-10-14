import {
  assert,
  assertEquals,
  assertExists,
  assertInstanceOf,
} from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import type { Buffer } from "node:buffer";
import { Asset } from "stellar-sdk";
import { Contract } from "./index.ts";
import { TestNet } from "../network/index.ts";
import { NativeAccount } from "../account/native/index.ts";
import { LocalSigner } from "../signer/local/index.ts";
import { initializeWithFriendbot } from "../tools/friendbot/initialize-with-friendbot.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import { StrKey } from "../strkeys/index.ts";
describe("[Testnet] Contract", disableSanitizeConfig, () => {
  const networkConfig = TestNet();

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

  beforeAll(async () => {
    await initializeWithFriendbot(networkConfig.friendbotUrl, admin.address());
  });

  describe("Initialization", () => {
    let wasm: Buffer;
    let wasmHash: string;
    let contractId: string;
    let assetContractId: string;
    const xlm = Asset.native();

    beforeAll(async () => {
      wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/types_harness.wasm"
      );
    });
    it("Initializes with WASM and upload binaries", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasm: wasm,
        },
      });

      assert;
      await contract.uploadWasm({
        fee: "10000000", // 1 XLM
        timeout: 30,
        source: admin.address(),
        signers: [admin.signer()],
      });
      assertExists(contract);
      assertExists(contract.getWasmHash());

      wasmHash = contract.getWasmHash() as string;
    });

    // failling for p24 update
    it.skip("⚠️ Initializes with wasm hash and deploys new instance without constructor args", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      assert;
      await contract
        .deploy({
          config: {
            fee: "10000000", // 1 XLM
            timeout: 30,
            source: admin.address(),
            signers: [admin.signer()],
          },
        })
        .catch((error) => {
          console.error(error);
          throw error;
        });
      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      contractId = contract.getContractId() as string;
    });

    it("Initializes wrapping an asset", async () => {
      const contract = await Contract.wrapAssetAndInitialize({
        networkConfig,
        asset: xlm,
        config: {
          fee: "10000000", // 1 XLM
          timeout: 30,
          source: admin.address(),
          signers: [admin.signer()],
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId() as string));
      assertEquals(
        contract.getContractId(),
        xlm.contractId(networkConfig.networkPassphrase)
      );
      assetContractId = contract.getContractId() as string;
    });

    it("Initializes with contract Id and reads from the contract functions", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: assetContractId,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const decimals = await contract.read({
        method: "decimals",
      });

      assertExists(decimals);
      assertInstanceOf(decimals, Number);
      assertEquals(decimals, 7);
    });

    it("Initializes with contract Id and invokes functions from the contract", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: assetContractId,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const result = await contract.invoke({
        method: "transfer",
        methodArgs: {
          from: admin.address(),
          to: admin.address(),
          amount: 10000000, // 1 XLM
        },
        config: {
          fee: "10000000", // 1 XLM
          timeout: 30,
          source: admin.address(),
          signers: [admin.signer()],
        },
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
    });
  });
});
