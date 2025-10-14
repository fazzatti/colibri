import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeAll, describe, it } from "@std/testing/bdd";

import { PLG_FeeBump } from "./index.ts";

import {
  P_SendTransaction,
  TestNet,
  PIPE_InvokeContract,
  type TransactionConfig,
} from "@colibri/core";
import { initializeWithFriendbot } from "../../../core/tools/friendbot/initialize-with-friendbot.ts";
import { NativeAccount } from "../../../core/account/native/index.ts";
import { LocalSigner } from "../../../core/signer/local/index.ts";
import type { Ed25519PublicKey } from "../../../core/strkeys/types.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { Asset, Operation } from "stellar-sdk";
import { Api } from "stellar-sdk/rpc";

describe(
  "[Testnet] FeeBump Plugin",
  disableSanitizeConfig,

  () => {
    const networkConfig = TestNet();

    const xlmContractId = Asset.native().contractId(
      networkConfig.networkPassphrase
    );

    let invokePipe: ReturnType<typeof PIPE_InvokeContract.create> | undefined =
      undefined;
    // Inner tx source and fee-bump payer
    const innerSource = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom()
    );
    const feeBumpSource = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom()
    );

    beforeAll(async () => {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        innerSource.address() as Ed25519PublicKey
      );
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        feeBumpSource.address() as Ed25519PublicKey
      );

      invokePipe = PIPE_InvokeContract.create({
        networkConfig,
      });
    });

    afterEach(() => {
      invokePipe = undefined;
    });

    describe("Construction", () => {
      it("should initialize the plugin", () => {
        const plugin = PLG_FeeBump.create({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        assertExists(plugin);
        assertEquals(plugin.name, PLG_FeeBump.name);
      });

      it("should add the plugin to the SendTransaction process", () => {
        const plugin = PLG_FeeBump.create({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        invokePipe = PIPE_InvokeContract.create({
          networkConfig,
        });

        const SendTransactionStep = P_SendTransaction();

        const sendTransactionStepBefore = invokePipe.steps.find(
          (step) => step.name === PLG_FeeBump.target
        ) as typeof SendTransactionStep;

        assertExists(sendTransactionStepBefore);
        assertExists(sendTransactionStepBefore.plugins);
        assertEquals(sendTransactionStepBefore.plugins.length, 0);

        invokePipe.addPlugin(plugin, PLG_FeeBump.target);

        assertExists(invokePipe);
        assertEquals(invokePipe.name, PIPE_InvokeContract.name);

        const sendTransactionStepAfter = invokePipe.steps.find(
          (step) => step.name === PLG_FeeBump.target
        ) as typeof SendTransactionStep;

        assertExists(sendTransactionStepAfter);
        assertExists(sendTransactionStepAfter.plugins);
        assertEquals(sendTransactionStepAfter.plugins.length, 1);
        assertEquals(
          sendTransactionStepAfter.plugins[0].name,
          PLG_FeeBump.name
        );
      });
    });
    describe("Execute", () => {
      it("should wrap and run a successful fee bump transaction", async () => {
        const plugin = PLG_FeeBump.create({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        const innerConfig: TransactionConfig = {
          source: innerSource.address(),
          fee: "100",
          timeout: 30,
          signers: [innerSource.signer()],
        };
        assertExists(plugin);
        assertEquals(plugin.name, "FeeBumpPlugin");

        invokePipe = PIPE_InvokeContract.create({
          networkConfig,
        });
        const SendTransactionStep = P_SendTransaction();

        const sendTransactionStepBefore = invokePipe.steps.find(
          (step) => step.name === PLG_FeeBump.target
        ) as typeof SendTransactionStep;

        assertExists(sendTransactionStepBefore);
        assertExists(sendTransactionStepBefore.plugins);
        assertEquals(sendTransactionStepBefore.plugins.length, 0);
        invokePipe.addPlugin(plugin, PLG_FeeBump.target);

        const decimalsOp = Operation.invokeContractFunction({
          function: "decimals",
          contract: xlmContractId,
          args: [],
        });

        const res = await invokePipe
          .run({
            operations: [decimalsOp],
            config: innerConfig,
          })
          .catch((error) => {
            console.error("Error during pipeline execution:", error);
            throw error;
          });

        assertExists(res);
        assertExists(res.hash);
        assertExists(res.response);
        assertEquals(res.response.status, Api.GetTransactionStatus.SUCCESS);
      });
    });
  }
);
