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
  /** Conflicting or missing live connection configuration. */
  INVALID_LIVE_CONNECTION = "RPC_019",
  /** Native live RPC client construction failed. */
  LIVE_CONNECTION_FAILED = "RPC_020",
  /** Conflicting archive connection configuration. */
  INVALID_ARCHIVE_CONNECTION = "RPC_021",
  /** Native archive RPC client construction failed. */
  ARCHIVE_CONNECTION_FAILED = "RPC_022",
  /** Checkpoint persistence rejected; ingestion cannot safely advance. */
  CHECKPOINT_FAILED = "RPC_023",
  /** The selected network has no live RPC URL. */
  MISSING_LIVE_RPC_URL = "RPC_024",
  /** Failed to resolve network identity from the ledger RPC connection. */
  NETWORK_DISCOVERY_FAILED = "RPC_025",
  /** Network discovery returned an empty or malformed passphrase. */
  INVALID_NETWORK_PASSPHRASE = "RPC_026",
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
  /** @deprecated Use a dedicated failure subclass; this constructor is retained for source compatibility. */
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
    if (
      "captureStackTrace" in Error &&
      typeof Error.captureStackTrace === "function"
    ) {
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
  [RPCStreamerErrorCode.NETWORK_DISCOVERY_FAILED]:
    "Ledger RPC network discovery failed",
  [RPCStreamerErrorCode.INVALID_NETWORK_PASSPHRASE]:
    "Ledger RPC returned an invalid passphrase",
  [RPCStreamerErrorCode.MISSING_LIVE_RPC_URL]:
    "The selected network has no live RPC URL",
  [RPCStreamerErrorCode.CHECKPOINT_FAILED]:
    "Checkpoint persistence failed; resume at the uncommitted ledger",
  [RPCStreamerErrorCode.INVALID_LIVE_CONNECTION]:
    "Choose one live RPC source without conflicting options",
  [RPCStreamerErrorCode.LIVE_CONNECTION_FAILED]:
    "Native live RPC client construction failed",
  [RPCStreamerErrorCode.INVALID_ARCHIVE_CONNECTION]:
    "Choose an archive RPC URL or a native client, not both",
  [RPCStreamerErrorCode.ARCHIVE_CONNECTION_FAILED]:
    "Native archive RPC client construction failed",
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

/** Invalid config. Stable code `RPC_001`. */
export class RPCStreamerInvalidConfigError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.INVALID_CONFIG, message, details, cause);
  }
}

/** Invalid rpc. Stable code `RPC_002`. */
export class RPCStreamerInvalidRpcError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.INVALID_RPC, message, details, cause);
  }
}

/** Health check failed. Stable code `RPC_003`. */
export class RPCStreamerHealthCheckFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.HEALTH_CHECK_FAILED, message, details, cause);
  }
}

/** Live fetch failed. Stable code `RPC_004`. */
export class RPCStreamerLiveFetchFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.LIVE_FETCH_FAILED, message, details, cause);
  }
}

/** Archive fetch failed. Stable code `RPC_005`. */
export class RPCStreamerArchiveFetchFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.ARCHIVE_FETCH_FAILED, message, details, cause);
  }
}

/** Parse failed. Stable code `RPC_006`. */
export class RPCStreamerParseFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.PARSE_FAILED, message, details, cause);
  }
}

/** Invalid sequence range. Stable code `RPC_007`. */
export class RPCStreamerInvalidSequenceRangeError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.INVALID_SEQUENCE_RANGE, message, details, cause);
  }
}

/** Already running. Stable code `RPC_008`. */
export class RPCStreamerAlreadyRunningError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.ALREADY_RUNNING, message, details, cause);
  }
}

/** Not running. Stable code `RPC_009`. */
export class RPCStreamerNotRunningError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.NOT_RUNNING, message, details, cause);
  }
}

/** Max failures exceeded. Stable code `RPC_010`. */
export class RPCStreamerMaxFailuresExceededError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.MAX_FAILURES_EXCEEDED, message, details, cause);
  }
}

/** Rpc already set. Stable code `RPC_011`. */
export class RPCStreamerRpcAlreadySetError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.RPC_ALREADY_SET, message, details, cause);
  }
}

/** Archive rpc already set. Stable code `RPC_012`. */
export class RPCStreamerArchiveRpcAlreadySetError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.ARCHIVE_RPC_ALREADY_SET,
      message,
      details,
      cause,
    );
  }
}

/** Rpc not healthy. Stable code `RPC_013`. */
export class RPCStreamerRpcNotHealthyError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.RPC_NOT_HEALTHY, message, details, cause);
  }
}

/** Ledger too old. Stable code `RPC_014`. */
export class RPCStreamerLedgerTooOldError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.LEDGER_TOO_OLD, message, details, cause);
  }
}

/** Ledger too high. Stable code `RPC_015`. */
export class RPCStreamerLedgerTooHighError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.LEDGER_TOO_HIGH, message, details, cause);
  }
}

/** Missing archive rpc. Stable code `RPC_016`. */
export class RPCStreamerMissingArchiveRpcError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.MISSING_ARCHIVE_RPC, message, details, cause);
  }
}

/** Missing live ingestor. Stable code `RPC_017`. */
export class RPCStreamerMissingLiveIngestorError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.MISSING_LIVE_INGESTOR, message, details, cause);
  }
}

/** Missing archive ingestor. Stable code `RPC_018`. */
export class RPCStreamerMissingArchiveIngestorError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.MISSING_ARCHIVE_INGESTOR,
      message,
      details,
      cause,
    );
  }
}

/** Invalid live connection. Stable code `RPC_019`. */
export class RPCStreamerInvalidLiveConnectionError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.INVALID_LIVE_CONNECTION,
      message,
      details,
      cause,
    );
  }
}

/** Live connection failed. Stable code `RPC_020`. */
export class RPCStreamerLiveConnectionFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.LIVE_CONNECTION_FAILED, message, details, cause);
  }
}

/** Invalid archive connection. Stable code `RPC_021`. */
export class RPCStreamerInvalidArchiveConnectionError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.INVALID_ARCHIVE_CONNECTION,
      message,
      details,
      cause,
    );
  }
}

/** Archive connection failed. Stable code `RPC_022`. */
export class RPCStreamerArchiveConnectionFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.ARCHIVE_CONNECTION_FAILED,
      message,
      details,
      cause,
    );
  }
}

/** Checkpoint failed. Stable code `RPC_023`. */
export class RPCStreamerCheckpointFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.CHECKPOINT_FAILED, message, details, cause);
  }
}

/** Missing live rpc url. Stable code `RPC_024`. */
export class RPCStreamerMissingLiveRpcUrlError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(RPCStreamerErrorCode.MISSING_LIVE_RPC_URL, message, details, cause);
  }
}

/** Network discovery failed. Stable code `RPC_025`. */
export class RPCStreamerNetworkDiscoveryFailedError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.NETWORK_DISCOVERY_FAILED,
      message,
      details,
      cause,
    );
  }
}

/** Invalid network passphrase. Stable code `RPC_026`. */
export class RPCStreamerInvalidNetworkPassphraseError extends RPCStreamerError {
  /** Preserve the existing stream failure details and cause. */
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(
      RPCStreamerErrorCode.INVALID_NETWORK_PASSPHRASE,
      message,
      details,
      cause,
    );
  }
}

/** One constructor per RPC failure. */
export const RPCStreamerErrors: {
  [RPCStreamerErrorCode.INVALID_CONFIG]: typeof RPCStreamerInvalidConfigError;
  [RPCStreamerErrorCode.INVALID_RPC]: typeof RPCStreamerInvalidRpcError;
  [RPCStreamerErrorCode.HEALTH_CHECK_FAILED]:
    typeof RPCStreamerHealthCheckFailedError;
  [RPCStreamerErrorCode.LIVE_FETCH_FAILED]:
    typeof RPCStreamerLiveFetchFailedError;
  [RPCStreamerErrorCode.ARCHIVE_FETCH_FAILED]:
    typeof RPCStreamerArchiveFetchFailedError;
  [RPCStreamerErrorCode.PARSE_FAILED]: typeof RPCStreamerParseFailedError;
  [RPCStreamerErrorCode.INVALID_SEQUENCE_RANGE]:
    typeof RPCStreamerInvalidSequenceRangeError;
  [RPCStreamerErrorCode.ALREADY_RUNNING]: typeof RPCStreamerAlreadyRunningError;
  [RPCStreamerErrorCode.NOT_RUNNING]: typeof RPCStreamerNotRunningError;
  [RPCStreamerErrorCode.MAX_FAILURES_EXCEEDED]:
    typeof RPCStreamerMaxFailuresExceededError;
  [RPCStreamerErrorCode.RPC_ALREADY_SET]: typeof RPCStreamerRpcAlreadySetError;
  [RPCStreamerErrorCode.ARCHIVE_RPC_ALREADY_SET]:
    typeof RPCStreamerArchiveRpcAlreadySetError;
  [RPCStreamerErrorCode.RPC_NOT_HEALTHY]: typeof RPCStreamerRpcNotHealthyError;
  [RPCStreamerErrorCode.LEDGER_TOO_OLD]: typeof RPCStreamerLedgerTooOldError;
  [RPCStreamerErrorCode.LEDGER_TOO_HIGH]: typeof RPCStreamerLedgerTooHighError;
  [RPCStreamerErrorCode.MISSING_ARCHIVE_RPC]:
    typeof RPCStreamerMissingArchiveRpcError;
  [RPCStreamerErrorCode.MISSING_LIVE_INGESTOR]:
    typeof RPCStreamerMissingLiveIngestorError;
  [RPCStreamerErrorCode.MISSING_ARCHIVE_INGESTOR]:
    typeof RPCStreamerMissingArchiveIngestorError;
  [RPCStreamerErrorCode.INVALID_LIVE_CONNECTION]:
    typeof RPCStreamerInvalidLiveConnectionError;
  [RPCStreamerErrorCode.LIVE_CONNECTION_FAILED]:
    typeof RPCStreamerLiveConnectionFailedError;
  [RPCStreamerErrorCode.INVALID_ARCHIVE_CONNECTION]:
    typeof RPCStreamerInvalidArchiveConnectionError;
  [RPCStreamerErrorCode.ARCHIVE_CONNECTION_FAILED]:
    typeof RPCStreamerArchiveConnectionFailedError;
  [RPCStreamerErrorCode.CHECKPOINT_FAILED]:
    typeof RPCStreamerCheckpointFailedError;
  [RPCStreamerErrorCode.MISSING_LIVE_RPC_URL]:
    typeof RPCStreamerMissingLiveRpcUrlError;
  [RPCStreamerErrorCode.NETWORK_DISCOVERY_FAILED]:
    typeof RPCStreamerNetworkDiscoveryFailedError;
  [RPCStreamerErrorCode.INVALID_NETWORK_PASSPHRASE]:
    typeof RPCStreamerInvalidNetworkPassphraseError;
} = {
  [RPCStreamerErrorCode.INVALID_CONFIG]: RPCStreamerInvalidConfigError,
  [RPCStreamerErrorCode.INVALID_RPC]: RPCStreamerInvalidRpcError,
  [RPCStreamerErrorCode.HEALTH_CHECK_FAILED]: RPCStreamerHealthCheckFailedError,
  [RPCStreamerErrorCode.LIVE_FETCH_FAILED]: RPCStreamerLiveFetchFailedError,
  [RPCStreamerErrorCode.ARCHIVE_FETCH_FAILED]:
    RPCStreamerArchiveFetchFailedError,
  [RPCStreamerErrorCode.PARSE_FAILED]: RPCStreamerParseFailedError,
  [RPCStreamerErrorCode.INVALID_SEQUENCE_RANGE]:
    RPCStreamerInvalidSequenceRangeError,
  [RPCStreamerErrorCode.ALREADY_RUNNING]: RPCStreamerAlreadyRunningError,
  [RPCStreamerErrorCode.NOT_RUNNING]: RPCStreamerNotRunningError,
  [RPCStreamerErrorCode.MAX_FAILURES_EXCEEDED]:
    RPCStreamerMaxFailuresExceededError,
  [RPCStreamerErrorCode.RPC_ALREADY_SET]: RPCStreamerRpcAlreadySetError,
  [RPCStreamerErrorCode.ARCHIVE_RPC_ALREADY_SET]:
    RPCStreamerArchiveRpcAlreadySetError,
  [RPCStreamerErrorCode.RPC_NOT_HEALTHY]: RPCStreamerRpcNotHealthyError,
  [RPCStreamerErrorCode.LEDGER_TOO_OLD]: RPCStreamerLedgerTooOldError,
  [RPCStreamerErrorCode.LEDGER_TOO_HIGH]: RPCStreamerLedgerTooHighError,
  [RPCStreamerErrorCode.MISSING_ARCHIVE_RPC]: RPCStreamerMissingArchiveRpcError,
  [RPCStreamerErrorCode.MISSING_LIVE_INGESTOR]:
    RPCStreamerMissingLiveIngestorError,
  [RPCStreamerErrorCode.MISSING_ARCHIVE_INGESTOR]:
    RPCStreamerMissingArchiveIngestorError,
  [RPCStreamerErrorCode.INVALID_LIVE_CONNECTION]:
    RPCStreamerInvalidLiveConnectionError,
  [RPCStreamerErrorCode.LIVE_CONNECTION_FAILED]:
    RPCStreamerLiveConnectionFailedError,
  [RPCStreamerErrorCode.INVALID_ARCHIVE_CONNECTION]:
    RPCStreamerInvalidArchiveConnectionError,
  [RPCStreamerErrorCode.ARCHIVE_CONNECTION_FAILED]:
    RPCStreamerArchiveConnectionFailedError,
  [RPCStreamerErrorCode.CHECKPOINT_FAILED]: RPCStreamerCheckpointFailedError,
  [RPCStreamerErrorCode.MISSING_LIVE_RPC_URL]:
    RPCStreamerMissingLiveRpcUrlError,
  [RPCStreamerErrorCode.NETWORK_DISCOVERY_FAILED]:
    RPCStreamerNetworkDiscoveryFailedError,
  [RPCStreamerErrorCode.INVALID_NETWORK_PASSPHRASE]:
    RPCStreamerInvalidNetworkPassphraseError,
};
