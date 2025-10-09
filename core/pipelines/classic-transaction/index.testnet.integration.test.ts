import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";

import { TestNet } from "../../network/index.ts";
import { Operation, Keypair } from "stellar-sdk";
import type { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";
import { createClassicTransactionPipeline } from "./index.ts";
import { initializeWithFriendbot } from "../../tools/friendbot/initialize-with-friendbot.ts";
import type {
  Ed25519PublicKey,
  TransactionSigner,
} from "../../common/types.ts";
import type { TransactionConfig } from "../../common/types/transaction-config/types.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/index.ts";

describe(
  "[Testnet] ClassicTransaction Pipeline",
  disableSanitizeConfig,

  () => {
    const networkConfig = TestNet();

    const johnKeys = Keypair.random();

    const johnSigner: TransactionSigner = {
      publicKey: () => johnKeys.publicKey() as Ed25519PublicKey,
      sign: (tx: Transaction | FeeBumpTransaction) => {
        tx.sign(johnKeys);
        return tx.toXDR();
      },
      signSorobanAuthEntry: (
        entry: xdr.SorobanAuthorizationEntry,
        _vu: number,
        _np: string
      ) => {
        return new Promise((resolve) => {
          resolve(entry);
        });
      },
    };

    const txConfig: TransactionConfig = {
      fee: "100",
      timeout: 30,
      source: johnSigner.publicKey(),
      signers: [johnSigner],
    };
    beforeAll(async () => {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        johnKeys.publicKey() as Ed25519PublicKey
      );
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
