import { ProcessEngine } from "convee";
import {
  NO_LIMIT,
  type BuildTransactionInput,
  type BuildTransactionOutput,
  type TransactionPreconditions,
} from "./types.ts";
import * as E from "./error.ts";
import { Account, TransactionBuilder } from "stellar-sdk";
import { assert } from "../../common/assert/assert.ts";

const buildTransactionProcess = async (
  input: BuildTransactionInput
): Promise<BuildTransactionOutput> => {
  try {
    const {
      rpc,
      operations,
      source,
      baseFee,
      networkPassphrase,
      sequence,
      sorobanData,
      memo,
      preconditions,
    } = input;

    assert(!Number.isNaN(Number(baseFee)), new E.INVALID_BASE_FEE_ERROR(input));
    assert(Number(baseFee) > 0, new E.BASE_FEE_TOO_LOW_ERROR(input));

    assert(
      operations && operations.length > 0,
      new E.NO_OPERATIONS_PROVIDED_ERROR(input)
    );

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
          e as Error
        );
      }
    }

    let tx: TransactionBuilder;
    try {
      tx = new TransactionBuilder(sourceAccount, {
        fee: baseFee,
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
        new E.CONFLICTING_TIME_CONSTRAINTS_ERROR(input)
      );

      try {
        tx = appendPreconditions(tx, preconditions);
      } catch (e) {
        throw new E.FAILED_TO_SET_PRECONDITIONS_ERROR(input, e as Error);
      }
    }

    const isTimeoutNotDefined =
      !preconditions ||
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

    try {
      return tx.build() as BuildTransactionOutput;
    } catch (e) {
      throw new E.COULD_NOT_BUILD_TRANSACTION_ERROR(input, e as Error);
    }
  } catch (e) {
    if (e instanceof E.BuildTransactionError) {
      throw e;
    }

    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const appendPreconditions = (
  tx: TransactionBuilder,
  preconditions: TransactionPreconditions
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
      ledgerBounds.maxLedger || NO_LIMIT
    );
  }

  if (timeBounds) {
    tx.setTimebounds(
      timeBounds.minTime || NO_LIMIT,
      timeBounds.maxTime || NO_LIMIT
    );
  }

  if (timeoutSeconds) {
    tx.setTimeout(timeoutSeconds);
  }
  return tx;
};

const BuildTransaction = ProcessEngine.create<
  BuildTransactionInput,
  BuildTransactionOutput,
  E.BuildTransactionError
>(buildTransactionProcess, {
  name: "BuildTransaction",
});

export { BuildTransaction };
