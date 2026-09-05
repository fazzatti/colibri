import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  Keypair,
  MuxedAccount,
  Operation,
  SignerKey,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import type { AssembleTransactionInput } from "@/processes/assemble-transaction/types.ts";

import * as E from "@/processes/assemble-transaction/error.ts";
import { stub } from "@std/testing/mock";
import type { BaseFee } from "@/common/types/transaction-config/types.ts";

// Helper function to create a test transaction
const createTestTransaction = (
  fee: BaseFee = "100",
  extraSigners?: string[],
) => {
  const account = new Account(
    "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
    "100",
  );

  return new TransactionBuilder(account, {
    fee: fee,
    networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
    extraSigners,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        function: "transfer",
        args: [],
      }),
    )
    .setTimeout(0)
    .build();
};

describe("AssembleTransaction", () => {
  describe("Features", () => {
    for (const operationSourceKind of ["none", "G", "M"] as const) {
      it(`preserves native ${operationSourceKind} operation-source XDR without rewriting it`, async () => {
        const source = new Account(
          Keypair.random().publicKey(),
          "9771475800162305",
        );
        const operationAccount = new Account(
          Keypair.random().publicKey(),
          "0",
        );
        const operationSource = operationSourceKind === "none"
          ? undefined
          : operationSourceKind === "M"
          ? new MuxedAccount(operationAccount, "987").accountId()
          : operationAccount.accountId();
        const transaction = new TransactionBuilder(
          source,
          {
            fee: "100",
            networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
          },
        ).addOperation(Operation.invokeContractFunction({
          contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
          function: "transfer",
          args: [],
          source: operationSource,
        })).setTimeout(60).build();
        const original = transaction.toXdr();
        const assembled = await assembleTransaction({
          transaction,
          sorobanData: new SorobanDataBuilder().setResourceFee(200),
          authEntries: [],
        });
        assertEquals(assembled.source, transaction.source);
        assertEquals(assembled.sequence, transaction.sequence);
        assertEquals(assembled.operations[0].source, operationSource);
        assertEquals(
          assembled.tx.operations[0].toXdr("base64"),
          transaction.tx.operations[0].toXdr("base64"),
        );
        assertEquals(assembled.timeBounds, transaction.timeBounds);
        assertEquals(assembled.fee, "300");
        assertEquals(transaction.toXdr(), original);
      });
    }

    it("executes with minimal valid input", async () => {
      const transaction = createTestTransaction();

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      };

      const result = await assembleTransaction(input);

      assertInstanceOf(result, Transaction);
    });

    it("adds the resource fee from Soroban data exactly once", async () => {
      const inclusionFee = "10";
      const transaction = createTestTransaction(inclusionFee);
      const sorobanData = new SorobanDataBuilder();
      sorobanData.setResourceFee(3);

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData,
        authEntries: [],
      };

      const result = await assembleTransaction(input);
      assertInstanceOf(result, Transaction);
      assertEquals(result.fee, "13");
    });

    it("preserves source sequence above Number.MAX_SAFE_INTEGER (2^53)", async () => {
      // Soroban sequence numbers are `ledger << 32 | n`. Once the ledger
      // passes ~2.1M, sequences exceed 2^53 and Number() loses precision.
      // Regression test: a build-output sequence of 9_771_475_800_162_306
      // must round-trip through assemble unchanged.
      const builtSeq = "9771475800162306";
      const account = new Account(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        // TransactionBuilder.build adds 1, so seed with builtSeq - 1
        (BigInt(builtSeq) - 1n).toString(),
      );
      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract:
              "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            function: "transfer",
            args: [],
          }),
        )
        .setTimeout(0)
        .build();

      assertEquals(transaction.sequence, builtSeq);

      const result = await assembleTransaction({
        transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      });

      assertEquals(result.sequence, builtSeq);
    });

    it("preserves extra signer preconditions", async () => {
      const extraSigner =
        "GD5PUITTMNVKWHSLXIWU732MOSEONSMYCXU3A5KS2USRWQONMYO5TTFN";
      const transaction = createTestTransaction("100", [extraSigner]);

      const result = await assembleTransaction({
        transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      });

      assertEquals(
        result.extraSigners?.map(SignerKey.encodeSignerKey),
        [extraSigner],
      );
    });

    it("executes with soroban data and auth entries", async () => {
      const transaction = createTestTransaction();
      const sorobanData = new SorobanDataBuilder();
      sorobanData.setResourceFee(1);

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData,
        authEntries: [],
      };

      const result = await assembleTransaction(input);
      assertInstanceOf(result, Transaction);
    });
  });

  describe("Errors", () => {
    it("throws UNEXPECTED_ERROR if an untracked error happens", async () => {
      const faultyInput = null as unknown as AssembleTransactionInput;

      await assertRejects(
        async () => await assembleTransaction(faultyInput),
        E.UNEXPECTED_ERROR,
      );
    });

    it("throws NOT_SMART_CONTRACT_TRANSACTION_ERROR for non-smart contract transaction", async () => {
      const account = new Account(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        "100",
      );

      const nonSmartContractTx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination:
              "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
            asset: Asset.native(),
            amount: "100",
          }),
        )
        .setTimeout(0)
        .build();

      const input: AssembleTransactionInput = {
        transaction: nonSmartContractTx,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      };

      await assertRejects(
        async () => await assembleTransaction(input),
        E.NOT_SMART_CONTRACT_TRANSACTION_ERROR,
      );
    });

    it("throws FAILED_TO_BUILD_SOROBAN_DATA_ERROR if soroban data build fails", async () => {
      const transaction = createTestTransaction();

      const corruptedSorobanData = "INVALID" as unknown as SorobanDataBuilder;

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData: corruptedSorobanData,
        authEntries: [],
      };

      await assertRejects(
        async () => await assembleTransaction(input),
        E.FAILED_TO_BUILD_SOROBAN_DATA_ERROR,
      );
    });

    it("throws FAILED_TO_ASSEMBLE_TRANSACTION_ERROR if the assembly fails", async () => {
      const transaction = createTestTransaction();
      // Stub the TransactionBuilder prototype's addOperation method
      const addOperationStub = stub(
        TransactionBuilder.prototype,
        "addOperation",
        () => {
          throw new Error("Mocked addOperation error");
        },
      );

      const input: AssembleTransactionInput = {
        transaction: transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      };

      await assertRejects(
        async () => await assembleTransaction(input),
        E.FAILED_TO_ASSEMBLE_TRANSACTION_ERROR,
      );

      addOperationStub.restore();
    });

    it("throws FAILED_TO_BUILD_TRANSACTION_ERROR if the transaction build fails", async () => {
      const transaction = createTestTransaction();
      const buildStub = stub(
        TransactionBuilder.prototype,
        "build",
        () => {
          throw new Error("Mocked build error");
        },
      );

      const input: AssembleTransactionInput = {
        transaction,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      };

      try {
        await assertRejects(
          async () => await assembleTransaction(input),
          E.FAILED_TO_BUILD_TRANSACTION_ERROR,
        );
      } finally {
        buildStub.restore();
      }
    });

    it("throws MISSING_ARG if the transaction input lacks a required arg", async () => {
      const tx = undefined as unknown as Transaction;

      const input: AssembleTransactionInput = {
        transaction: tx,
        sorobanData: new SorobanDataBuilder(),
        authEntries: [],
      };

      await assertRejects(
        async () => await assembleTransaction(input),
        E.MISSING_ARG,
      );
    });
  });
});
