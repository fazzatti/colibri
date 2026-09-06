/**
 * @module ledger-parser/error
 * @description Error definitions for the Ledger Parser module.
 */

import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/** Metadata attached to ledger-parser errors. */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/** Constructor payload used by concrete ledger-parser errors. */
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
  /** Stable source identifier for ledger-parser errors. */
  override readonly source = "@colibri/core/ledger-parser";
  /** Structured metadata attached to the error. */
  override readonly meta: Meta;

  /**
   * Creates a new ledger-parser error.
   *
   * @param args Error construction payload.
   */
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
  MISSING_TRANSACTION_ENVELOPE = "LDP_008",
  UNSUPPORTED_ENVELOPE_TYPE = "LDP_009",
  NATIVE_OPERATION_DECODE_FAILED = "LDP_010",
  MISSING_FEE_SOURCE_ENVELOPE = "LDP_011",
  MISSING_NATIVE_ENVELOPE = "LDP_012",
  NATIVE_ENVELOPE_DECODE_FAILED = "LDP_013",
  INVALID_NETWORK_PASSPHRASE = "LDP_014",
  ENVELOPE_HASH_FAILED = "LDP_015",
  DUPLICATE_ENVELOPE_HASH = "LDP_016",
  RESULT_ENVELOPE_NOT_FOUND = "LDP_017",
  UNMATCHED_TRANSACTION_ENVELOPES = "LDP_018",
}

/**
 * Thrown when the LedgerEntry object is malformed.
 */
export class INVALID_LEDGER_ENTRY extends LedgerParserError {
  /**
   * Creates the error.
   *
   * @param reason Explanation of why the ledger entry is invalid.
   */
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
  /**
   * Creates the error.
   *
   * @param cause Underlying XDR decoding failure.
   */
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
  /**
   * Creates the error.
   *
   * @param cause Underlying XDR decoding failure.
   */
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
  /**
   * Creates the error.
   *
   * @param version Unsupported ledger-close metadata version.
   */
  constructor(version: string) {
    super({
      code: Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
      message: "Unsupported LedgerCloseMeta version",
      details:
        `LedgerCloseMeta version "${version}" is not supported. Supported versions: v0, v1, v2. Consider updating to a newer version of this library.`,
      data: { version },
    });
  }
}

/**
 * Thrown when attempting to access transaction data that doesn't exist.
 */
export class INVALID_TRANSACTION_INDEX extends LedgerParserError {
  /**
   * Creates the error.
   *
   * @param index Requested transaction index.
   * @param ledgerSequence Ledger sequence containing the transactions.
   * @param maxIndex Highest valid transaction index.
   */
  constructor(index: number, ledgerSequence: number, maxIndex: number) {
    super({
      code: Code.INVALID_TRANSACTION_INDEX,
      message: "Invalid transaction index",
      details:
        `Transaction index ${index} is out of bounds for ledger ${ledgerSequence} (max index: ${maxIndex}).`,
      data: { index, ledgerSequence, maxIndex },
    });
  }
}

/**
 * Thrown when attempting to access operation data that doesn't exist.
 */
export class INVALID_OPERATION_INDEX extends LedgerParserError {
  /**
   * Creates the error.
   *
   * @param index Requested operation index.
   * @param transactionIndex Parent transaction index.
   * @param maxIndex Highest valid operation index.
   */
  constructor(index: number, transactionIndex: number, maxIndex: number) {
    super({
      code: Code.INVALID_OPERATION_INDEX,
      message: "Invalid operation index",
      details:
        `Operation index ${index} is out of bounds for transaction ${transactionIndex} (max index: ${maxIndex}).`,
      data: { index, transactionIndex, maxIndex },
    });
  }
}

/**
 * Thrown when encountering an unknown operation type.
 */
export class UNSUPPORTED_OPERATION_TYPE extends LedgerParserError {
  /**
   * Creates the error.
   *
   * @param operationType Unsupported operation type identifier.
   */
  constructor(operationType: string) {
    super({
      code: Code.UNSUPPORTED_OPERATION_TYPE,
      message: "Unsupported operation type",
      details:
        `Operation type "${operationType}" is not recognized. This may indicate a new operation type from a protocol upgrade.`,
      data: { operationType },
    });
  }
}

/**
 * Thrown when envelope-dependent transaction data is requested but unavailable.
 */
export class MISSING_TRANSACTION_ENVELOPE extends LedgerParserError {
  /**
   * Creates the error.
   *
   * @param hash Transaction hash lacking an envelope.
   * @param property Envelope-dependent property that was requested.
   */
  constructor(hash: string, property: string) {
    super({
      code: Code.MISSING_TRANSACTION_ENVELOPE,
      message:
        `Cannot get ${property} for transaction ${hash} - envelope not available`,
      details:
        "The requested transaction property depends on an envelope, but the transaction metadata did not include one.",
      data: { hash, property },
    });
  }
}

/**
 * Thrown when a transaction envelope type is not supported by the parser.
 */
export class UNSUPPORTED_ENVELOPE_TYPE extends LedgerParserError {
  /**
   * Creates the error.
   *
   * @param envelopeType Unsupported transaction-envelope discriminator.
   */
  constructor(envelopeType: string | number) {
    super({
      code: Code.UNSUPPORTED_ENVELOPE_TYPE,
      message: `Unsupported envelope type: ${envelopeType}`,
      details:
        "The transaction parser encountered an envelope type it does not know how to decode.",
      data: { envelopeType },
    });
  }
}

/**
 * Export all error classes for convenience.
 */
/** A ledger operation could not be converted to its native SDK record. */
export class NATIVE_OPERATION_DECODE_FAILED extends LedgerParserError {
  /** Retains the SDK decoding failure and zero-based operation index. */
  constructor(index: number, cause: Error) {
    super({
      code: Code.NATIVE_OPERATION_DECODE_FAILED,
      message: "Failed to decode the native operation record",
      details: "The operation XDR could not be decoded by Stellar SDK.",
      data: { index },
      cause,
    });
  }
}

/** A fee payer cannot be determined from transaction results alone. */
export class MISSING_FEE_SOURCE_ENVELOPE extends LedgerParserError {
  /** Identifies the result whose envelope is unavailable. */
  constructor(hash: string) {
    super({
      code: Code.MISSING_FEE_SOURCE_ENVELOPE,
      message: "Cannot read the fee source without an envelope",
      details: "Provide a correctly associated transaction envelope.",
      data: { hash },
    });
  }
}
/** Native envelope access was requested on result-only metadata. */
export class MISSING_NATIVE_ENVELOPE extends LedgerParserError {
  /** Identifies the result that lacks an envelope. */
  constructor(hash: string) {
    super({
      code: Code.MISSING_NATIVE_ENVELOPE,
      message: "Native transaction envelope is unavailable",
      details: "Provide a correctly associated transaction envelope.",
      data: { hash },
    });
  }
}
/** Native envelope conversion failed rather than returning incomplete data. */
export class NATIVE_ENVELOPE_DECODE_FAILED extends LedgerParserError {
  /** Retains the native conversion failure. */
  constructor(hash: string, cause: Error) {
    super({
      code: Code.NATIVE_ENVELOPE_DECODE_FAILED,
      message: "Could not decode the native transaction envelope",
      details: "The supplied transaction envelope is malformed.",
      data: { hash },
      cause,
    });
  }
}

/** Provided network passphrase must be a nonempty string. */
export class INVALID_NETWORK_PASSPHRASE extends LedgerParserError {
  /** Records the failed ledger association boundary. */
  constructor() {
    super({
      code: Code.INVALID_NETWORK_PASSPHRASE,
      message: "Provided network passphrase must be a nonempty string.",
      details: "Pass a NetworkConfig or the exact network passphrase.",
      data: null,
    });
  }
}

/** Failed to hash a transaction envelope. */
export class ENVELOPE_HASH_FAILED extends LedgerParserError {
  /** Records the failed ledger association boundary. */
  constructor(cause: Error) {
    super({
      code: Code.ENVELOPE_HASH_FAILED,
      message: "Failed to hash a transaction envelope.",
      details:
        "The envelope could not be decoded or hashed by the native Stellar SDK.",
      data: null,
      cause,
    });
  }
}

/** Transaction set contains a duplicate envelope hash. */
export class DUPLICATE_ENVELOPE_HASH extends LedgerParserError {
  /** Records the failed ledger association boundary. */
  constructor(hash: string) {
    super({
      code: Code.DUPLICATE_ENVELOPE_HASH,
      message: "Transaction set contains a duplicate envelope hash.",
      details:
        "Cannot unambiguously associate this transaction set with execution results.",
      data: { hash },
    });
  }
}

/** No transaction envelope matches an execution result. */
export class RESULT_ENVELOPE_NOT_FOUND extends LedgerParserError {
  /** Records the failed ledger association boundary. */
  constructor(hash: string) {
    super({
      code: Code.RESULT_ENVELOPE_NOT_FOUND,
      message: "No transaction envelope matches an execution result.",
      details:
        "Check the network passphrase and the completeness of the ledger data.",
      data: { hash },
    });
  }
}

/** Transaction set contains envelopes without execution results. */
export class UNMATCHED_TRANSACTION_ENVELOPES extends LedgerParserError {
  /** Records the failed ledger association boundary. */
  constructor(hashes: string[]) {
    super({
      code: Code.UNMATCHED_TRANSACTION_ENVELOPES,
      message: "Transaction set contains envelopes without execution results.",
      details:
        "The ledger transaction set and results do not form a one-to-one match.",
      data: { hashes },
    });
  }
}

/** Ledger parser errors indexed by stable code. */
export const ERROR_LDP = {
  [Code.INVALID_LEDGER_ENTRY]: INVALID_LEDGER_ENTRY,
  [Code.INVALID_HEADER_XDR]: INVALID_HEADER_XDR,
  [Code.INVALID_METADATA_XDR]: INVALID_METADATA_XDR,
  [Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION]:
    UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
  [Code.INVALID_TRANSACTION_INDEX]: INVALID_TRANSACTION_INDEX,
  [Code.INVALID_OPERATION_INDEX]: INVALID_OPERATION_INDEX,
  [Code.UNSUPPORTED_OPERATION_TYPE]: UNSUPPORTED_OPERATION_TYPE,
  [Code.MISSING_TRANSACTION_ENVELOPE]: MISSING_TRANSACTION_ENVELOPE,
  [Code.UNSUPPORTED_ENVELOPE_TYPE]: UNSUPPORTED_ENVELOPE_TYPE,
  [Code.NATIVE_OPERATION_DECODE_FAILED]: NATIVE_OPERATION_DECODE_FAILED,
  [Code.MISSING_FEE_SOURCE_ENVELOPE]: MISSING_FEE_SOURCE_ENVELOPE,
  [Code.MISSING_NATIVE_ENVELOPE]: MISSING_NATIVE_ENVELOPE,
  [Code.NATIVE_ENVELOPE_DECODE_FAILED]: NATIVE_ENVELOPE_DECODE_FAILED,
  [Code.INVALID_NETWORK_PASSPHRASE]: INVALID_NETWORK_PASSPHRASE,
  [Code.ENVELOPE_HASH_FAILED]: ENVELOPE_HASH_FAILED,
  [Code.DUPLICATE_ENVELOPE_HASH]: DUPLICATE_ENVELOPE_HASH,
  [Code.RESULT_ENVELOPE_NOT_FOUND]: RESULT_ENVELOPE_NOT_FOUND,
  [Code.UNMATCHED_TRANSACTION_ENVELOPES]: UNMATCHED_TRANSACTION_ENVELOPES,
};
