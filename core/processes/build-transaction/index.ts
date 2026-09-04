import {
  type BuildTransactionInput,
  type BuildTransactionOutput,
  NO_LIMIT,
  type TransactionPreconditions,
} from "@/processes/build-transaction/types.ts";
import * as E from "@/processes/build-transaction/error.ts";
import {
  Account,
  MuxedAccount,
  TransactionBuilder,
  type TransactionSource as StellarTransactionSource,
} from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import {
  getTransactionResourceFee,
  MAXIMUM_TRANSACTION_FEE,
  MINIMUM_BASE_FEE,
  type ParsedTransactionFee,
  parseTransactionFee,
  setTransactionFee,
  type TransactionFeeParseError,
} from "@/common/helpers/transaction-fee.ts";
import type { BaseFee } from "@/common/types/transaction-config/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import { muxedAddressToBaseAccount } from "@/address/muxed-to-base-account/index.ts";

type ExactTransactionFee = {
  mode: "inclusion" | "max";
  amount: bigint;
  minimumInclusionFee: bigint;
};

type ResolvedTransactionFee = {
  builderBaseFee: BaseFee;
  exactTransactionFee?: ExactTransactionFee;
};

const assertValidBuildInput = (input: BuildTransactionInput): void => {
  assert(
    input.operations && input.operations.length > 0,
    new E.NO_OPERATIONS_PROVIDED_ERROR(input),
  );
  assert(
    (input.baseFee === undefined) !== (input.transactionFee === undefined),
    new E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR(input),
  );
};

const throwTransactionFeeParseError = (
  input: BuildTransactionInput,
  error: TransactionFeeParseError,
): never => {
  if (error.reason === "invalid-configuration") {
    throw new E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR(input);
  }
  if (error.mode === "base") {
    throw new E.INVALID_BASE_FEE_ERROR(input, error.value);
  }
  if (error.mode === "inclusion") {
    throw new E.INVALID_INCLUSION_FEE_ERROR(input, error.value);
  }
  throw new E.INVALID_MAX_FEE_ERROR(input, error.value);
};

const resolveParsedTransactionFee = (
  input: BuildTransactionInput,
  fee: ParsedTransactionFee,
): ResolvedTransactionFee => {
  if (fee.mode === "base") {
    assert(fee.amount > 0n, new E.BASE_FEE_TOO_LOW_ERROR(input, fee.amount));
    return { builderBaseFee: fee.amount.toString() as BaseFee };
  }

  const minimumInclusionFee = MINIMUM_BASE_FEE *
    BigInt(input.operations.length);
  if (fee.mode === "inclusion") {
    assert(
      fee.amount >= minimumInclusionFee,
      new E.INCLUSION_FEE_TOO_LOW_ERROR(
        input,
        fee.amount,
        minimumInclusionFee,
      ),
    );
  }
  assert(
    fee.amount <= MAXIMUM_TRANSACTION_FEE,
    new E.TRANSACTION_FEE_TOO_HIGH_ERROR(input, fee.amount),
  );

  return {
    builderBaseFee: MINIMUM_BASE_FEE.toString() as BaseFee,
    exactTransactionFee: {
      mode: fee.mode,
      amount: fee.amount,
      minimumInclusionFee,
    },
  };
};

const resolveTransactionFee = (
  input: BuildTransactionInput,
): ResolvedTransactionFee => {
  if (input.baseFee !== undefined) {
    assert(
      !Number.isNaN(Number(input.baseFee)),
      new E.INVALID_BASE_FEE_ERROR(input),
    );
    assert(
      Number(input.baseFee) > 0,
      new E.BASE_FEE_TOO_LOW_ERROR(input),
    );
    return { builderBaseFee: input.baseFee };
  }

  const parsedFee = parseTransactionFee(input.transactionFee);
  if (!parsedFee.ok) {
    return throwTransactionFeeParseError(input, parsedFee.error);
  }
  return resolveParsedTransactionFee(input, parsedFee.value);
};

const loadSourceAccount = async (
  input: BuildTransactionInput,
): Promise<StellarTransactionSource> => {
  const muxedSource = StrKey.isMuxedAddress(input.source)
    ? input.source
    : undefined;
  let baseAccountAddress = input.source;
  if (muxedSource) {
    try {
      baseAccountAddress = muxedAddressToBaseAccount(muxedSource);
    } catch (error) {
      throw new E.INVALID_MUXED_SOURCE_ERROR(
        input,
        error as Error,
      );
    }
  }

  if (!input.sequence) {
    assert(input.rpc, new E.RPC_REQUIRED_TO_LOAD_ACCOUNT_ERROR(input));
    let account: Account;
    try {
      account = (await input.rpc.getAccount(baseAccountAddress)) as Account;
    } catch (error) {
      throw new E.COULD_NOT_LOAD_ACCOUNT_ERROR(input, error as Error);
    }
    if (!muxedSource) return account;

    try {
      return MuxedAccount.fromAddress(muxedSource, account.sequenceNumber());
    } catch (error) {
      throw new E.INVALID_MUXED_SOURCE_RPC_SEQUENCE_ERROR(
        input,
        error as Error,
      );
    }
  }

  if (muxedSource) {
    try {
      return MuxedAccount.fromAddress(muxedSource, input.sequence);
    } catch (error) {
      throw new E.INVALID_MUXED_SOURCE_SEQUENCE_ERROR(
        input,
        error as Error,
      );
    }
  }

  try {
    return new Account(input.source, input.sequence);
  } catch (error) {
    throw new E.COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE_ERROR(
      input,
      error as Error,
    );
  }
};

const createTransactionBuilder = (
  input: BuildTransactionInput,
  sourceAccount: StellarTransactionSource,
  fee: BaseFee,
): TransactionBuilder => {
  try {
    return new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase: input.networkPassphrase,
    });
  } catch (error) {
    throw new E.COULD_NOT_CREATE_TRANSACTION_BUILDER_ERROR(
      input,
      error as Error,
    );
  }
};

const setSorobanData = (
  input: BuildTransactionInput,
  builder: TransactionBuilder,
): void => {
  if (!input.sorobanData) return;
  try {
    builder.setSorobanData(input.sorobanData);
  } catch (error) {
    throw new E.COULD_NOT_SET_SOROBAN_DATA_ERROR(input, error as Error);
  }
};

const setPreconditions = (
  input: BuildTransactionInput,
  builder: TransactionBuilder,
): TransactionBuilder => {
  if (!input.preconditions) return builder;
  assert(
    !(input.preconditions.timeBounds && input.preconditions.timeoutSeconds),
    new E.CONFLICTING_TIME_CONSTRAINTS_ERROR(input),
  );
  try {
    return appendPreconditions(builder, input.preconditions);
  } catch (error) {
    throw new E.FAILED_TO_SET_PRECONDITIONS_ERROR(input, error as Error);
  }
};

const configureTransactionBuilder = (
  input: BuildTransactionInput,
  initialBuilder: TransactionBuilder,
): TransactionBuilder => {
  setSorobanData(input, initialBuilder);
  const builder = setPreconditions(input, initialBuilder);
  const hasTimeout = input.preconditions?.timeBounds ||
    input.preconditions?.timeoutSeconds;
  if (!hasTimeout) builder.setTimeout(NO_LIMIT);
  if (input.memo) builder.addMemo(input.memo);
  for (const operation of input.operations) builder.addOperation(operation);
  return builder;
};

const buildConfiguredTransaction = (
  input: BuildTransactionInput,
  builder: TransactionBuilder,
): BuildTransactionOutput => {
  try {
    return builder.build() as BuildTransactionOutput;
  } catch (error) {
    throw new E.COULD_NOT_BUILD_TRANSACTION_ERROR(input, error as Error);
  }
};

const applyExactTransactionFee = (
  input: BuildTransactionInput,
  transaction: BuildTransactionOutput,
  exactFee?: ExactTransactionFee,
): BuildTransactionOutput => {
  if (exactFee === undefined) return transaction;

  const resourceFee = getTransactionResourceFee(transaction);
  const finalTransactionFee = exactFee.mode === "inclusion"
    ? exactFee.amount + resourceFee
    : exactFee.amount;
  if (exactFee.mode === "max") {
    const minimumTransactionFee = exactFee.minimumInclusionFee + resourceFee;
    assert(
      exactFee.amount >= minimumTransactionFee,
      new E.MAX_FEE_TOO_LOW_ERROR(
        input,
        exactFee.amount,
        minimumTransactionFee,
      ),
    );
  }
  assert(
    finalTransactionFee <= MAXIMUM_TRANSACTION_FEE,
    new E.TRANSACTION_FEE_TOO_HIGH_ERROR(input, finalTransactionFee),
  );
  return setTransactionFee(transaction, finalTransactionFee);
};

/** Builds a transaction envelope from operations and transaction configuration. */
export const buildTransaction = async (
  input: BuildTransactionInput,
): Promise<BuildTransactionOutput> => {
  try {
    assertValidBuildInput(input);
    const { builderBaseFee, exactTransactionFee } = resolveTransactionFee(
      input,
    );
    const sourceAccount = await loadSourceAccount(input);
    const initialBuilder = createTransactionBuilder(
      input,
      sourceAccount,
      builderBaseFee,
    );
    const builder = configureTransactionBuilder(input, initialBuilder);
    const transaction = buildConfiguredTransaction(input, builder);
    return applyExactTransactionFee(input, transaction, exactTransactionFee);
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
