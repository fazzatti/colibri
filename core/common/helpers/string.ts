// Refer to: https://github.com/hyperledger-cacti/cacti/blob/main/packages/cactus-common/src/main/typescript/strings.ts
// Refer to: https://github.com/hyperledger-cacti/cacti/blob/main/packages/cactus-common/src/main/typescript/checks.ts

import { ColibriError } from "@/error/index.ts";
import { isTruthy } from "@/common/helpers/boolean.ts";

enum ErrorCode {
  IS_BLANK_STRING = "HLP_STR_00",
}

const baseErrorSource = "@colibri/core/helpers";

export const isString = (val: unknown): val is string => {
  return typeof val === "string" || val instanceof String;
};

export const isNonBlank = (val: unknown): val is string => {
  if (!isString(val)) {
    return false;
  }
  return val.trim().length > 0;
};

export const dropNonPrintable = (val: string): string => {
  const fnTag = "Strings#dropNonPrintable()";
  isTruthy(isString(val), `${fnTag} Strings.isString(val)`);
  return val.replace(/[^ -~]+/g, "");
};

// Verifies that a string is indeed not a blank string.
// Blank string can be one that only has whitespace characters for example.
export const nonBlankString = (value: unknown, subject = "variable"): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    const message = `"${subject}" is a blank string. Need non-blank.`;
    throw ColibriError.unexpected({
      domain: "helpers",
      source: baseErrorSource + "/string",
      message,
      code: ErrorCode.IS_BLANK_STRING,
    });
  }
};
