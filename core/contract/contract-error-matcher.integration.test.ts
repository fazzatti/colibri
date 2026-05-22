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
import * as PLUGIN_ERRORS from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
import * as SIM_ERRORS from "@/processes/simulate-transaction/error.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";

describe(
  "[Testnet] Contract contract errors",
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

    let contract: Contract;

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

      contract = new Contract({
        networkConfig,
        contractConfig: {
          wasm,
          spec: ERRORS_CONTRACT_SPEC,
          contractErrors: ErrorByCode,
        },
      });

      await contract.uploadWasm(config);
      await contract.deploy({ config });
    });

    it("throws a known contract-error plugin failure from contract invoke", async () => {
      const error = await assertRejects(
        async () =>
          await contract.invoke({
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
        contract.getContractId(),
      );
      assertEquals(error.meta.data.match.issuedFrom, "root-invocation");
      assertEquals(error.meta.data.match.strategy, "any");
      assertEquals(error.meta.data.match.matcherIndex, 0);
    });

    it("throws a known contract-error plugin failure from contract read", async () => {
      const error = await assertRejects(
        async () =>
          await contract.read({
            method: ERRORS_CONTRACT_METHODS.trigger_by_code,
            methodArgs: { error_code: 3477 },
          }),
        PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
      );

      assertEquals(
        error.code,
        PLUGIN_ERRORS.Code.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
      );
      assertEquals(
        error.message,
        "Contract error: ThreeThousandFourHundredSeventySeven",
      );
      assertEquals(
        error.meta.cause instanceof SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED,
        true,
      );
      assertEquals(error.meta.data.match.code, 3477);
      assertEquals(
        error.meta.data.match.message,
        "ThreeThousandFourHundredSeventySeven",
      );
      assertEquals(
        error.meta.data.match.contractId,
        contract.getContractId(),
      );
      assertEquals(error.meta.data.match.issuedFrom, "root-invocation");
      assertEquals(error.meta.data.match.strategy, "any");
      assertEquals(error.meta.data.match.matcherIndex, 0);
    });
  },
);
