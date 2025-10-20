import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Buffer } from "node:buffer";
import { Asset, nativeToScVal, xdr } from "stellar-sdk";
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
import { FT_SPEC } from "colibri-internal/tests/specs/fungible-token.ts";
import {
  TYPES_HARNESS_SPEC,
  TYPES_HARNESS_METHOD,
} from "colibri-internal/tests/specs/types-harness.ts";
import { StrKey } from "../strkeys/index.ts";
import * as E from "./error.ts";
import type { TransactionConfig } from "../common/types/transaction-config/types.ts";
describe("[Testnet] Contract", disableSanitizeConfig, () => {
  const networkConfig = TestNet();

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

  const config: TransactionConfig = {
    fee: "10000000", // 1 XLM
    timeout: 30,
    source: admin.address(),
    signers: [admin.signer()],
  };

  beforeAll(async () => {
    await initializeWithFriendbot(networkConfig.friendbotUrl, admin.address());
  });

  describe("Core features and initialization", () => {
    let wasm: Buffer;
    let wasmFt: Buffer;
    let wasmHash: string;
    let typesHarnessContractId: string;
    let xlmWrappedContractId: string;
    const xlm = Asset.native();

    beforeAll(async () => {
      wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/types_harness.wasm"
      );

      wasmFt = await loadWasmFile(
        "./_internal/tests/compiled-contracts/fungible_token_contract.wasm"
      );
    });
    it("Initializes with WASM and upload binaries", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasm: wasm,
        },
      });

      await contract.uploadWasm(config);
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
        config: config,
      });
      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));

      typesHarnessContractId = contract.getContractId() as string;
    });

    it("Deploys a contract with constructor args", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasm: wasmFt,
          spec: FT_SPEC,
        },
      });

      await contract.uploadWasm(config);

      await contract.deploy({
        config: config,
        constructorArgs: {
          recipient: admin.address(),
          owner: admin.address(),
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId()));
    });

    it("Initializes with contract Id and reads from the contract functions", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: typesHarnessContractId,
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
          contractId: typesHarnessContractId,
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
        config: config,
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
      assertEquals(
        result.returnValue?.toXDR("base64"),
        nativeToScVal("test", { type: "string" }).toXDR("base64")
      );
    });

    it("Initializes with  contract Id and invokes functions from the contract without args", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: typesHarnessContractId,
          spec: TYPES_HARNESS_SPEC,
        },
      });

      assertExists(contract);
      assertExists(contract.getContractId());

      const result = await contract.invoke({
        method: TYPES_HARNESS_METHOD.VOID,
        config: config,
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
      assertEquals(
        result.returnValue?.toXDR("base64"),
        xdr.ScVal.scvVoid().toXDR("base64")
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
          contractId: typesHarnessContractId,
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

    it("Initializes wrapping an existing asset (XLM)", async () => {
      const contract = await Contract.wrapAssetAndInitialize({
        networkConfig,
        asset: xlm,
        config: config,
      });

      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId() as string));
      assertEquals(
        contract.getContractId(),
        xlm.contractId(networkConfig.networkPassphrase)
      );
      xlmWrappedContractId = contract.getContractId() as string;
    });

    it("Initializes wrapping a fresh new asset", async () => {
      const issuer = NativeAccount.fromMasterSigner(
        LocalSigner.generateRandom()
      );
      const testAsset = new Asset("COLIBRITEST", issuer.address() as string);
      const contract = await Contract.wrapAssetAndInitialize({
        networkConfig,
        asset: testAsset,
        config: config,
      });

      assertExists(contract);
      assertExists(contract.getContractId());
      assert(StrKey.isContractId(contract.getContractId() as string));
      assertEquals(
        contract.getContractId(),
        testAsset.contractId(networkConfig.networkPassphrase)
      );
    });

    it("Initializes with SAC contract Id and reads from the contract functions", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          contractId: xlmWrappedContractId,
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
          contractId: xlmWrappedContractId,
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
        config: config,
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
    });
  });

  describe("Errors", () => {
    it("throws FAILED_TO_UPLOAD_WASM for an invalid WASM buffer", async () => {
      const invalidWasm = Buffer.from("invalid wasm");
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasm: invalidWasm,
        },
      });

      assertExists(contract);

      await assertRejects(
        async () =>
          await contract.uploadWasm({
            fee: "10000000", // 1 XLM
            timeout: 30,
            source: admin.address(),
            signers: [admin.signer()],
          }),
        E.FAILED_TO_UPLOAD_WASM
      );
    });

    it("throws FAILED_TO_DEPLOY_CONTRACT for an invalid wasmhash buffer", async () => {
      const invalidWasmHash = "invalidwasmhash";
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasmHash: invalidWasmHash,
        },
      });

      assertExists(contract);

      await assertRejects(
        async () =>
          await contract.deploy({
            config: {
              fee: "10000000", // 1 XLM
              timeout: 30,
              source: admin.address(),
              signers: [admin.signer()],
            },
          }),
        E.FAILED_TO_DEPLOY_CONTRACT
      );
    });

    it("throws FAILED_TO_WRAP_ASSET for an invalid asset", async () => {
      const contract = Contract.create({
        networkConfig,
        contractConfig: {
          wasmHash: "mocked",
        },
      });

      assertExists(contract);

      await assertRejects(
        async () =>
          await contract.wrapAndDeployClassicAsset({
            config: {
              fee: "10000000", // 1 XLM
              timeout: 30,
              source: admin.address(),
              signers: [admin.signer()],
            },
            asset: {} as unknown as Asset,
          }),
        E.FAILED_TO_WRAP_ASSET
      );
    });
  });
});
