import { ProcessEngine } from "convee";
import type { WrapFeeBumpInput, WrapFeeBumpOutput } from "./types.ts";
import * as E from "./error.ts";

import { isFeeBumpTransaction } from "../../common/verifiers/is-fee-bump-transaction.ts";
import { isTransaction } from "../../common/verifiers/is-transaction.ts";

import { assert } from "../../common/assert/assert.ts";
import { TransactionBuilder } from "stellar-sdk";
import { assertRequiredArgs } from "../../common/assert/assert-args.ts";

const wrapFeeBumpProcess = (input: WrapFeeBumpInput): WrapFeeBumpOutput => {
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
      (argName: string) => new E.MISSING_ARG(input, argName)
    );

    assert(!isFeeBumpTransaction(transaction), new E.ALREADY_FEE_BUMP(input));
    assert(isTransaction(transaction), new E.NOT_A_TRANSACTION(input));

    assert(
      parseInt(config.fee) > parseInt(transaction.fee),
      new E.FEE_TOO_LOW(input)
    );

    try {
      const feeBumpTransaction = TransactionBuilder.buildFeeBumpTransaction(
        config.source,
        config.fee,
        transaction,
        networkPassphrase
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

const PROCESS_NAME = "WrapFeeBump" as const;

const P_WrapFeeBump = () =>
  ProcessEngine.create<
    WrapFeeBumpInput,
    WrapFeeBumpOutput,
    E.WrapFeeBumpError,
    typeof PROCESS_NAME
  >(wrapFeeBumpProcess, {
    name: PROCESS_NAME,
  });

const P_WrapFeeBumpErrors = E;

export { P_WrapFeeBump, P_WrapFeeBumpErrors };
