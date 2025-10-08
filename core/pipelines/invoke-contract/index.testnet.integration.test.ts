import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";

import { TestNet } from "../../network/index.ts";
import { Asset, Operation, Keypair, nativeToScVal } from "stellar-sdk";
import type { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";
import { createInvokeContractPipeline } from "./index.ts";
import { initializeWithFriendbot } from "../../tools/friendbot/initialize-with-friendbot.ts";
import type {
  Ed25519PublicKey,
  TransactionSigner,
} from "../../common/types.ts";
import type { TransactionConfig } from "../../common/types/transaction-config/types.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/index.ts";

describe(
  "[Testnet] InvokeContract Pipeline",
  disableSanitizeConfig,

  () => {
    const networkConfig = TestNet();
    const xlmContractId = Asset.native().contractId(
      networkConfig.networkPassphrase
    );

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
      const readPipe = createInvokeContractPipeline({ networkConfig });
      assertInstanceOf(readPipe, Object);
      assertEquals(readPipe.name, "InvokeContractPipeline");
    });

    it("should invoke a contract and return the output of the pipeline", async () => {
      const readPipe = createInvokeContractPipeline({ networkConfig });
      const decimalsOp = Operation.invokeContractFunction({
        function: "decimals",
        contract: xlmContractId,
        args: [],
      });

      const result = await readPipe.run({
        operations: [decimalsOp],
        config: txConfig,
      });

      assertExists(result);
      assertExists(result.hash);
      assertExists(result.response);
      assertEquals(result.returnValue, nativeToScVal("7", { type: "u32" }));
    });
  }
);
