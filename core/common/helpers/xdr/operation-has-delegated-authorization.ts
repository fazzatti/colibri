import type { xdr } from "stellar-sdk";

/**
 * Returns whether an invoke-host-function operation contains delegated Soroban
 * address credentials.
 *
 * @param operation - Operation to inspect.
 * @returns `true` when any authorization entry uses delegated credentials.
 */
export const operationHasDelegatedAuthorization = (
  operation: xdr.Operation,
): operation is xdr.Operation & {
  readonly body: xdr.OperationBodyInvokeHostFunction;
} => {
  if (operation.body.type !== "invokeHostFunction") {
    return false;
  }

  return operation.body.invokeHostFunctionOp.auth.some((entry) =>
    entry.credentials.type === "sorobanCredentialsAddressWithDelegates"
  );
};
