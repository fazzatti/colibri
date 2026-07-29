import type { xdr } from "stellar-sdk";
import type {
  PostAuthAssembleTransactionInput,
  PostAuthAssembleTransactionOutput,
} from "@/processes/post-auth-assemble-transaction/types.ts";
import * as E from "@/processes/post-auth-assemble-transaction/error.ts";
import { AssembleTransactionError } from "@/processes/assemble-transaction/error.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { hasDelegatedAuthorization } from "@/common/helpers/xdr/has-delegated-authorization.ts";

/**
 * Assembles signed delegated credentials into an intermediate transaction.
 *
 * Ordinary authorization operations pass through unchanged. Delegated
 * operations are assembled with the recording simulation's resources so that
 * the resulting transaction can undergo the mandatory enforcing simulation.
 */
export const postAuthAssembleTransaction = async (
  input: PostAuthAssembleTransactionInput,
): Promise<PostAuthAssembleTransactionOutput> => {
  try {
    const { transaction, authorizedOperation, sorobanData, resourceFee } =
      input;

    assertRequiredArgs(
      { transaction },
      () => new E.MISSING_TRANSACTION(input),
    );
    assertRequiredArgs(
      { authorizedOperation },
      () => new E.MISSING_AUTHORIZED_OPERATION(input),
    );
    assertRequiredArgs(
      { resourceFee },
      () => new E.MISSING_RESOURCE_FEE(input),
    );

    if (!hasDelegatedAuthorization(authorizedOperation)) return transaction;

    const authEntries = authorizedOperation.body()
      .invokeHostFunctionOp()
      .auth() as xdr.SorobanAuthorizationEntry[];

    return await assembleTransaction({
      transaction,
      authEntries,
      sorobanData,
      resourceFee,
    });
  } catch (error) {
    if (
      error instanceof E.PostAuthAssembleTransactionError ||
      error instanceof AssembleTransactionError
    ) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(input, error as Error);
  }
};

/** Error constructors emitted by {@link postAuthAssembleTransaction}. */
export const PostAuthAssembleTransactionErrors: typeof E = E;
