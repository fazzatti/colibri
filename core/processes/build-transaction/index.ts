import {
  type BuildTransactionInput,
  type BuildTransactionOutput,
  NO_LIMIT,
  type TransactionPreconditions,
} from "@/processes/build-transaction/types.ts";
import * as E from "@/processes/build-transaction/error.ts";
import { Account, TransactionBuilder } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import {
  getTransactionResourceFee,
  MAXIMUM_TRANSACTION_FEE,
  MINIMUM_BASE_FEE,
  parseTransactionFee,
  setTransactionFee,
} from "@/common/helpers/transaction-fee.ts";
import type { BaseFee } from "@/common/types/transaction-config/types.ts";

/** Builds a transaction envelope from operations and transaction configuration. */
export const buildTransaction = async (
  input: BuildTransactionInput,
): Promise<BuildTransactionOutput> => {
  try {
    const {
      rpc,
      operations,
      source,
      baseFee,
      transactionFee,
      networkPassphrase,
      sequence,
      sorobanData,
      memo,
      preconditions,
    } = input;

    assert(
      operations && operations.length > 0,
      new E.NO_OPERATIONS_PROVIDED_ERROR(input),
    );

    assert(
      (baseFee === undefined) !== (transactionFee === undefined),
      new E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR(input),
    );

    let builderBaseFee: BaseFee;
    let exactTransactionFee:
      | {
        mode: "inclusion" | "max";
        amount: bigint;
        minimumInclusionFee: bigint;
      }
      | undefined;

    if (baseFee !== undefined) {
      assert(
        !Number.isNaN(Number(baseFee)),
        new E.INVALID_BASE_FEE_ERROR(input),
      );
      assert(Number(baseFee) > 0, new E.BASE_FEE_TOO_LOW_ERROR(input));
      builderBaseFee = baseFee;
    } else {
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
        builderBaseFee = amount.toString() as BaseFee;
      } else {
        const minimumInclusionFee = MINIMUM_BASE_FEE *
          BigInt(operations.length);
        if (mode === "inclusion") {
          assert(
            amount >= minimumInclusionFee,
            new E.INCLUSION_FEE_TOO_LOW_ERROR(
              input,
              amount,
              minimumInclusionFee,
            ),
          );
        }
        assert(
          amount <= MAXIMUM_TRANSACTION_FEE,
          new E.TRANSACTION_FEE_TOO_HIGH_ERROR(input, amount),
        );

        builderBaseFee = MINIMUM_BASE_FEE.toString() as BaseFee;
        exactTransactionFee = { mode, amount, minimumInclusionFee };
      }
    }

    let sourceAccount: Account;

    if (!sequence) {
      assert(rpc, new E.RPC_REQUIRED_TO_LOAD_ACCOUNT_ERROR(input));

      try {
        sourceAccount = (await rpc.getAccount(source)) as Account;
      } catch (e) {
        throw new E.COULD_NOT_LOAD_ACCOUNT_ERROR(input, e as Error);
      }
    } else {
      try {
        sourceAccount = new Account(source, sequence);
      } catch (e) {
        throw new E.COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE_ERROR(
          input,
          e as Error,
        );
      }
    }

    let tx: TransactionBuilder;
    try {
      tx = new TransactionBuilder(sourceAccount, {
        fee: builderBaseFee,
        networkPassphrase: networkPassphrase,
      });
    } catch (e) {
      throw new E.COULD_NOT_CREATE_TRANSACTION_BUILDER_ERROR(input, e as Error);
    }

    if (sorobanData) {
      try {
        tx.setSorobanData(sorobanData);
      } catch (e) {
        throw new E.COULD_NOT_SET_SOROBAN_DATA_ERROR(input, e as Error);
      }
    }

    if (preconditions) {
      assert(
        !(preconditions.timeBounds && preconditions.timeoutSeconds),
        new E.CONFLICTING_TIME_CONSTRAINTS_ERROR(input),
      );

      try {
        tx = appendPreconditions(tx, preconditions);
      } catch (e) {
        throw new E.FAILED_TO_SET_PRECONDITIONS_ERROR(input, e as Error);
      }
    }

    const isTimeoutNotDefined = !preconditions ||
      (!preconditions.timeBounds && !preconditions.timeoutSeconds);

    // An explicit timeout is always required
    // even if no limits are set or different
    // bounds are used
    if (isTimeoutNotDefined) tx.setTimeout(NO_LIMIT);

    if (memo) {
      tx.addMemo(memo);
    }

    for (const operation of operations) {
      tx.addOperation(operation);
    }

    let builtTransaction: BuildTransactionOutput;
    try {
      builtTransaction = tx.build() as BuildTransactionOutput;
    } catch (e) {
      throw new E.COULD_NOT_BUILD_TRANSACTION_ERROR(input, e as Error);
    }

    if (exactTransactionFee === undefined) return builtTransaction;

    const resourceFee = getTransactionResourceFee(builtTransaction);
    const { mode, amount, minimumInclusionFee } = exactTransactionFee;
    const finalTransactionFee = mode === "inclusion"
      ? amount + resourceFee
      : amount;

    if (mode === "max") {
      const minimumTransactionFee = minimumInclusionFee + resourceFee;
      assert(
        amount >= minimumTransactionFee,
        new E.MAX_FEE_TOO_LOW_ERROR(
          input,
          amount,
          minimumTransactionFee,
        ),
      );
    }

    assert(
      finalTransactionFee <= MAXIMUM_TRANSACTION_FEE,
      new E.TRANSACTION_FEE_TOO_HIGH_ERROR(input, finalTransactionFee),
    );

    return setTransactionFee(builtTransaction, finalTransactionFee);
  } catch (e) {
    if (e instanceof E.BuildTransactionError) {
      throw e;
    }

    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const appendPreconditions = (
  tx: TransactionBuilder,
  preconditions: TransactionPreconditions,
): TransactionBuilder => {
  const {
    ledgerBounds,
    minAccountSequence,
    minAccountSequenceAge,
    minAccountSequenceLedgerGap,
    extraSigners,
    timeBounds,
    timeoutSeconds,
  } = preconditions;

  if (minAccountSequence) {
    tx.setMinAccountSequence(minAccountSequence);
  }

  if (minAccountSequenceAge) {
    tx.setMinAccountSequenceAge(minAccountSequenceAge);
  }

  if (minAccountSequenceLedgerGap) {
    tx.setMinAccountSequenceLedgerGap(minAccountSequenceLedgerGap);
  }

  if (extraSigners) {
    tx.setExtraSigners(extraSigners);
  }

  if (ledgerBounds) {
    tx.setLedgerbounds(
      ledgerBounds.minLedger || NO_LIMIT,
      ledgerBounds.maxLedger || NO_LIMIT,
    );
  }

  if (timeBounds) {
    tx.setTimebounds(
      timeBounds.minTime || NO_LIMIT,
      timeBounds.maxTime || NO_LIMIT,
    );
  }

  if (timeoutSeconds) {
    tx.setTimeout(timeoutSeconds);
  }
  return tx;
};

/** Error constructors emitted by {@link buildTransaction}. */
export const BuildTransactionErrors: typeof E = E;
