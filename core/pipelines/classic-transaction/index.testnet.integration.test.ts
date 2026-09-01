import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import {
  assert,
  assertEquals,
  assertExists,
  assertInstanceOf,
} from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Operation } from "stellar-sdk";
import { NetworkConfig } from "@/network/index.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { NativeAccount } from "@/account/native/index.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";

const assertConfirmedFee = (
  result: ClassicTransactionOutput,
  expectedEnvelopeFee: bigint,
) => {
  const envelope = result.response.envelopeXdr;
  assertEquals(envelope.type, "envelopeTypeTx");
  if (envelope.type !== "envelopeTypeTx") {
    throw new Error("Expected a v1 transaction envelope");
  }
  const envelopeFee = BigInt(envelope.v1.tx.fee);
  const chargedFee = result.response.resultXdr.feeCharged;

  assertEquals(envelopeFee, expectedEnvelopeFee);
  assert(chargedFee > 0n);
  assert(chargedFee <= envelopeFee);
};

describe(
  "[Testnet] ClassicTransaction Pipeline",
  disableSanitizeConfig,
  () => {
    const networkConfig = NetworkConfig.TestNet();

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
        john.address(),
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );
    });

    it("should create a pipeline", () => {
      const readPipe = createClassicTransactionPipeline({ networkConfig });
      assertInstanceOf(readPipe, Object);
      assertEquals(readPipe.id, "ClassicTransactionPipeline");
    });

    it("should execute a transaction with a classic operation", async () => {
      const readPipe = createClassicTransactionPipeline({ networkConfig });
      const decimalsOp = Operation.setOptions({});

      const result = await readPipe.run({
        operations: [decimalsOp],
        config: txConfig,
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
    });

    describe("Confirmed transaction fees", () => {
      const operationsFor = (suffix: string) => [
        Operation.manageData({ name: `fee-${suffix}-1`, value: "1" }),
        Operation.manageData({ name: `fee-${suffix}-2`, value: "2" }),
      ];

      const runWithFee = (
        fee: TransactionConfig["fee"],
        suffix: string,
      ) =>
        createClassicTransactionPipeline({ networkConfig }).run({
          operations: operationsFor(suffix),
          config: { ...txConfig, fee },
        });

      it("confirms that a string remains a per-operation base fee", async () => {
        const result = await runWithFee("101", "string");

        assertConfirmedFee(result, 202n);
      });

      it("confirms an explicit per-operation base fee", async () => {
        const result = await runWithFee({ base: "102" }, "base");

        assertConfirmedFee(result, 204n);
      });

      it("confirms an exact non-divisible inclusion fee", async () => {
        const result = await runWithFee({ inclusion: "205" }, "inclusion");

        assertConfirmedFee(result, 205n);
      });

      it("confirms a classic transaction never exceeds its maximum fee", async () => {
        const result = await runWithFee({ max: "207" }, "max");

        assertConfirmedFee(result, 207n);
      });
    });
  },
);
