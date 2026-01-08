/**
 * @module ledger-parser/error
 * @description Error definitions for the Ledger Parser module.
 */

import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type LedgerParserErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/**
 * Base error class for all ledger parser errors.
 *
 * Extends the Colibri error framework with ledger-parser specific error codes
 * and context. All LedgerParser errors follow the Colibri standard pattern.
 */
export abstract class LedgerParserError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/ledger-parser";
  override readonly meta: Meta;

  constructor(args: LedgerParserErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "core" as const,
      source: "@colibri/core/ledger-parser",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Error codes for the LedgerParser module.
 */
export enum Code {
  INVALID_LEDGER_ENTRY = "LDP_001",
  INVALID_HEADER_XDR = "LDP_002",
  INVALID_METADATA_XDR = "LDP_003",
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION = "LDP_004",
  INVALID_TRANSACTION_INDEX = "LDP_005",
  INVALID_OPERATION_INDEX = "LDP_006",
  UNSUPPORTED_OPERATION_TYPE = "LDP_007",
}

/**
 * Thrown when the LedgerEntry object is malformed.
 */
export class INVALID_LEDGER_ENTRY extends LedgerParserError {
  constructor(reason: string) {
    super({
      code: Code.INVALID_LEDGER_ENTRY,
      message: "Invalid LedgerEntry",
      details: `The provided LedgerEntry is invalid: ${reason}`,
      data: { reason },
    });
  }
}

/**
 * Thrown when header XDR decoding fails.
 */
export class INVALID_HEADER_XDR extends LedgerParserError {
  constructor(cause?: Error) {
    super({
      code: Code.INVALID_HEADER_XDR,
      message: "Invalid header XDR",
      details:
        "The headerXdr field could not be decoded. This may indicate corrupted data or an unsupported XDR format.",
      cause,
      data: {},
    });
  }
}

/**
 * Thrown when metadata XDR decoding fails.
 */
export class INVALID_METADATA_XDR extends LedgerParserError {
  constructor(cause?: Error) {
    super({
      code: Code.INVALID_METADATA_XDR,
      message: "Invalid metadata XDR",
      details:
        "The metadataXdr field could not be decoded. This may indicate corrupted data or an unsupported XDR format.",
      cause,
      data: {},
    });
  }
}

/**
 * Thrown when an unsupported LedgerCloseMeta version is encountered.
 *
 * Currently supports V0, V1, and V2. Future protocol upgrades may introduce new versions.
 */
export class UNSUPPORTED_LEDGER_CLOSE_META_VERSION extends LedgerParserError {
  constructor(version: string) {
    super({
      code: Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
      message: "Unsupported LedgerCloseMeta version",
      details: `LedgerCloseMeta version "${version}" is not supported. Supported versions: v0, v1, v2. Consider updating to a newer version of this library.`,
      data: { version },
    });
  }
}

/**
 * Thrown when attempting to access transaction data that doesn't exist.
 */
export class INVALID_TRANSACTION_INDEX extends LedgerParserError {
  constructor(index: number, ledgerSequence: number, maxIndex: number) {
    super({
      code: Code.INVALID_TRANSACTION_INDEX,
      message: "Invalid transaction index",
      details: `Transaction index ${index} is out of bounds for ledger ${ledgerSequence} (max index: ${maxIndex}).`,
      data: { index, ledgerSequence, maxIndex },
    });
  }
}

/**
 * Thrown when attempting to access operation data that doesn't exist.
 */
export class INVALID_OPERATION_INDEX extends LedgerParserError {
  constructor(index: number, transactionIndex: number, maxIndex: number) {
    super({
      code: Code.INVALID_OPERATION_INDEX,
      message: "Invalid operation index",
      details: `Operation index ${index} is out of bounds for transaction ${transactionIndex} (max index: ${maxIndex}).`,
      data: { index, transactionIndex, maxIndex },
    });
  }
}

/**
 * Thrown when encountering an unknown operation type.
 */
export class UNSUPPORTED_OPERATION_TYPE extends LedgerParserError {
  constructor(operationType: string) {
    super({
      code: Code.UNSUPPORTED_OPERATION_TYPE,
      message: "Unsupported operation type",
      details: `Operation type "${operationType}" is not recognized. This may indicate a new operation type from a protocol upgrade.`,
      data: { operationType },
    });
  }
}

/**
 * Export all error classes for convenience.
 */
export const ERROR_LDP = {
  [Code.INVALID_LEDGER_ENTRY]: INVALID_LEDGER_ENTRY,
  [Code.INVALID_HEADER_XDR]: INVALID_HEADER_XDR,
  [Code.INVALID_METADATA_XDR]: INVALID_METADATA_XDR,
  [Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION]:
    UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
  [Code.INVALID_TRANSACTION_INDEX]: INVALID_TRANSACTION_INDEX,
  [Code.INVALID_OPERATION_INDEX]: INVALID_OPERATION_INDEX,
  [Code.UNSUPPORTED_OPERATION_TYPE]: UNSUPPORTED_OPERATION_TYPE,
};
