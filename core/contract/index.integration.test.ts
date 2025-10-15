import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import type { Buffer } from "node:buffer";
import { Asset, nativeToScVal } from "stellar-sdk";
import { Contract } from "./index.ts";
import { TestNet } from "../network/index.ts";
import { NativeAccount } from "../account/native/index.ts";
import { LocalSigner } from "../signer/local/index.ts";
import { initializeWithFriendbot } from "../tools/friendbot/initialize-with-friendbot.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  SEP41_SPEC,
  SEP41_METHOD,
} from "colibri-internal/tests/specs/sep41.ts";
import {
  TYPES_HARNESS_SPEC,
  TYPES_HARNESS_METHOD,
} from "colibri-internal/tests/specs/types-harness.ts";
import { StrKey } from "../strkeys/index.ts";
import * as E from "./error.ts";
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

    it("Initializes with wasm hash and deploys new instance without constructor args", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      await contract.deploy({
        config: {
          fee: "10000000", // 1 XLM
          timeout: 30,
          source: admin.address(),
          signers: [admin.signer()],
        },
      });
      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      contractId = contract.getContractId() as string;
    });

    it("Initializes with contract Id and reads from the contract functions", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: contractId,
          spec: TYPES_HARNESS_SPEC,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const boolValue = await contract.read({
        method: TYPES_HARNESS_METHOD.BOOL,
        methodArgs: { v: true },
      });

      assertExists(boolValue);
      assert(typeof boolValue === "boolean");
      assertEquals(boolValue, true);
    });

    it("Initializes with  contract Id and invokes functions from the contract", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: contractId,
          spec: TYPES_HARNESS_SPEC,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const result = await contract.invoke({
        method: TYPES_HARNESS_METHOD.STRING,
        methodArgs: {
          v: "test",
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
      assertEquals(
        result.returnValue?.toXDR("base64"),
        nativeToScVal("test", { type: "string" }).toXDR("base64")
      );
    });

    it("Initializes with  contract wasmhash and loads spec the deployed contract", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasmHash: wasmHash,
        },
      });

      assertExists(contract);
      assertExists(contract.getWasmHash());

      await contract.loadSpecFromDeployedContract();

      assertExists(contract.getSpec());
    });

    it("Initializes with  contract id, loads the wasmhash and loads spec from the deployed contract, then interacts with it", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: contractId,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      await assertRejects(
        async () => await contract.getWasmHash(),
        E.MISSING_REQUIRED_PROPERTY
      );

      await assertRejects(
        async () => await contract.getSpec(),
        E.MISSING_REQUIRED_PROPERTY
      );

      await contract.loadSpecFromDeployedContract();

      assertExists(contract.getWasmHash());
      assertExists(contract.getSpec());
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

    it("Initializes with SAC contract Id and reads from the contract functions", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: assetContractId,
          spec: SEP41_SPEC,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const decimals = await contract.read({
        method: SEP41_METHOD.decimals,
      });

      assertExists(decimals);
      assert(Number.isInteger(decimals));
      assertEquals(decimals, 7);
    });

    it("Initializes with SAC  contract Id and invokes functions from the contract", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: assetContractId,
          spec: SEP41_SPEC,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const result = await contract.invoke({
        method: SEP41_METHOD.transfer,
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
