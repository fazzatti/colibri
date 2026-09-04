import { ColibriError } from "@/error/index.ts";

/** Stable error codes raised by the SEP-41 token client. */
export enum Code {
  MISSING_RETURN_VALUE = "SEP41_TOKEN_001",
  FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM = "SEP41_TOKEN_002",
  FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER = "SEP41_TOKEN_003",
  FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM = "SEP41_TOKEN_004",
  FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER = "SEP41_TOKEN_005",
  FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT = "SEP41_TOKEN_006",
  FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER = "SEP41_TOKEN_007",
  FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID = "SEP41_TOKEN_008",
  FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM = "SEP41_TOKEN_009",
  FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO = "SEP41_TOKEN_010",
  FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT = "SEP41_TOKEN_011",
  FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER = "SEP41_TOKEN_012",
  FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM = "SEP41_TOKEN_013",
  FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO = "SEP41_TOKEN_014",
  FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT = "SEP41_TOKEN_015",
  FAILED_TO_ENCODE_BURN_ARGUMENT_FROM = "SEP41_TOKEN_016",
  FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT = "SEP41_TOKEN_017",
  FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER = "SEP41_TOKEN_018",
  FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM = "SEP41_TOKEN_019",
  FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT = "SEP41_TOKEN_020",
}

/** Base class for errors raised by the SEP-41 token client. */
export abstract class SEP41TokenError extends ColibriError<
  Code,
  { cause: Error | null; data: unknown }
> {
  /** Creates a SEP-41 token client error. */
  constructor(args: {
    code: Code;
    message: string;
    details: string;
    data: unknown;
    cause?: Error;
  }) {
    super({
      domain: "contract",
      source: "@colibri/core/asset/sep41-token",
      code: args.code,
      message: args.message,
      details: args.details,
      meta: { cause: args.cause ?? null, data: args.data },
    });
  }
}

abstract class SEP41ArgumentEncodingError extends SEP41TokenError {
  constructor(
    code: Code,
    functionName: string,
    argumentName: string,
    stellarType: string,
    value: unknown,
    cause: Error,
  ) {
    super({
      code,
      message: `Failed to encode SEP-41 ${functionName} argument`,
      details:
        `The '${argumentName}' argument for SEP-41 '${functionName}' could not be encoded as '${stellarType}'. See the cause for more details.`,
      cause,
      data: { functionName, argumentName, stellarType, value },
    });
  }
}

/** Raised when a standardized read returns no value. */
export class MISSING_RETURN_VALUE extends SEP41TokenError {
  /** Creates the missing-return-value error for one SEP-41 method. */
  constructor(functionName: string) {
    super({
      code: Code.MISSING_RETURN_VALUE,
      message: "Missing SEP-41 return value",
      details:
        `The SEP-41 method '${functionName}' completed without its required return value.`,
      data: { functionName },
    });
  }
}

/** Raised when the `from` argument for `allowance` cannot be encoded. */
export class FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM,
      "allowance",
      "from",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `spender` argument for `allowance` cannot be encoded. */
export class FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER,
      "allowance",
      "spender",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `from` argument for `approve` cannot be encoded. */
export class FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM,
      "approve",
      "from",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `spender` argument for `approve` cannot be encoded. */
export class FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER,
      "approve",
      "spender",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `amount` argument for `approve` cannot be encoded. */
export class FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT,
      "approve",
      "amount",
      "i128",
      value,
      cause,
    );
  }
}

/** Raised when `liveUntilLedger` for `approve` cannot be encoded. */
export class FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER,
      "approve",
      "liveUntilLedger",
      "u32",
      value,
      cause,
    );
  }
}

/** Raised when the `id` argument for `balance` cannot be encoded. */
export class FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID,
      "balance",
      "id",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `from` argument for `transfer` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM,
      "transfer",
      "from",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `to` argument for `transfer` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO,
      "transfer",
      "to",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `amount` argument for `transfer` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT,
      "transfer",
      "amount",
      "i128",
      value,
      cause,
    );
  }
}

/** Raised when the `spender` argument for `transfer_from` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER,
      "transfer_from",
      "spender",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `from` argument for `transfer_from` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM,
      "transfer_from",
      "from",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `to` argument for `transfer_from` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO,
      "transfer_from",
      "to",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `amount` argument for `transfer_from` cannot be encoded. */
export class FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT,
      "transfer_from",
      "amount",
      "i128",
      value,
      cause,
    );
  }
}

/** Raised when the `from` argument for `burn` cannot be encoded. */
export class FAILED_TO_ENCODE_BURN_ARGUMENT_FROM
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_BURN_ARGUMENT_FROM,
      "burn",
      "from",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `amount` argument for `burn` cannot be encoded. */
export class FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT,
      "burn",
      "amount",
      "i128",
      value,
      cause,
    );
  }
}

/** Raised when the `spender` argument for `burn_from` cannot be encoded. */
export class FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER,
      "burn_from",
      "spender",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `from` argument for `burn_from` cannot be encoded. */
export class FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM,
      "burn_from",
      "from",
      "address",
      value,
      cause,
    );
  }
}

/** Raised when the `amount` argument for `burn_from` cannot be encoded. */
export class FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT
  extends SEP41ArgumentEncodingError {
  /** Creates the occurrence-specific argument encoding error. */
  constructor(value: unknown, cause: Error) {
    super(
      Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT,
      "burn_from",
      "amount",
      "i128",
      value,
      cause,
    );
  }
}

/** Error-code-to-constructor map for SEP-41 token client errors. */
export const ERRORS_SEP41_TOKEN = {
  [Code.MISSING_RETURN_VALUE]: MISSING_RETURN_VALUE,
  [Code.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM]:
    FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM,
  [Code.FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER]:
    FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER,
  [Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM]:
    FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM,
  [Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER]:
    FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER,
  [Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT]:
    FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT,
  [Code.FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER]:
    FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER,
  [Code.FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID]:
    FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID,
  [Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM]:
    FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM,
  [Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO]:
    FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO,
  [Code.FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT]:
    FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT,
  [Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER]:
    FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER,
  [Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM]:
    FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM,
  [Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO]:
    FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO,
  [Code.FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT]:
    FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT,
  [Code.FAILED_TO_ENCODE_BURN_ARGUMENT_FROM]:
    FAILED_TO_ENCODE_BURN_ARGUMENT_FROM,
  [Code.FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT]:
    FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT,
  [Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER]:
    FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER,
  [Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM]:
    FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM,
  [Code.FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT]:
    FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT,
} as const;
