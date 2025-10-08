import { ProcessEngine } from "convee";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "./types.ts";
import * as E from "./error.ts";

import { assert } from "../../common/assert/assert.ts";
import { isSmartContractTransaction } from "../../common/verifiers/is-smart-contract-transaction.ts";
import {
  getOperationsFromTransaction,
  getOperationType,
} from "../../common/helpers/transaction.ts";
import { Account, Operation, TransactionBuilder, type xdr } from "stellar-sdk";

const assembleTransactionProcess = async (
  input: AssembleTransactionInput
): Promise<AssembleTransactionOutput> => {
  try {
    const { transaction, sorobanData, authEntries } = input;

    assert(
      isSmartContractTransaction(transaction),
      new E.NOT_SMART_CONTRACT_TRANSACTION_ERROR(input)
    );

    const op = getOperationsFromTransaction(transaction)[0];
    const opType = getOperationType(op);

    assert(
      opType === "invokeHostFunction",
      new E.UNSUPPORTED_OPERATION_ERROR(input, opType)
    );

    const authorizedOperation = Operation.invokeHostFunction({
      func: op.body().invokeHostFunctionOp().hostFunction(),
      auth: authEntries,
    });

    const sourceAccount = new Account(
      transaction.source,
      (Number(transaction.sequence) - 1).toString()
    );

    let builtSorobanData: xdr.SorobanTransactionData | undefined;
    try {
      builtSorobanData = sorobanData?.build();
    } catch (error) {
      throw new E.FAILED_TO_BUILD_SOROBAN_DATA_ERROR(input, error as Error);
    }

    let assembledTransaction;
    try {
      assembledTransaction = new TransactionBuilder(sourceAccount, {
        fee: transaction.fee,
        memo: transaction.memo,
        networkPassphrase: transaction.networkPassphrase,
        timebounds: transaction.timeBounds,
        ledgerbounds: transaction.ledgerBounds,
        minAccountSequence: transaction.minAccountSequence,
        minAccountSequenceAge: transaction.minAccountSequenceAge,
        minAccountSequenceLedgerGap: transaction.minAccountSequenceLedgerGap,
        extraSigners: transaction.extraSigners,
        sorobanData: builtSorobanData,
      });

      assembledTransaction.addOperation(authorizedOperation);
    } catch (error) {
      throw new E.FAILED_TO_ASSEMBLE_TRANSACTION_ERROR(input, error as Error);
    }

    let builtTransaction;
    try {
      builtTransaction = await assembledTransaction.build();
    } catch (error) {
      throw new E.FAILED_TO_BUILD_TRANSACTION_ERROR(input, error as Error);
    }

    return builtTransaction;
  } catch (e) {
    if (e instanceof E.AssembleTransactionError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const AssembleTransaction = ProcessEngine.create<
  AssembleTransactionInput,
  AssembleTransactionOutput,
  E.AssembleTransactionError
>(assembleTransactionProcess, {
  name: "AssembleTransaction",
});

export { AssembleTransaction };
