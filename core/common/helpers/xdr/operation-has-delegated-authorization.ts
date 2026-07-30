import { xdr } from "stellar-sdk";

/**
 * Returns whether an invoke-host-function operation contains delegated Soroban
 * address credentials.
 *
 * @param operation - Operation to inspect.
 * @returns `true` when any authorization entry uses delegated credentials.
 */
export const operationHasDelegatedAuthorization = (
  operation: xdr.Operation,
): boolean => {
  if (
    operation.body().switch().value !==
      xdr.OperationType.invokeHostFunction().value
  ) {
    return false;
  }

  return operation.body().invokeHostFunctionOp().auth().some((entry) =>
    entry.credentials().switch().value ===
      xdr.SorobanCredentialsType.sorobanCredentialsAddressWithDelegates().value
  );
};
