/**
 * @module ledger-streamer/error
 * @description Error definitions for the Ledger Streamer.
 */

import { ColibriError, type Diagnostic } from "@colibri/core";

/**
 * Metadata type for ledger streamer errors.
 */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/**
 * Shape of error constructor arguments.
 */
export type LedgerStreamerErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/**
 * Base error class for all ledger streamer errors.
 *
 * Extends ColibriError with ledger-streamer specific domain and source.
 */
export abstract class LedgerStreamerError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/ledger-streamer";
  override readonly meta: Meta;

  constructor(args: LedgerStreamerErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "ledger-streamer" as const,
      source: "@colibri/ledger-streamer",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Error codes for the Ledger Streamer.
 *
 * Codes follow the pattern: LDS_XXX
 * - LDS: Ledger Streamer domain
 * - XXX: Sequential number
 */
export enum Code {
  RPC_ALREADY_SET = "LDS_001",
  ARCHIVE_RPC_ALREADY_SET = "LDS_002",
  STREAMER_ALREADY_RUNNING = "LDS_003",
  RPC_NOT_HEALTHY = "LDS_004",
  LEDGER_TOO_OLD = "LDS_005",
  LEDGER_TOO_HIGH = "LDS_006",
  MISSING_ARCHIVE_RPC = "LDS_007",
  INVALID_INGESTION_RANGE = "LDS_008",
  RPC_REQUEST_FAILED = "LDS_009",
}

/**
 * Thrown when attempting to set RPC after it's already configured.
 *
 * @example
 * ```typescript
 * streamer.rpc = new Server("https://example.com");
 * streamer.rpc = new Server("https://other.com");  // Throws RPC_ALREADY_SET
 * ```
 */
export class RPC_ALREADY_SET extends LedgerStreamerError {
  constructor() {
    super({
      code: Code.RPC_ALREADY_SET,
      message: "RPC client is already set",
      details:
        "An RPC client has already been assigned to the LedgerStreamer instance. Multiple RPC clients are not supported.",
      diagnostic: {
        rootCause:
          "The LedgerStreamer instance was attempted to be assigned a second RPC client.",
        suggestion:
          "Ensure that only one RPC client is assigned to the LedgerStreamer instance.",
      },
      data: {},
    });
  }
}

/**
 * Thrown when attempting to set archive RPC after it's already configured.
 *
 * @example
 * ```typescript
 * streamer.archiveRpc = new Server("https://archive1.com");
 * streamer.archiveRpc = new Server("https://archive2.com");  // Throws ARCHIVE_RPC_ALREADY_SET
 * ```
 */
export class ARCHIVE_RPC_ALREADY_SET extends LedgerStreamerError {
  constructor() {
    super({
      code: Code.ARCHIVE_RPC_ALREADY_SET,
      message: "Archive RPC client is already set",
      details:
        "An archive RPC client has already been assigned to the LedgerStreamer instance. Multiple archive RPC clients are not supported.",
      diagnostic: {
        rootCause:
          "The LedgerStreamer instance was attempted to be assigned a second archive RPC client.",
        suggestion:
          "Ensure that only one archive RPC client is assigned to the LedgerStreamer instance.",
      },
      data: {},
    });
  }
}

/**
 * Thrown when trying to start a streamer that's already running.
 *
 * @example
 * ```typescript
 * await streamer.start(handler, { startLedger: 1000 });
 * await streamer.start(handler, { startLedger: 2000 });  // Throws STREAMER_ALREADY_RUNNING
 * ```
 */
export class STREAMER_ALREADY_RUNNING extends LedgerStreamerError {
  constructor() {
    super({
      code: Code.STREAMER_ALREADY_RUNNING,
      message: "Ledger streamer is already running",
      details:
        "The ledger streamer has already been started and is currently running. Multiple concurrent runs are not supported.",
      diagnostic: {
        rootCause:
          "An attempt was made to start the ledger streamer while it was already running.",
        suggestion:
          "Ensure that the ledger streamer is stopped before attempting to start it again.",
      },
      data: {},
    });
  }
}

/**
 * Thrown when RPC server is not healthy.
 *
 * @example
 * ```typescript
 * // If RPC is down or unhealthy
 * await streamer.startLive({ startLedger: 1000 });  // Throws RPC_NOT_HEALTHY
 * ```
 */
export class RPC_NOT_HEALTHY extends LedgerStreamerError {
  constructor() {
    super({
      code: Code.RPC_NOT_HEALTHY,
      message: "RPC server is not healthy",
      details:
        "The RPC server health check failed, indicating that the server is not in a healthy state.",
      diagnostic: {
        rootCause:
          "The RPC server responded with an unhealthy status during the health check.",
        suggestion:
          "Check the RPC server status and ensure it is running correctly before starting the ledger streamer.",
      },
      data: {},
    });
  }
}

/**
 * Thrown when requesting a ledger older than RPC's retention window.
 *
 * @example
 * ```typescript
 * // RPC retention starts at ledger 1000, requesting 500
 * await streamer.startLive({ startLedger: 500 });  // Throws LEDGER_TOO_OLD
 * ```
 */
export class LEDGER_TOO_OLD extends LedgerStreamerError {
  constructor(requestedLedger: number, oldestAvailableLedger: number) {
    super({
      code: Code.LEDGER_TOO_OLD,
      message: "Requested ledger is older than the RPC retention period",
      details: `The requested start ledger ${requestedLedger} is older than the oldest available ledger ${oldestAvailableLedger} on the RPC server.`,
      diagnostic: {
        rootCause:
          "The requested start ledger falls outside the retention period of the RPC server, making it unavailable for ledger streaming.",
        suggestion:
          "Choose a start ledger that is within the available range of the RPC server's retention period, or configure a full archive RPC client for historical ingestion.",
      },
      data: {
        requestedLedger,
        oldestAvailableLedger,
      },
    });
  }
}

/**
 * Thrown when requesting a ledger that doesn't exist yet.
 *
 * @example
 * ```typescript
 * // Latest ledger is 1000, requesting 2000
 * await streamer.startLive({ startLedger: 2000 });  // Throws LEDGER_TOO_HIGH
 * ```
 */
export class LEDGER_TOO_HIGH extends LedgerStreamerError {
  constructor(requestedLedger: number, latestAvailableLedger: number) {
    super({
      code: Code.LEDGER_TOO_HIGH,
      message: "Requested ledger is higher than the latest available ledger",
      details: `The requested start ledger ${requestedLedger} is higher than the latest available ledger ${latestAvailableLedger} on the RPC server.`,
      diagnostic: {
        rootCause:
          "The requested start ledger exceeds the latest available ledger on the RPC server.",
        suggestion:
          "Choose a start ledger that is less than or equal to the latest available ledger on the RPC server.",
      },
      data: {
        requestedLedger,
        latestAvailableLedger,
      },
    });
  }
}

/**
 * Thrown when archival RPC is needed but not configured.
 *
 * @example
 * ```typescript
 * const streamer = new LedgerStreamer({
 *   rpcUrl: "https://soroban-testnet.stellar.org"
 *   // No archiveRpcUrl provided
 * });
 *
 * await streamer.startArchive({ startLedger: 1, stopLedger: 1000 });  // Throws MISSING_ARCHIVE_RPC
 * ```
 */
export class MISSING_ARCHIVE_RPC extends LedgerStreamerError {
  constructor() {
    super({
      code: Code.MISSING_ARCHIVE_RPC,
      message: "Archive RPC client is not configured",
      details:
        "The LedgerStreamer instance requires an archive RPC client to perform historical ledger ingestion, but none is configured.",
      diagnostic: {
        rootCause:
          "No archive RPC client has been assigned to the LedgerStreamer instance.",
        suggestion:
          "Configure an archive RPC client before attempting historical ledger ingestion.",
      },
      data: {},
    });
  }
}

/**
 * Thrown when the ingestion range is invalid.
 *
 * @example
 * ```typescript
 * await streamer.startArchive({ startLedger: 2000, stopLedger: 1000 });  // Throws INVALID_INGESTION_RANGE
 * ```
 */
export class INVALID_INGESTION_RANGE extends LedgerStreamerError {
  constructor(startLedger: number, stopLedger: number) {
    super({
      code: Code.INVALID_INGESTION_RANGE,
      message:
        "Invalid ingestion range: startLedger is greater than stopLedger",
      details: `The specified ingestion range is invalid because the start ledger ${startLedger} is greater than the stop ledger ${stopLedger}.`,
      diagnostic: {
        rootCause:
          "The provided start and stop ledger values do not define a valid range for ledger ingestion.",
        suggestion:
          "Ensure that the start ledger is less than or equal to the stop ledger when specifying the ingestion range.",
      },
      data: {
        startLedger,
        stopLedger,
      },
    });
  }
}

/**
 * Thrown when an RPC request fails.
 *
 * @example
 * ```typescript
 * // Network error, RPC timeout, etc.
 * catch (error) {
 *   if (error instanceof RPC_REQUEST_FAILED) {
 *     console.error("RPC request failed:", error.meta.cause);
 *   }
 * }
 * ```
 */
export class RPC_REQUEST_FAILED extends LedgerStreamerError {
  constructor(method: string, cause: Error) {
    super({
      code: Code.RPC_REQUEST_FAILED,
      message: `RPC request failed: ${method}`,
      details: `The RPC server returned an error or the request failed while calling ${method}. Check network connectivity and RPC availability.`,
      diagnostic: {
        rootCause: `The RPC call to ${method} failed.`,
        suggestion:
          "Check network connectivity, RPC server status, and request parameters.",
      },
      cause,
      data: { method },
    });
  }
}

/**
 * Error code to class mapping for ledger streamer errors.
 */
export const ERROR_LDS = {
  [Code.RPC_ALREADY_SET]: RPC_ALREADY_SET,
  [Code.ARCHIVE_RPC_ALREADY_SET]: ARCHIVE_RPC_ALREADY_SET,
  [Code.STREAMER_ALREADY_RUNNING]: STREAMER_ALREADY_RUNNING,
  [Code.RPC_NOT_HEALTHY]: RPC_NOT_HEALTHY,
  [Code.LEDGER_TOO_OLD]: LEDGER_TOO_OLD,
  [Code.LEDGER_TOO_HIGH]: LEDGER_TOO_HIGH,
  [Code.MISSING_ARCHIVE_RPC]: MISSING_ARCHIVE_RPC,
  [Code.INVALID_INGESTION_RANGE]: INVALID_INGESTION_RANGE,
  [Code.RPC_REQUEST_FAILED]: RPC_REQUEST_FAILED,
};
