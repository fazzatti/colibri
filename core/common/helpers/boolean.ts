import { ColibriError } from "../../error/index.ts";

enum ErrorCode {
  IS_FALSY = "HLP_BOOL_00",
}

// Refer to: https://github.com/hyperledger-cacti/cacti/blob/main/packages/cactus-common/src/main/typescript/bools.ts
// Refer to: https://github.com/hyperledger-cacti/cacti/blob/main/packages/cactus-common/src/main/typescript/checks.ts

//  Determines if a value is strictly a boolean `true` or `false`. Anything else
//  will result in the method returning `false`.
//
//  Useful in cases where you have an optional boolean parameter that you need
//  to assign a default value to by determining if it had been set or not.
export const isBooleanStrict = (val: unknown): boolean => {
  return val === true || val === false;
};

// Verifies that a boolean condition is met or throws an Error if it is not.
//
//  @param checkResult Determines the outcome of the check via it's truthyness.
//  @param subjectOfCheck The error message if `checkResult` is falsy.
//  @param code The code of the error if `checkResult is falsy.
export const isTruthy = (
  checkResult: unknown,
  subjectOfCheck = "variable"
): void => {
  if (!checkResult) {
    const message = `"${subjectOfCheck}" is falsy, need a truthy value.`;
    throw ColibriError.unexpected({
      domain: "helpers",
      source: "@colibri/core/helpers/boolean",
      message,
      code: ErrorCode.IS_FALSY,
    });
  }
};
