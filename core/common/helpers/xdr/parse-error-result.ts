import type { xdr } from "stellar-sdk";
import { FAILED_TO_PARSE_ERROR_RESULT } from "@/common/helpers/xdr/error.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

/**
 * Parses a transaction error result into human-readable error strings.
 *
 * @param errorResult - The transaction result XDR to parse
 * @returns Array of error strings, or null if no error result provided
 * @throws {FAILED_TO_PARSE_ERROR_RESULT} If the error result format is unexpected
 */
export const parseErrorResult = (
  errorResult?: xdr.TransactionResult
): string[] | null => {
  if (!errorResult) return null;

  if (
    errorResult.result &&
    errorResult.result().switch &&
    errorResult.result().switch().name
  ) {
    return [errorResult.result().switch().name];
  }

  if (
    errorResult.result &&
    errorResult.result().results &&
    errorResult.result().results().flatMap
  ) {
    return errorResult
      .result()
      .results()
      .flatMap((r) => r.toString());
  }

  throw new FAILED_TO_PARSE_ERROR_RESULT(
    softTryToXDR(() => errorResult.toXDR("base64"))
  );
};
