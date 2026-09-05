import { TransactionBuilder } from "stellar-sdk";
import type {
  WrapFeeBumpInput,
  WrapFeeBumpOutput,
} from "@/processes/wrap-fee-bump/types.ts";
import * as E from "@/processes/wrap-fee-bump/error.ts";
import { isFeeBumpTransaction } from "@/common/type-guards/is-fee-bump-transaction.ts";
import { isTransaction } from "@/common/type-guards/is-transaction.ts";
import { assert } from "@/common/assert/assert.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import {
  getTransactionInclusionFee,
  MINIMUM_BASE_FEE,
} from "@/common/helpers/transaction-fee.ts";

/** Wraps a classic transaction inside a fee-bump envelope. */
export const wrapFeeBump = (input: WrapFeeBumpInput): WrapFeeBumpOutput => {
  try {
    const { transaction, config, networkPassphrase } = input;

    const args = {
      transaction,
      networkPassphrase,
      config,
      config_source: config.source,
      config_fee: config.fee,
    };

    assertRequiredArgs(
      args,
      (argName: string) => new E.MISSING_ARG(input, argName),
    );

    assert(!isFeeBumpTransaction(transaction), new E.ALREADY_FEE_BUMP(input));
    assert(isTransaction(transaction), new E.NOT_A_TRANSACTION(input));

    // Compare like units, excluding Soroban resources. The SDK performs the
    // authoritative exact-decimal validation below; preserve its accepted base
    // fee representations (including e.g. "100.0" and scientific notation).
    const baseFee = Number(config.fee);
    assert(
      baseFee >= Number(MINIMUM_BASE_FEE) &&
        baseFee * transaction.operations.length >=
          Number(getTransactionInclusionFee(transaction)),
      new E.FEE_TOO_LOW(input),
    );

    try {
      const feeBumpTransaction = TransactionBuilder.buildFeeBumpTransaction(
        config.source,
        config.fee,
        transaction,
        networkPassphrase,
      );

      return feeBumpTransaction;
    } catch (e) {
      throw new E.FAILED_TO_BUILD_FEE_BUMP(input, e as Error);
    }
  } catch (e) {
    if (e instanceof E.WrapFeeBumpError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};
/** Error constructors emitted by {@link wrapFeeBump}. */
export const WrapFeeBumpErrors: typeof E = E;
