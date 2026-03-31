import { ColibriError } from "@colibri/core";

/**
 * Stable error codes emitted by the channel-accounts package.
 */
export enum Code {
  UNEXPECTED_ERROR = "PLG_CHA_000",
  MISSING_ARG = "PLG_CHA_001",
  INVALID_NUMBER_OF_CHANNELS = "PLG_CHA_002",
  CHANNEL_NOT_ALLOCATED = "PLG_CHA_003",
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

/**
 * Error code to constructor map exported for error introspection and testing.
 */
export const ERROR_PLG_CHA = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
  [Code.MISSING_ARG]: MISSING_ARG,
  [Code.INVALID_NUMBER_OF_CHANNELS]: INVALID_NUMBER_OF_CHANNELS,
  [Code.CHANNEL_NOT_ALLOCATED]: CHANNEL_NOT_ALLOCATED,
};
