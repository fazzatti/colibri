import {
  assert,
  assertEquals,
  assertExists,
  assertInstanceOf,
} from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { Asset, nativeToScVal, Operation, xdr } from "stellar-sdk";
import { NetworkConfig } from "@/network/index.ts";
import { createInvokeContractPipeline } from "@/pipelines/invoke-contract/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";

const assertConfirmedSorobanFee = (
  result: InvokeContractOutput,
  expected: { inclusion?: bigint; max?: bigint },
) => {
  const transaction = result.response.envelopeXdr.v1().tx();
  const totalFee = BigInt(transaction.fee());
  const resourceFee = transaction.ext().value()?.resourceFee().toBigInt() ??
    0n;
  const inclusionFee = totalFee - resourceFee;
  const chargedFee = result.response.resultXdr.feeCharged().toBigInt();

  if (expected.inclusion !== undefined) {
    assertEquals(inclusionFee, expected.inclusion);
  }
  if (expected.max !== undefined) {
    assertEquals(totalFee, expected.max);
  }
  assert(resourceFee > 0n);
  assert(inclusionFee >= 100n);
  assert(chargedFee > 0n);
  assert(chargedFee <= totalFee);
};

describe(
  "[Testnet] InvokeContract Pipeline",
  disableSanitizeConfig,
  () => {
    const networkConfig = NetworkConfig.TestNet();
    const xlmContractId = Asset.native().contractId(
      networkConfig.networkPassphrase,
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
        john.address() as Ed25519PublicKey,
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );
    });

    describe("Basic tests", () => {
      it("should create a pipeline", () => {
        const invokePipe = createInvokeContractPipeline({ networkConfig });
        assertInstanceOf(invokePipe, Object);
        assertEquals(invokePipe.id, "InvokeContractPipeline");
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

      describe("Confirmed transaction fees", () => {
        const decimalsOperation = () =>
          Operation.invokeContractFunction({
            function: "decimals",
            contract: xlmContractId,
            args: [],
          });

        const runWithFee = (fee: TransactionConfig["fee"]) =>
          createInvokeContractPipeline({ networkConfig }).run({
            operations: [decimalsOperation()],
            config: { ...txConfig, fee },
          });

        it("confirms that a string remains the Soroban inclusion fee", async () => {
          const result = await runWithFee("101");

          assertConfirmedSorobanFee(result, { inclusion: 101n });
        });

        it("confirms an explicit Soroban base fee", async () => {
          const result = await runWithFee({ base: "102" });

          assertConfirmedSorobanFee(result, { inclusion: 102n });
        });

        it("confirms an exact Soroban inclusion fee", async () => {
          const result = await runWithFee({ inclusion: "103" });

          assertConfirmedSorobanFee(result, { inclusion: 103n });
        });

        it("confirms the total Soroban transaction fee is capped", async () => {
          const result = await runWithFee({ max: "10000000" });

          assertConfirmedSorobanFee(result, { max: 10000000n });
        });
      });
    });

    describe("Multi-transaction", () => {
      const bob = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
      const alice = NativeAccount.fromMasterSigner(
        LocalSigner.generateRandom(),
      );

      beforeAll(async () => {
        await initializeWithFriendbot(
          networkConfig.friendbotUrl,
          bob.address() as Ed25519PublicKey,
          {
            rpcUrl: networkConfig.rpcUrl,
            allowHttp: networkConfig.allowHttp,
          },
        );
        await initializeWithFriendbot(
          networkConfig.friendbotUrl,
          alice.address() as Ed25519PublicKey,
          {
            rpcUrl: networkConfig.rpcUrl,
            allowHttp: networkConfig.allowHttp,
          },
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
  },
);
