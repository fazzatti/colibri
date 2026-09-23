import {
  Account,
  Operation,
  SignerKey,
  SorobanDataBuilder,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "@/processes/assemble-transaction/types.ts";
import * as ERROR from "@/processes/assemble-transaction/error.ts";
import * as RESOURCE_ERROR from "@/resources/error.ts";
import { applyResourceConfig } from "@/resources/policy.ts";

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
      (argName: string) => new ERROR.MISSING_ARG(input, argName),
    );

    assert(
      isSmartContractTransaction(transaction),
      new ERROR.NOT_SMART_CONTRACT_TRANSACTION_ERROR(input),
    );

    const op = getOperationsFromTransaction(transaction)[0];
    const opType = getOperationType(op);

    assert(
      opType === "invokeHostFunction",
      new ERROR.UNSUPPORTED_OPERATION_ERROR(input, opType),
    );

    const body = op.body;
    assert(
      body.type === "invokeHostFunction",
      new ERROR.UNSUPPORTED_OPERATION_ERROR(input, body.type),
    );
    const authorizedOperation = Operation.invokeHostFunction({
      func: body.invokeHostFunctionOp.hostFunction,
      auth: authEntries,
      source: transaction.operations[0].source,
    });

    // Use BigInt math: Soroban sequence numbers are `ledger << 32 | n`, which
    // exceeds Number.MAX_SAFE_INTEGER (2^53 - 1) once the ledger passes ~2.1M.
    // `Number(seq) - 1` silently rounds to the nearest representable double,
    // producing the wrong source seq and causing `txBadSeq` on submission.
    const sourceAccount = new Account(
      transaction.source,
      (BigInt(transaction.sequence) - 1n).toString(),
    );

    const builtSorobanData = buildSorobanData(input, sorobanData);

    const resourceFee = builtSorobanData?.resourceFee ?? 0n;
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
      throw new ERROR.FAILED_TO_ASSEMBLE_TRANSACTION_ERROR(
        input,
        error as Error,
      );
    }

    let builtTransaction;
    try {
      builtTransaction = await assembledTransaction.build();
    } catch (error) {
      throw new ERROR.FAILED_TO_BUILD_TRANSACTION_ERROR(input, error as Error);
    }

    return builtTransaction;
  } catch (e) {
    if (
      e instanceof ERROR.AssembleTransactionError ||
      e instanceof RESOURCE_ERROR.ResourceError
    ) {
      throw e;
    }
    throw new ERROR.UNEXPECTED_ERROR(input, e as Error);
  }
};

const buildSorobanData = (
  input: AssembleTransactionInput,
  sorobanData: SorobanDataBuilder | undefined,
): xdr.SorobanTransactionData | undefined => {
  let simulatedSorobanData: xdr.SorobanTransactionData | undefined;
  try {
    simulatedSorobanData = sorobanData?.build();
  } catch (error) {
    throw new ERROR.FAILED_TO_BUILD_SOROBAN_DATA_ERROR(input, error as Error);
  }

  const { resourceFee } = input;
  if (input.resources !== undefined) {
    if (resourceFee !== undefined) {
      throw new RESOURCE_ERROR.INVALID_CONFIGURATION(
        "resources with legacy resourceFee",
        resourceFee,
      );
    }
    return applyResourceConfig(simulatedSorobanData, input.resources);
  }
  if (resourceFee === undefined) {
    return simulatedSorobanData;
  }

  assert(
    typeof resourceFee === "string" && /^\d+$/.test(resourceFee),
    new ERROR.INVALID_RESOURCE_FEE_ERROR(input, resourceFee),
  );

  const override = BigInt(resourceFee);
  const simulatedMinimum = simulatedSorobanData?.resourceFee ?? 0n;
  assert(
    override >= simulatedMinimum,
    new ERROR.RESOURCE_FEE_BELOW_SIMULATED_MINIMUM_ERROR(
      input,
      override,
      simulatedMinimum,
    ),
  );
  assert(
    override <= MAXIMUM_TRANSACTION_FEE,
    new ERROR.TRANSACTION_FEE_TOO_HIGH_ERROR(input, override),
  );

  return new SorobanDataBuilder(simulatedSorobanData)
    .setResourceFee(resourceFee)
    .build();
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
    new ERROR.TRANSACTION_FEE_BELOW_RESOURCE_FEE_ERROR(
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
        throw new ERROR.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR(input);
      }
      if (parsedFee.error.mode === "base") {
        throw new ERROR.INVALID_BASE_FEE_ERROR(input, parsedFee.error.value);
      }
      if (parsedFee.error.mode === "inclusion") {
        throw new ERROR.INVALID_INCLUSION_FEE_ERROR(
          input,
          parsedFee.error.value,
        );
      }
      throw new ERROR.INVALID_MAX_FEE_ERROR(input, parsedFee.error.value);
    }

    const { mode, amount } = parsedFee.value;
    if (mode === "base") {
      assert(amount > 0n, new ERROR.BASE_FEE_TOO_LOW_ERROR(input, amount));
      inclusionFee = amount;
    } else if (mode === "inclusion") {
      assert(
        amount >= MINIMUM_BASE_FEE,
        new ERROR.INCLUSION_FEE_TOO_LOW_ERROR(input, amount),
      );
      inclusionFee = amount;
    } else {
      assert(
        amount >= resourceFee + MINIMUM_BASE_FEE,
        new ERROR.MAX_FEE_TOO_LOW_ERROR(input, amount, resourceFee),
      );
      inclusionFee = amount - resourceFee;
    }
  }

  const totalFee = inclusionFee + resourceFee;
  assert(
    totalFee <= MAXIMUM_TRANSACTION_FEE,
    new ERROR.TRANSACTION_FEE_TOO_HIGH_ERROR(input, totalFee),
  );

  return inclusionFee;
};
/** Error constructors emitted by {@link assembleTransaction}. */
export const AssembleTransactionErrors: typeof ERROR = ERROR;
