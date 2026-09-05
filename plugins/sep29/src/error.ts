import { ColibriError, PluginError } from "@colibri/core";
import type { Ed25519PublicKey } from "@colibri/core";

/** Stable SEP-29 checker and plugin error codes. */
export enum Code {
  INVALID_TRANSACTION = "PLG_SEP29_001",
  FAILED_TO_CREATE_READER = "PLG_SEP29_002",
  FAILED_TO_READ_REQUIREMENTS = "PLG_SEP29_003",
  MEMO_REQUIRED = "PLG_SEP29_004",
}

/** Base error namespace shared by the standalone checker and plugin. */
export abstract class Sep29Error extends PluginError<Code, unknown> {
  /** Published source of this error. */
  override readonly source = "@colibri/plugin-sep29";
}

/** The checker did not receive a native transaction or fee-bump transaction. */
export class INVALID_TRANSACTION extends Sep29Error {
  /** Creates a typed transaction-shape failure. */
  constructor() {
    super({
      code: Code.INVALID_TRANSACTION,
      message: "Expected a Stellar transaction or fee-bump transaction.",
      details:
        "Pass the native SDK transaction instance, not encoded XDR or a plain object.",
      data: {},
    });
  }
}

/** The provided network/client configuration could not construct a ledger reader. */
export class FAILED_TO_CREATE_READER extends Sep29Error {
  /** Preserves the original configuration failure. */
  constructor(cause: unknown) {
    super({
      code: Code.FAILED_TO_CREATE_READER,
      message: "Could not configure the SEP-29 ledger reader.",
      details:
        "Provide either a Colibri NetworkConfig with an RPC URL or a native RPC client.",
      data: {},
      cause: ColibriError.fromUnknown(cause),
    });
  }
}

/** RPC or data decoding failed; submission must not silently skip the check. */
export class FAILED_TO_READ_REQUIREMENTS extends Sep29Error {
  /** Records the queried destinations and original failure. */
  constructor(destinations: Ed25519PublicKey[], cause: unknown) {
    super({
      code: Code.FAILED_TO_READ_REQUIREMENTS,
      message: "Could not read destination memo requirements.",
      details:
        "Submission was prevented. Check the configured RPC connection and retry the check explicitly.",
      data: { destinations },
      cause: ColibriError.fromUnknown(cause),
    });
  }
}

/** A non-muxed destination requires a memo, but the transaction has MEMO_NONE. */
export class MEMO_REQUIRED extends Sep29Error {
  /** G account that opted into SEP-29. */
  readonly destination: Ed25519PublicKey;
  /** Zero-based position of the first operation targeting that destination. */
  readonly operationIndex: number;
  /** Creates a memo-presence failure without choosing a memo value for the caller. */
  constructor(destination: Ed25519PublicKey, operationIndex: number) {
    super({
      code: Code.MEMO_REQUIRED,
      message: "The destination requires a transaction memo.",
      details:
        "Supply the memo requested by the recipient. SEP-29 does not validate its type or contents.",
      data: { destination, operationIndex },
    });
    this.destination = destination;
    this.operationIndex = operationIndex;
  }
}

/** SEP-29 error constructors indexed by stable code. */
export const ERROR_PLG_SEP29 = {
  [Code.INVALID_TRANSACTION]: INVALID_TRANSACTION,
  [Code.FAILED_TO_CREATE_READER]: FAILED_TO_CREATE_READER,
  [Code.FAILED_TO_READ_REQUIREMENTS]: FAILED_TO_READ_REQUIREMENTS,
  [Code.MEMO_REQUIRED]: MEMO_REQUIRED,
};
