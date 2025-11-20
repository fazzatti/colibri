import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Operation } from "stellar-sdk";
import { TestNet } from "@/network/index.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { NativeAccount } from "@/account/native/index.ts";

describe(
  "[Testnet] ClassicTransaction Pipeline",
  disableSanitizeConfig,

  () => {
    const networkConfig = TestNet();

    const john = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

    const txConfig: TransactionConfig = {
      fee: "100",
      timeout: 30,
      source: john.address(),
      signers: [john.signer()],
    };
    beforeAll(async () => {
      await initializeWithFriendbot(networkConfig.friendbotUrl, john.address());
    });

    it("should create a pipeline", () => {
      const readPipe = createClassicTransactionPipeline({ networkConfig });
      assertInstanceOf(readPipe, Object);
      assertEquals(readPipe.name, "ClassicTransactionPipeline");
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
  }
);
