import { ColibriError } from "@colibri/core";

/**
 * Stable error codes emitted by the channel-accounts package.
 */
export enum Code {
  UNEXPECTED_ERROR = "PLG_CHA_000",
  MISSING_ARG = "PLG_CHA_001",
  INVALID_NUMBER_OF_CHANNELS = "PLG_CHA_002",
  CHANNEL_NOT_ALLOCATED = "PLG_CHA_003",
  INVALID_CONCURRENCY = "PLG_CHA_004",
  INVALID_WORKER_CONFIGURATION = "PLG_CHA_005",
  CHANNEL_WORKERS_CLOSED = "PLG_CHA_006",
  CHANNEL_WORKER_CAPACITY = "PLG_CHA_007",
  CHANNELS_UNAVAILABLE = "PLG_CHA_008",
  CHANNEL_BINDING_MISMATCH = "PLG_CHA_009",
  INVALID_WORKER_PAYLOAD = "PLG_CHA_010",
  CHANNEL_WORKER_FAILED = "PLG_CHA_011",
  INVALID_CHANNEL_CONFIGURATION = "PLG_CHA_012",
}

const SOURCE = "@colibri/plugin-channel-accounts";

/**
 * Base class for all channel-accounts errors.
 */
export abstract class ChannelAccountsError extends ColibriError<Code> {
  override readonly source = SOURCE;
}

/**
 * Wraps unexpected non-Colibri exceptions raised by the package internals.
 */
export class UNEXPECTED_ERROR extends ChannelAccountsError {
  /**
   * Creates an unexpected-error wrapper for a caught internal failure.
   *
   * @param cause - Underlying error thrown by the runtime.
   */
  constructor(cause: Error) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.UNEXPECTED_ERROR,
      message: "Unexpected channel accounts error.",
      details: "See the cause for more details.",
      meta: { cause },
    });
  }
}

/**
 * Raised when a required argument is omitted from a public API call.
 */
export class MISSING_ARG extends ChannelAccountsError {
  /**
   * Creates a missing-argument error.
   *
   * @param argName - Name of the missing argument.
   */
  constructor(argName: string) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.MISSING_ARG,
      message: `Missing required argument: ${argName}`,
      details: `The argument '${argName}' is required but was not provided.`,
      meta: { data: { argName } },
    });
  }
}

/**
 * Raised when channel creation requests an out-of-bounds number of channels.
 */
export class INVALID_NUMBER_OF_CHANNELS extends ChannelAccountsError {
  /**
   * Creates an invalid-channel-count error.
   *
   * @param numberOfChannels - Requested channel count.
   * @param min - Inclusive minimum accepted by the API.
   * @param max - Inclusive maximum accepted by the API.
   */
  constructor(
    numberOfChannels: number,
    min = 1,
    max = 15,
  ) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.INVALID_NUMBER_OF_CHANNELS,
      message: `Invalid number of channels: ${numberOfChannels}`,
      details:
        `Channel creation must request between ${min} and ${max} channels.`,
      meta: {
        data: { numberOfChannels, min, max },
      },
    });
  }
}

/**
 * Raised when a plugin run tries to release a channel that is not allocated.
 */
export class CHANNEL_NOT_ALLOCATED extends ChannelAccountsError {
  /**
   * Creates a missing-allocation error for a pipeline run.
   *
   * @param runId - Identifier of the pipeline run attempting the release.
   */
  constructor(runId: string) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.CHANNEL_NOT_ALLOCATED,
      message: `No channel is allocated for run '${runId}'.`,
      details:
        "The channel pool tried to release a channel that is not currently locked.",
      meta: {
        data: { runId },
      },
    });
  }
}

/** Raised before RPC work when the requested async capacity is invalid. */
export class INVALID_CONCURRENCY extends ChannelAccountsError {
  /**
   * Describes a rejected signer-discovery capacity without starting work.
   * @param concurrency - Supplied capacity; positive safe integers are accepted.
   */
  constructor(concurrency: number) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.INVALID_CONCURRENCY,
      message: "Channel concurrency must be a positive safe integer.",
      details:
        "Set concurrency to the maximum simultaneous signer lookups per batch.",
      meta: { data: { concurrency } },
    });
  }
}

/** Raised when a channel-worker definition or executor configuration is invalid. */
export class INVALID_WORKER_CONFIGURATION extends ChannelAccountsError {
  /**
   * Describes invalid setup without starting an account operation.
   * @param option - Invalid option name, excluding credentials or payload data.
   * @param details - Required shape or constraint for the option.
   */
  constructor(option: string, details: string) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.INVALID_WORKER_CONFIGURATION,
      message: `Invalid channel-worker configuration: ${option}.`,
      details,
      meta: { data: { option } },
    });
  }
}

/** Raised when a stopped channel-worker owner receives a new or waiting request. */
export class CHANNEL_WORKERS_CLOSED extends ChannelAccountsError {
  /** Creates a terminal lifecycle error; constructing it does not stop transports. */
  constructor() {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.CHANNEL_WORKERS_CLOSED,
      message: "The channel-worker executor is closed.",
      details:
        "Closed executors do not restart. Reconcile uncertain account outcomes before creating a new owner.",
    });
  }
}

/** Raised before a request acquires a channel when the admission limit is full. */
export class CHANNEL_WORKER_CAPACITY extends ChannelAccountsError {
  /**
   * Describes a rejected request without dispatching or acquiring an account.
   * @param maxPending - Maximum active and waiting requests for this executor.
   */
  constructor(maxPending: number) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.CHANNEL_WORKER_CAPACITY,
      message: "The channel-worker executor has reached its request capacity.",
      details:
        "Wait for existing work to finish or configure a larger maxPending limit.",
      meta: { data: { maxPending } },
    });
  }
}

/** Raised when every channel is quarantined or unavailable and no request can proceed. */
export class CHANNELS_UNAVAILABLE extends ChannelAccountsError {
  /** Creates an unavailable-account error without resetting or reusing any account. */
  constructor() {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.CHANNELS_UNAVAILABLE,
      message: "No healthy channel accounts remain in this executor.",
      details:
        "Inspect getChannels(), reconcile transaction outcomes with the ledger, and explicitly create a new owner for recovered accounts.",
    });
  }
}

/** Raised inside a worker before execution when its assigned account does not match. */
export class CHANNEL_BINDING_MISMATCH extends ChannelAccountsError {
  /**
   * Describes an invalid address assignment without executing the task.
   * @param expected - Public address assigned by the executor or worker instance.
   * @param actual - Public address in the request or returned account.
   */
  constructor(expected: string, actual: string) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.CHANNEL_BINDING_MISMATCH,
      message: "The channel worker cannot change its assigned account.",
      details:
        "Load exactly the public address supplied to initialize, and keep each worker bound to that account.",
      meta: { data: { expected, actual } },
    });
  }
}

/** Raised before admission when request arguments cannot cross the worker boundary. */
export class INVALID_WORKER_PAYLOAD extends ChannelAccountsError {
  /**
   * Describes a failed input snapshot; no account has been leased or dispatched.
   * @param cause - Native structured-clone failure.
   */
  constructor(cause: Error) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.INVALID_WORKER_PAYLOAD,
      message: "Channel-worker inputs must be structured-cloneable data.",
      details:
        "Create signers, clients and pipelines inside the worker. Pass plain request data from the caller.",
      meta: { cause },
    });
  }
}

/** Describes a worker execution failure and whether its channel requires reconciliation. */
export class CHANNEL_WORKER_FAILED extends ChannelAccountsError {
  /**
   * Retains worker diagnostics while making account recovery explicit.
   * @param address - Public channel address selected for the failed request.
   * @param cause - Convee transport/task failure; remote exceptions are diagnostic data.
   * @param quarantined - Whether this executor permanently retires the account.
   */
  constructor(address: string, cause: Error, quarantined: boolean) {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.CHANNEL_WORKER_FAILED,
      message: `Channel-worker execution failed for '${address}'.`,
      details: quarantined
        ? "The account is quarantined. The transaction may have been submitted; reconcile with the ledger before explicit reuse. No retry occurred."
        : "The request failed before execution. No transaction was retried.",
      meta: { cause, data: { address, quarantined } },
    });
  }
}

/** Raised when a local channel executor has no accounts or no executable. */
export class INVALID_CHANNEL_CONFIGURATION extends ChannelAccountsError {
  /** Creates a setup error without allocating an account or starting a pipeline. */
  constructor() {
    super({
      domain: "plugins",
      source: SOURCE,
      code: Code.INVALID_CHANNEL_CONFIGURATION,
      message:
        "Channel execution requires at least one account and a callable run function.",
      details:
        "Provide a fixed channel set and an existing transaction pipeline or function. Use createChannelAccountsPlugin when registration must remain dynamic.",
    });
  }
}

/**
 * Error code to constructor map exported for error introspection and testing.
 */
export const ERROR_PLG_CHA = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.INVALID_NUMBER_OF_CHANNELS]: INVALID_NUMBER_OF_CHANNELS,
  [Code.CHANNEL_NOT_ALLOCATED]: CHANNEL_NOT_ALLOCATED,
  [Code.INVALID_CONCURRENCY]: INVALID_CONCURRENCY,
  [Code.INVALID_WORKER_CONFIGURATION]: INVALID_WORKER_CONFIGURATION,
  [Code.CHANNEL_WORKERS_CLOSED]: CHANNEL_WORKERS_CLOSED,
  [Code.CHANNEL_WORKER_CAPACITY]: CHANNEL_WORKER_CAPACITY,
  [Code.CHANNELS_UNAVAILABLE]: CHANNELS_UNAVAILABLE,
  [Code.CHANNEL_BINDING_MISMATCH]: CHANNEL_BINDING_MISMATCH,
  [Code.INVALID_WORKER_PAYLOAD]: INVALID_WORKER_PAYLOAD,
  [Code.CHANNEL_WORKER_FAILED]: CHANNEL_WORKER_FAILED,
  [Code.INVALID_CHANNEL_CONFIGURATION]: INVALID_CHANNEL_CONFIGURATION,
};
