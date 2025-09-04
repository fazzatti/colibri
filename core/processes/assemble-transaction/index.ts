import { ProcessEngine } from "convee";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "./types.ts";
import * as E from "./error.ts";

import { assembleTransaction } from "stellar-sdk/rpc";

const assembleTransactionProcess = async (
  input: AssembleTransactionInput
): Promise<AssembleTransactionOutput> => {
  try {
    const { transaction, simulationResponse } = input;

    let assembledTransaction;
    try {
      assembledTransaction = await assembleTransaction(
        transaction,
        simulationResponse
      );
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

export const AssembleTransaction = ProcessEngine.create<
  AssembleTransactionInput,
  AssembleTransactionOutput,
  E.AssembleTransactionError
>(assembleTransactionProcess, {
  name: "AssembleTransaction",
});
