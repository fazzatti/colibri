import { assertEquals, assertRejects } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  ErrorByCode,
  ERRORS_CONTRACT_METHODS,
  ERRORS_CONTRACT_SPEC,
} from "colibri-internal/tests/specs/errors-contract.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { Contract } from "@/contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import * as SIM_ERRORS from "@/processes/simulate-transaction/error.ts";
import {
  createContractErrorMatcherPlugin,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import * as PLUGIN_ERRORS from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";

describe(
  "[Testnet] ContractErrorMatcherPlugin",
  disableSanitizeConfig,
  () => {
    const networkConfig = NetworkConfig.TestNet();
    const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

    const config: TransactionConfig = {
      fee: "10000000",
      timeout: 30,
      source: admin.address(),
      signers: [admin.signer()],
    };

    let matchingContract: Contract;
    let unmatchedContract: Contract;

    beforeAll(async () => {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        admin.address(),
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );

      const wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/errors_contract.wasm",
      );

      const deployedContract = new Contract({
        networkConfig,
        contractConfig: {
          wasm,
          spec: ERRORS_CONTRACT_SPEC,
        },
      });

      await deployedContract.uploadWasm(config);
      await deployedContract.deploy({ config });

      matchingContract = new Contract({
        networkConfig,
        rpc: deployedContract.rpc,
        contractConfig: {
          contractId: deployedContract.getContractId(),
          spec: ERRORS_CONTRACT_SPEC,
        },
      });
      matchingContract.invokePipe.use(
        createContractErrorMatcherPlugin(ErrorByCode),
      );

      unmatchedContract = new Contract({
        networkConfig,
        rpc: deployedContract.rpc,
        contractConfig: {
          contractId: deployedContract.getContractId(),
          spec: ERRORS_CONTRACT_SPEC,
        },
      });
      unmatchedContract.invokePipe.use(
        createContractErrorMatcherPlugin({
          999: { message: "Not the emitted error" },
        }),
      );
    });

    it("throws a known contract-error plugin failure from the invoke pipeline", async () => {
      const error = await assertRejects(
        async () =>
          await matchingContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 265 },
            config,
          }),
        PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(
        error.code,
        PLUGIN_ERRORS.Code.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
      );
      assertEquals(
        error.message,
        "Contract error: TwoHundredSixtyFive",
      );
      assertEquals(
        error.meta.cause instanceof SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED,
        true,
      );
      assertEquals(error.meta.data.match.code, 265);
      assertEquals(
        error.meta.data.match.message,
        "TwoHundredSixtyFive",
      );
      assertEquals(
        error.meta.data.match.contractId,
        matchingContract.getContractId(),
      );
      assertEquals(error.meta.data.match.issuedFrom, "root-invocation");
      assertEquals(error.meta.data.match.strategy, "any");
      assertEquals(error.meta.data.match.matcherIndex, 0);
    });

    it("keeps the original process failure when the invoke pipeline has no known mapping", async () => {
      const error = await assertRejects(
        async () =>
          await unmatchedContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 265 },
            config,
          }),
        SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(
        error.code,
        SIM_ERRORS.Code.CONTRACT_ERROR_SIMULATION_FAILED,
      );
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #265!",
      );
      assertEquals(error.meta.data.contractError.code, 265);
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        unmatchedContract.getContractId(),
      );
    });
  },
);
