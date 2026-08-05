import {
  Account,
  Operation,
  SignerKey,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "@/processes/assemble-transaction/types.ts";
import * as E from "@/processes/assemble-transaction/error.ts";

import { assert } from "@/common/assert/assert.ts";
import { isSmartContractTransaction } from "@/common/type-guards/is-smart-contract-transaction.ts";
import {
  getOperationsFromTransaction,
  getOperationType,
} from "@/common/helpers/transaction.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import {
  getTransactionInclusionFee,
  getTransactionResourceFee,
  MAXIMUM_TRANSACTION_FEE,
  MINIMUM_BASE_FEE,
  parseTransactionFee,
} from "@/common/helpers/transaction-fee.ts";

/** Reassembles simulated Soroban auth entries into a final transaction envelope. */
export const assembleTransaction = async (
  input: AssembleTransactionInput,
): Promise<AssembleTransactionOutput> => {
  try {
    const { transaction, sorobanData, authEntries } = input;

    assertRequiredArgs(
      { transaction },
      (argName: string) => new E.MISSING_ARG(input, argName),
    );

    assert(
      isSmartContractTransaction(transaction),
      new E.NOT_SMART_CONTRACT_TRANSACTION_ERROR(input),
    );

    const op = getOperationsFromTransaction(transaction)[0];
    const opType = getOperationType(op);

    assert(
      opType === "invokeHostFunction",
      new E.UNSUPPORTED_OPERATION_ERROR(input, opType),
    );

    const authorizedOperation = Operation.invokeHostFunction({
      func: op.body().invokeHostFunctionOp().hostFunction(),
      auth: authEntries,
    });

    // Use BigInt math: Soroban sequence numbers are `ledger << 32 | n`, which
    // exceeds Number.MAX_SAFE_INTEGER (2^53 - 1) once the ledger passes ~2.1M.
    // `Number(seq) - 1` silently rounds to the nearest representable double,
    // producing the wrong source seq and causing `txBadSeq` on submission.
    const sourceAccount = new Account(
      transaction.source,
      (BigInt(transaction.sequence) - 1n).toString(),
    );

    let builtSorobanData: xdr.SorobanTransactionData | undefined;
    try {
      builtSorobanData = sorobanData?.build();
    } catch (error) {
      throw new E.FAILED_TO_BUILD_SOROBAN_DATA_ERROR(input, error as Error);
    }

    const resourceFee = builtSorobanData?.resourceFee().toBigInt() ?? 0n;
    const inclusionFee = resolveInclusionFee(input, resourceFee);

    let assembledTransaction;
    try {
      assembledTransaction = new TransactionBuilder(sourceAccount, {
        fee: inclusionFee.toString(),
        memo: transaction.memo,
        networkPassphrase: transaction.networkPassphrase,
        timebounds: transaction.timeBounds,
        ledgerbounds: transaction.ledgerBounds,
        minAccountSequence: transaction.minAccountSequence,
        minAccountSequenceAge: transaction.minAccountSequenceAge,
        minAccountSequenceLedgerGap: transaction.minAccountSequenceLedgerGap,
        extraSigners: transaction.extraSigners?.map(SignerKey.encodeSignerKey),
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

const resolveInclusionFee = (
  input: AssembleTransactionInput,
  resourceFee: bigint,
): bigint => {
  const { transaction, transactionFee } = input;
  const currentResourceFee = getTransactionResourceFee(transaction);
  const currentInclusionFee = getTransactionInclusionFee(transaction);

  assert(
    currentInclusionFee >= 0n,
    new E.TRANSACTION_FEE_BELOW_RESOURCE_FEE_ERROR(
      input,
      BigInt(transaction.fee),
      currentResourceFee,
    ),
  );

  let inclusionFee = currentInclusionFee;
  if (transactionFee !== undefined) {
    const parsedFee = parseTransactionFee(transactionFee);
    if (!parsedFee.ok) {
      if (parsedFee.error.reason === "invalid-configuration") {
        throw new E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR(input);
      }
      if (parsedFee.error.mode === "base") {
        throw new E.INVALID_BASE_FEE_ERROR(input, parsedFee.error.value);
      }
      if (parsedFee.error.mode === "inclusion") {
        throw new E.INVALID_INCLUSION_FEE_ERROR(
          input,
          parsedFee.error.value,
        );
      }
      throw new E.INVALID_MAX_FEE_ERROR(input, parsedFee.error.value);
    }

    const { mode, amount } = parsedFee.value;
    if (mode === "base") {
      assert(amount > 0n, new E.BASE_FEE_TOO_LOW_ERROR(input, amount));
      inclusionFee = amount;
    } else if (mode === "inclusion") {
      assert(
        amount >= MINIMUM_BASE_FEE,
        new E.INCLUSION_FEE_TOO_LOW_ERROR(input, amount),
      );
      inclusionFee = amount;
    } else {
      assert(
        amount >= resourceFee + MINIMUM_BASE_FEE,
        new E.MAX_FEE_TOO_LOW_ERROR(input, amount, resourceFee),
      );
      inclusionFee = amount - resourceFee;
    }
  }

  const totalFee = inclusionFee + resourceFee;
  assert(
    totalFee <= MAXIMUM_TRANSACTION_FEE,
    new E.TRANSACTION_FEE_TOO_HIGH_ERROR(input, totalFee),
  );

  return inclusionFee;
};
/** Error constructors emitted by {@link assembleTransaction}. */
export const AssembleTransactionErrors: typeof E = E;
