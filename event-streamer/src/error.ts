import { ColibriError, type Diagnostic } from "@colibri/core";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type EventStreamerErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;

  cause?: Error;
  data: unknown;
};

export abstract class EventStreamerError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/event-streamer";
  override readonly meta: Meta;

  constructor(args: EventStreamerErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "event-streamer" as const,
      source: "@colibri/event-streamer",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  PAGING_INTERVAL_TOO_LONG = "EVS_001",
  RPC_ALREADY_SET = "EVS_002",
  ARCHIVE_RPC_ALREADY_SET = "EVS_003",
  STREAMER_ALREADY_RUNNING = "EVS_004",
  RPC_NOT_HEALTHY = "EVS_005",
  LEDGER_TOO_OLD = "EVS_006",
  LEDGER_TOO_HIGH = "EVS_007",
  MISSING_ARCHIVE_RPC = "EVS_008",
  INVALID_INGESTION_RANGE = "EVS_009",
}

export class PAGING_INTERVAL_TOO_LONG extends EventStreamerError {
  constructor(waitLedgerIntervalMs: number, providedIntervalMs: number) {
    super({
      code: Code.PAGING_INTERVAL_TOO_LONG,
      message: "Paging interval is too long",
      details: `The provided paging interval of ${providedIntervalMs}ms exceeds the the waitLedgerIntervalMs ${waitLedgerIntervalMs}ms.`,
      diagnostic: {
        rootCause:
          "The paging interval specified for fetching events is longer than the wait interval between ledgers. This would cause the ingestion to drift behind over time.",
        suggestion:
          "Reduce the paging interval to be lower than or equal to the waitLedgerIntervalMs.",
      },
      data: {
        waitLedgerIntervalMs,
        providedIntervalMs,
      },
    });
  }
}

export class RPC_ALREADY_SET extends EventStreamerError {
  constructor() {
    super({
      code: Code.RPC_ALREADY_SET,
      message: "RPC client is already set",
      details:
        "An RPC client has already been assigned to the EventStreamer instance. Multiple RPC clients are not supported.",
      diagnostic: {
        rootCause:
          "The EventStreamer instance was attempted to be assigned a second RPC client.",
        suggestion:
          "Ensure that only one RPC client is assigned to the EventStreamer instance.",
      },
      data: {},
    });
  }
}

export class ARCHIVE_RPC_ALREADY_SET extends EventStreamerError {
  constructor() {
    super({
      code: Code.ARCHIVE_RPC_ALREADY_SET,
      message: "Archive RPC client is already set",
      details:
        "An archive RPC client has already been assigned to the EventStreamer instance. Multiple archive RPC clients are not supported.",
      diagnostic: {
        rootCause:
          "The EventStreamer instance was attempted to be assigned a second archive RPC client.",
        suggestion:
          "Ensure that only one archive RPC client is assigned to the EventStreamer instance.",
      },
      data: {},
    });
  }
}

export class STREAMER_ALREADY_RUNNING extends EventStreamerError {
  constructor() {
    super({
      code: Code.STREAMER_ALREADY_RUNNING,
      message: "Event streamer is already running",
      details:
        "The event streamer has already been started and is currently running. Multiple concurrent runs are not supported.",
      diagnostic: {
        rootCause:
          "An attempt was made to start the event streamer while it was already running.",
        suggestion:
          "Ensure that the event streamer is stopped before attempting to start it again.",
      },
      data: {},
    });
  }
}

export class RPC_NOT_HEALTHY extends EventStreamerError {
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
          "Check the RPC server status and ensure it is running correctly before starting the event streamer.",
      },
      data: {},
    });
  }
}

export class LEDGER_TOO_OLD extends EventStreamerError {
  constructor(requestedLedger: number, oldestAvailableLedger: number) {
    super({
      code: Code.LEDGER_TOO_OLD,
      message: "Requested ledger is older than the RPC retention period",
      details: `The requested start ledger ${requestedLedger} is older than the oldest available ledger ${oldestAvailableLedger} on the RPC server.`,
      diagnostic: {
        rootCause:
          "The requested start ledger falls outside the retention period of the RPC server, making it unavailable for event streaming.",
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

export class LEDGER_TOO_HIGH extends EventStreamerError {
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

export class MISSING_ARCHIVE_RPC extends EventStreamerError {
  constructor() {
    super({
      code: Code.MISSING_ARCHIVE_RPC,
      message: "Archive RPC client is not configured",
      details:
        "The EventStreamer instance requires an archive RPC client to perform historical event ingestion, but none is configured.",
      diagnostic: {
        rootCause:
          "No archive RPC client has been assigned to the EventStreamer instance.",
        suggestion:
          "Configure an archive RPC client before attempting historical event ingestion.",
      },
      data: {},
    });
  }
}

export class INVALID_INGESTION_RANGE extends EventStreamerError {
  constructor(startLedger: number, stopLedger: number) {
    super({
      code: Code.INVALID_INGESTION_RANGE,
      message:
        "Invalid ingestion range: startLedger is greater than stopLedger",
      details: `The specified ingestion range is invalid because the start ledger ${startLedger} is greater than the stop ledger ${stopLedger}.`,
      diagnostic: {
        rootCause:
          "The provided start and stop ledger values do not define a valid range for event ingestion.",
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

export const ERROR_EVS = {
  [Code.PAGING_INTERVAL_TOO_LONG]: PAGING_INTERVAL_TOO_LONG,
  [Code.RPC_ALREADY_SET]: RPC_ALREADY_SET,
  [Code.ARCHIVE_RPC_ALREADY_SET]: ARCHIVE_RPC_ALREADY_SET,
  [Code.STREAMER_ALREADY_RUNNING]: STREAMER_ALREADY_RUNNING,
  [Code.RPC_NOT_HEALTHY]: RPC_NOT_HEALTHY,
  [Code.LEDGER_TOO_OLD]: LEDGER_TOO_OLD,
  [Code.LEDGER_TOO_HIGH]: LEDGER_TOO_HIGH,
  [Code.MISSING_ARCHIVE_RPC]: MISSING_ARCHIVE_RPC,
  [Code.INVALID_INGESTION_RANGE]: INVALID_INGESTION_RANGE,
};
