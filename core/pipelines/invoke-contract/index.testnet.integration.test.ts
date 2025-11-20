import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { Asset, Operation, nativeToScVal, xdr } from "stellar-sdk";
import { TestNet } from "@/network/index.ts";
import { createInvokeContractPipeline } from "@/pipelines/invoke-contract/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";

describe(
  "[Testnet] InvokeContract Pipeline",
  disableSanitizeConfig,

  () => {
    const networkConfig = TestNet();
    const xlmContractId = Asset.native().contractId(
      networkConfig.networkPassphrase
    );

    const john = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

    const txConfig: TransactionConfig = {
      fee: "100",
      timeout: 30,
      source: john.address(),
      signers: [john.signer()],
    };

    beforeAll(async () => {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        john.address() as Ed25519PublicKey
      );
    });

    describe("Basic tests", () => {
      it("should create a pipeline", () => {
        const invokePipe = createInvokeContractPipeline({ networkConfig });
        assertInstanceOf(invokePipe, Object);
        assertEquals(invokePipe.name, "InvokeContractPipeline");
      });

      it("should invoke a contract and return the output of the pipeline", async () => {
        const invokePipe = createInvokeContractPipeline({ networkConfig });
        const decimalsOp = Operation.invokeContractFunction({
          function: "decimals",
          contract: xlmContractId,
          args: [],
        });

        const result = await invokePipe.run({
          operations: [decimalsOp],
          config: txConfig,
        });

        assertExists(result);
        assertExists(result.hash);
        assertExists(result.response);
        assertEquals(result.returnValue, nativeToScVal("7", { type: "u32" }));
      });
    });

    describe("Multi-transaction", () => {
      const bob = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
      const alice = NativeAccount.fromMasterSigner(
        LocalSigner.generateRandom()
      );

      beforeAll(async () => {
        await initializeWithFriendbot(
          networkConfig.friendbotUrl,
          bob.address() as Ed25519PublicKey
        );
        await initializeWithFriendbot(
          networkConfig.friendbotUrl,
          alice.address() as Ed25519PublicKey
        );
      });

      it("should handle envelope and soroban authorization", async () => {
        const invokePipe = createInvokeContractPipeline({ networkConfig });
        const transferOp = Operation.invokeContractFunction({
          function: "transfer",
          contract: xlmContractId,
          args: [
            nativeToScVal(bob.address(), { type: "address" }),
            nativeToScVal(alice.address(), { type: "address" }),
            nativeToScVal("10000000", { type: "i128" }), // 1 XLM (7 decimals)
          ],
        });

        const txConfig: TransactionConfig = {
          fee: "10000",
          timeout: 30,
          source: john.address(),
          signers: [john.signer(), bob.signer()],
        };

        const result = await invokePipe.run({
          operations: [transferOp],
          config: txConfig,
        });

        assertExists(result);
        assertExists(result.hash);
        assertExists(result.response);
        assertEquals(result.returnValue, xdr.ScVal.scvVoid());
      });
    });
  }
);
