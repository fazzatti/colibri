import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  ERRORS_CONTRACT_METHODS,
  ERRORS_CONTRACT_SPEC,
} from "colibri-internal/tests/specs/errors-contract.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { Contract } from "@/contract/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import * as E from "@/processes/simulate-transaction/error.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";

describe(
  "[Testnet] SimulateTransaction contract errors",
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

    let targetErrorsContract: Contract;
    let callerErrorsContract: Contract;

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

      targetErrorsContract = new Contract({
        networkConfig,
        contractConfig: {
          wasm,
          spec: ERRORS_CONTRACT_SPEC,
        },
      });

      await targetErrorsContract.uploadWasm(config);
      await targetErrorsContract.deploy({ config });

      callerErrorsContract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: targetErrorsContract.getWasmHash(),
          spec: ERRORS_CONTRACT_SPEC,
        },
      });

      await callerErrorsContract.deploy({ config });
    });

    it("throws CONTRACT_ERROR_SIMULATION_FAILED for contract error #1", async () => {
      const error = await assertRejects(
        async () =>
          await targetErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 1 },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #1!",
      );
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 1);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [1, 2],
      );
      assertEquals(error.meta.data.contractErrorStack.length, 2);
      assertEquals(error.meta.data.contractErrorStack[0].code, 1);
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(error.meta.data.contractErrorStack[0].eventIndex, 1);
      assertEquals(
        error.meta.data.contractErrorStack[0].issuedFrom,
        "root-invocation",
      );
      assertEquals(
        error.meta.data.rootInvocation?.contractId,
        targetErrorsContract.getContractId(),
      );
      const functionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(functionCallEvent.kind, "function-call");
      assert(functionCallEvent.kind === "function-call");
      assertEquals(
        functionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        functionCallEvent.functionCall.functionName,
        ERRORS_CONTRACT_METHODS.trigger_by_code,
      );
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws CONTRACT_ERROR_SIMULATION_FAILED for contract error #265", async () => {
      const error = await assertRejects(
        async () =>
          await targetErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 265 },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #265!",
      );
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 265);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [1, 2],
      );
      assertEquals(error.meta.data.contractErrorStack.length, 2);
      assertEquals(error.meta.data.contractErrorStack[0].code, 265);
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(error.meta.data.contractErrorStack[0].eventIndex, 1);
      const functionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(functionCallEvent.kind, "function-call");
      assert(functionCallEvent.kind === "function-call");
      assertEquals(
        functionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        functionCallEvent.functionCall.functionName,
        ERRORS_CONTRACT_METHODS.trigger_by_code,
      );
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws CONTRACT_ERROR_SIMULATION_FAILED for contract error #3477", async () => {
      const error = await assertRejects(
        async () =>
          await targetErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 3477 },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #3477!",
      );
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 3477);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [1, 2],
      );
      assertEquals(error.meta.data.contractErrorStack.length, 2);
      assertEquals(error.meta.data.contractErrorStack[0].code, 3477);
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(error.meta.data.contractErrorStack[0].eventIndex, 1);
      const functionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(functionCallEvent.kind, "function-call");
      assert(functionCallEvent.kind === "function-call");
      assertEquals(
        functionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        functionCallEvent.functionCall.functionName,
        ERRORS_CONTRACT_METHODS.trigger_by_code,
      );
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws CONTRACT_ERROR_SIMULATION_FAILED for contract error #65535", async () => {
      const error = await assertRejects(
        async () =>
          await targetErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 65_535 },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #65535!",
      );
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 65_535);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [1, 2],
      );
      assertEquals(error.meta.data.contractErrorStack.length, 2);
      assertEquals(error.meta.data.contractErrorStack[0].code, 65_535);
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(error.meta.data.contractErrorStack[0].eventIndex, 1);
      const functionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(functionCallEvent.kind, "function-call");
      assert(functionCallEvent.kind === "function-call");
      assertEquals(
        functionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        functionCallEvent.functionCall.functionName,
        ERRORS_CONTRACT_METHODS.trigger_by_code,
      );
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws CONTRACT_ERROR_SIMULATION_FAILED for contract error #700001", async () => {
      const error = await assertRejects(
        async () =>
          await targetErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 700_001 },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #700001!",
      );
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 700_001);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [1, 2],
      );
      assertEquals(error.meta.data.contractErrorStack.length, 2);
      assertEquals(error.meta.data.contractErrorStack[0].code, 700_001);
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(error.meta.data.contractErrorStack[0].eventIndex, 1);
      const functionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(functionCallEvent.kind, "function-call");
      assert(functionCallEvent.kind === "function-call");
      assertEquals(
        functionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        functionCallEvent.functionCall.functionName,
        ERRORS_CONTRACT_METHODS.trigger_by_code,
      );
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws SIMULATION_FAILED without contract-error metadata for unstructured panics", async () => {
      const error = await assertRejects(
        async () =>
          await targetErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_generic,
            methodArgs: { message: "plain panic path" },
            config,
          }),
        E.SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.SIMULATION_FAILED);
      assertEquals(error instanceof E.CONTRACT_ERROR_SIMULATION_FAILED, false);
      assertEquals(error.meta.data.contractError, undefined);
      assertEquals(error.meta.data.contractErrorStack.length, 0);
      assertEquals(error.meta.data.diagnosticEvents.length > 0, true);
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws CONTRACT_ERROR_SIMULATION_FAILED when a cross-contract invocation returns contract error #1", async () => {
      const error = await assertRejects(
        async () =>
          await callerErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_cross_contract_by_code,
            methodArgs: {
              target_contract: targetErrorsContract.getContractId(),
              error_code: 1,
            },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(
        error.message,
        "Transaction simulation failed with contract error #1!",
      );
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 1);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [2, 3, 5, 6],
      );
      assertEquals(
        error.meta.data.contractErrorStack.map((event) => event.code),
        [1, 1, 1, 1],
      );
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        error.meta.data.contractErrorStack[0].issuedFrom,
        "sub-invocation",
      );
      assertEquals(
        error.meta.data.contractErrorStack[2].contractId,
        callerErrorsContract.getContractId(),
      );
      assertEquals(
        error.meta.data.contractErrorStack[2].issuedFrom,
        "root-invocation",
      );
      assertEquals(
        error.meta.data.rootInvocation?.contractId,
        callerErrorsContract.getContractId(),
      );
      const rootFunctionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(rootFunctionCallEvent.kind, "function-call");
      assert(rootFunctionCallEvent.kind === "function-call");
      assertEquals(
        rootFunctionCallEvent.functionCall.contractId,
        callerErrorsContract.getContractId(),
      );
      const subFunctionCallEvent = error.meta.data.diagnosticEvents[1];
      assertEquals(subFunctionCallEvent.kind, "function-call");
      assert(subFunctionCallEvent.kind === "function-call");
      assertEquals(
        subFunctionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("throws SIMULATION_FAILED when a cross-contract invocation reaches an unstructured panic", async () => {
      const error = await assertRejects(
        async () =>
          await callerErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_cross_contract_generic,
            methodArgs: {
              target_contract: targetErrorsContract.getContractId(),
              message: "cross-contract panic path",
            },
            config,
          }),
        E.SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.SIMULATION_FAILED);
      assertEquals(error instanceof E.CONTRACT_ERROR_SIMULATION_FAILED, false);
      assertEquals(error.meta.data.contractError, undefined);
      assertEquals(error.meta.data.contractErrorStack.length, 0);
      assertEquals(error.meta.data.diagnosticEvents.length > 0, true);
      assertExists(error.meta.data.simulationResponse.error);
    });

    it("surfaces reissued contract error #265 and keeps the ordered diagnostic stack", async () => {
      const error = await assertRejects(
        async () =>
          await callerErrorsContract.invoke({
            method: ERRORS_CONTRACT_METHODS.trigger_cross_rethrow_code,
            methodArgs: {
              target_contract: targetErrorsContract.getContractId(),
              target_error_code: 1,
              rethrow_error_code: 265,
            },
            config,
          }),
        E.CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(error.code, E.Code.CONTRACT_ERROR_SIMULATION_FAILED);
      assertEquals(error.meta.data.contractError.kind, "contract");
      assertEquals(error.meta.data.contractError.code, 265);
      assertEquals(
        error.meta.data.contractError.source,
        "simulation-error-string",
      );
      assertEquals(
        error.meta.data.contractError.matchingEventIndexes,
        [6, 7],
      );
      assertEquals(
        error.meta.data.contractErrorStack.map((event) => event.code),
        [1, 1, 1, 265, 265],
      );
      assertEquals(
        error.meta.data.contractErrorStack[0].contractId,
        targetErrorsContract.getContractId(),
      );
      assertEquals(
        error.meta.data.contractErrorStack[0].issuedFrom,
        "sub-invocation",
      );
      assertEquals(
        error.meta.data.contractErrorStack[2].contractId,
        callerErrorsContract.getContractId(),
      );
      assertEquals(
        error.meta.data.contractErrorStack[2].issuedFrom,
        "root-invocation",
      );
      assertEquals(
        error.meta.data.contractErrorStack[3].contractId,
        callerErrorsContract.getContractId(),
      );
      assertEquals(
        error.meta.data.contractErrorStack[3].issuedFrom,
        "root-invocation",
      );
      assertEquals(
        error.meta.data.rootInvocation?.contractId,
        callerErrorsContract.getContractId(),
      );
      const rootFunctionCallEvent = error.meta.data.diagnosticEvents[0];
      assertEquals(rootFunctionCallEvent.kind, "function-call");
      assert(rootFunctionCallEvent.kind === "function-call");
      assertEquals(
        rootFunctionCallEvent.functionCall.contractId,
        callerErrorsContract.getContractId(),
      );
      const subFunctionCallEvent = error.meta.data.diagnosticEvents[1];
      assertEquals(subFunctionCallEvent.kind, "function-call");
      assert(subFunctionCallEvent.kind === "function-call");
      assertEquals(
        subFunctionCallEvent.functionCall.contractId,
        targetErrorsContract.getContractId(),
      );
      assertExists(error.meta.data.simulationResponse.error);
    });
  },
);
