/**
 * Error handling for the RPC Streamer framework.
 *
 * All errors thrown by RPCStreamer are instances of RPCStreamerError with
 * specific error codes for different failure scenarios.
 *
 * @module
 */

/**
 * Error codes for RPCStreamer failures.
 */
export enum RPCStreamerErrorCode {
  /** Invalid configuration provided */
  INVALID_CONFIG = "RPC_001",

  /** Invalid RPC instance */
  INVALID_RPC = "RPC_002",

  /** RPC health check failed */
  HEALTH_CHECK_FAILED = "RPC_003",

  /** Live RPC fetch operation failed */
  LIVE_FETCH_FAILED = "RPC_004",

  /** Archive RPC fetch operation failed */
  ARCHIVE_FETCH_FAILED = "RPC_005",

  /** Data parsing failed */
  PARSE_FAILED = "RPC_006",

  /** Invalid sequence range */
  INVALID_SEQUENCE_RANGE = "RPC_007",

  /** Stream is already running */
  ALREADY_RUNNING = "RPC_008",

  /** Stream is not running */
  NOT_RUNNING = "RPC_009",

  /** Maximum consecutive failures exceeded */
  MAX_FAILURES_EXCEEDED = "RPC_010",

  /** RPC server is already set */
  RPC_ALREADY_SET = "RPC_011",

  /** Archive RPC server is already set */
  ARCHIVE_RPC_ALREADY_SET = "RPC_012",

  /** RPC server is not healthy */
  RPC_NOT_HEALTHY = "RPC_013",

  /** Ledger is too old (outside RPC retention window) */
  LEDGER_TOO_OLD = "RPC_014",

  /** Ledger is too high (ahead of latest available) */
  LEDGER_TOO_HIGH = "RPC_015",

  /** Archive RPC is required but not configured */
  MISSING_ARCHIVE_RPC = "RPC_016",

  /** Live ingestor is required but not provided */
  MISSING_LIVE_INGESTOR = "RPC_017",

  /** Archive ingestor is required but not provided */
  MISSING_ARCHIVE_INGESTOR = "RPC_018",
}

/**
 * Custom error class for RPC Streamer operations.
 *
 * @example
 * ```ts
 * try {
 *   // Stream operations
 * } catch (error) {
 *   if (error instanceof RPCStreamerError) {
 *     console.error(`Error ${error.code}: ${error.message}`);
 *     console.error(`Details:`, error.details);
 *   }
 * }
 * ```
 */
export class RPCStreamerError extends Error {
  /**
   * The error code identifying the type of failure.
   */
  public readonly code: RPCStreamerErrorCode;

  /**
   * Additional details about the error.
   */
  public readonly details?: Record<string, unknown>;

  /**
   * The original error that caused this failure, if any.
   */
  public override readonly cause?: Error;

  /**
   * Creates a new RPCStreamerError.
   *
   * @param code - The error code
   * @param message - Human-readable error message
   * @param details - Additional context about the error
   * @param cause - The original error that caused this failure
   */
  constructor(
    code: RPCStreamerErrorCode,
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message);
    this.name = "RPCStreamerError";
    this.code = code;
    this.details = details;
    this.cause = cause;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RPCStreamerError);
    }
  }

  /**
   * Returns a JSON representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }
}

/**
 * Mapping of error codes to their descriptions.
 */
export const ERROR_DESCRIPTIONS: Record<RPCStreamerErrorCode, string> = {
  [RPCStreamerErrorCode.INVALID_CONFIG]:
    "The provided configuration is invalid or incomplete",
  [RPCStreamerErrorCode.INVALID_RPC]:
    "The provided RPC instance is null, undefined, or invalid",
  [RPCStreamerErrorCode.HEALTH_CHECK_FAILED]:
    "RPC health check failed - instance may be unavailable",
  [RPCStreamerErrorCode.LIVE_FETCH_FAILED]:
    "Failed to fetch data from live RPC",
  [RPCStreamerErrorCode.ARCHIVE_FETCH_FAILED]:
    "Failed to fetch data from archive RPC",
  [RPCStreamerErrorCode.PARSE_FAILED]: "Failed to parse data from RPC response",
  [RPCStreamerErrorCode.INVALID_SEQUENCE_RANGE]:
    "Invalid sequence range provided (start must be <= stop)",
  [RPCStreamerErrorCode.ALREADY_RUNNING]:
    "Cannot start stream - already running",
  [RPCStreamerErrorCode.NOT_RUNNING]:
    "Cannot perform operation - stream is not running",
  [RPCStreamerErrorCode.MAX_FAILURES_EXCEEDED]:
    "Maximum consecutive failures exceeded - stopping stream",
  [RPCStreamerErrorCode.RPC_ALREADY_SET]: "RPC server is already configured",
  [RPCStreamerErrorCode.ARCHIVE_RPC_ALREADY_SET]:
    "Archive RPC server is already configured",
  [RPCStreamerErrorCode.RPC_NOT_HEALTHY]: "RPC server is not healthy",
  [RPCStreamerErrorCode.LEDGER_TOO_OLD]:
    "Ledger is older than oldest available in RPC retention window",
  [RPCStreamerErrorCode.LEDGER_TOO_HIGH]:
    "Ledger is higher than latest available",
  [RPCStreamerErrorCode.MISSING_ARCHIVE_RPC]:
    "Archive RPC is required but not configured",
  [RPCStreamerErrorCode.MISSING_LIVE_INGESTOR]:
    "Live ingestor is required but not provided",
  [RPCStreamerErrorCode.MISSING_ARCHIVE_INGESTOR]:
    "Archive ingestor is required but not provided",
};
