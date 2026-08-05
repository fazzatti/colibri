import type { xdr } from "stellar-sdk";
import type {
  AssembleForEnforcementInput,
  AssembleForEnforcementOutput,
} from "@/processes/assemble-for-enforcement/types.ts";
import * as E from "@/processes/assemble-for-enforcement/error.ts";
import { AssembleTransactionError } from "@/processes/assemble-transaction/error.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { operationHasDelegatedAuthorization } from "@/common/helpers/xdr/operation-has-delegated-authorization.ts";

/**
 * Assembles signed delegated credentials into an intermediate transaction.
 *
 * Ordinary authorization operations pass through unchanged. Delegated
 * operations are assembled with the recording simulation's resources so that
 * the resulting transaction can undergo the mandatory enforcing simulation.
 */
export const assembleForEnforcement = async (
  input: AssembleForEnforcementInput,
): Promise<AssembleForEnforcementOutput> => {
  try {
    const { transaction, authorizedOperation, sorobanData, transactionFee } =
      input;

    assertRequiredArgs(
      { transaction },
      () => new E.MISSING_TRANSACTION(input),
    );
    assertRequiredArgs(
      { authorizedOperation },
      () => new E.MISSING_AUTHORIZED_OPERATION(input),
    );
    if (!operationHasDelegatedAuthorization(authorizedOperation)) {
      return transaction;
    }

    const authEntries = authorizedOperation.body()
      .invokeHostFunctionOp()
      .auth() as xdr.SorobanAuthorizationEntry[];

    return await assembleTransaction({
      transaction,
      authEntries,
      sorobanData,
      transactionFee,
    });
  } catch (error) {
    if (
      error instanceof E.AssembleForEnforcementError ||
      error instanceof AssembleTransactionError
    ) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(input, error as Error);
  }
};

/** Error constructors emitted by {@link assembleForEnforcement}. */
export const AssembleForEnforcementErrors: typeof E = E;
