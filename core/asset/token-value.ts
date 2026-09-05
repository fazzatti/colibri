import { scValToNative, type xdr } from "stellar-sdk";

/** Shared token-result boundary; callers retain their domain-specific errors. @internal */
export function decodeTokenValue<Output>(
  value: xdr.ScVal | undefined,
  missingValue: Error,
): Output {
  if (value === undefined || value === null) throw missingValue;
  return scValToNative(value) as Output;
}
