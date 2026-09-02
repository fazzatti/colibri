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

  const result = errorResult.result as unknown as {
    type?: string;
    results?: { toString(): string }[];
  };

  if (result?.type) {
    return [result.type];
  }

  if (result?.results && Array.isArray(result.results)) {
    return result.results.flatMap((operationResult) =>
      operationResult.toString()
    );
  }

  throw new FAILED_TO_PARSE_ERROR_RESULT(
    softTryToXDR(() => errorResult.toXdr("base64"))
  );
};
