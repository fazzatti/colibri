import { SignerError } from "@/signer/error.ts";

export enum Code {
  CANNOT_REMOVE_MASTER_TARGET = "SIG_LOC_001",
  SECRET_NOT_ACCESSIBLE = "SIG_LOC_002",
  SIGNER_DESTROYED = "SIG_LOC_003",
  MESSAGE_SIGNER_DESTROYED = "SIG_LOC_004",
  MESSAGE_SIGNING_FAILED = "SIG_LOC_005",
  MESSAGE_VERIFICATION_FAILED = "SIG_LOC_006",
}
export type MetaData = unknown;

export abstract class LocalSignerError extends SignerError<Code, MetaData> {
  override readonly source = "@colibri/core/signer/local";
}

export class CANNOT_REMOVE_MASTER_TARGET extends LocalSignerError {
  constructor() {
    super({
      code: Code.CANNOT_REMOVE_MASTER_TARGET,
      message: "Cannot remove signer's own public key from targets!",
      data: null,
      details:
        `The signer's own public key is a required target and cannot be removed from the signer's targets list.`,
      diagnostic: {
        rootCause:
          "An attempt was made to remove the signer's own public key from targets.",
        suggestion:
          "Do not attempt to remove the signer's own public key from its targets list.",
      },
    });
  }
}

export class SECRET_NOT_ACCESSIBLE extends LocalSignerError {
  constructor() {
    super({
      code: Code.SECRET_NOT_ACCESSIBLE,
      message: "Secret key is not accessible",
      data: null,
      details: `The secret key is hidden and cannot be accessed.`,
      diagnostic: {
        rootCause:
          "An attempt was made to access the secret key when it is hidden.",
        suggestion:
          "Do not attempt to access the secret key when it is hidden. If you need the secret key, create the LocalSigner without the option to hide the secret.",
      },
    });
  }
}

export class SIGNER_DESTROYED extends LocalSignerError {
  constructor() {
    super({
      code: Code.SIGNER_DESTROYED,
      message: "Signer has been destroyed",
      data: null,
      details: `The signer has been destroyed and can no longer be used.`,
      diagnostic: {
        rootCause: "An operation was attempted on a destroyed signer.",
        suggestion:
          "Do not use the signer after it has been destroyed. Create a new signer if needed.",
      },
    });
  }
}

/** SEP-53 signing was attempted after the local secret was destroyed. */
export class MESSAGE_SIGNER_DESTROYED extends LocalSignerError {
  /** Creates a message-specific lifecycle error without retaining input bytes. */
  constructor() {
    super({
      code: Code.MESSAGE_SIGNER_DESTROYED,
      message: "Cannot sign a message after the signer has been destroyed",
      details: "Create an active LocalSigner before requesting SEP-53 signing.",
      data: null,
    });
  }
}

/** The native SDK could not sign the supplied SEP-53 message. */
export class MESSAGE_SIGNING_FAILED extends LocalSignerError {
  /** Retains the underlying failure, without copying message or secret bytes. */
  constructor(cause: Error) {
    super({
      code: Code.MESSAGE_SIGNING_FAILED,
      message: "Failed to sign a SEP-53 message",
      details:
        "Provide a UTF-8 string or Uint8Array message to an active signer.",
      cause,
      data: null,
    });
  }
}

/** The native SDK rejected malformed SEP-53 verification inputs. */
export class MESSAGE_VERIFICATION_FAILED extends LocalSignerError {
  /** Retains the cause without copying message or signature bytes. */
  constructor(cause: Error) {
    super({
      code: Code.MESSAGE_VERIFICATION_FAILED,
      message: "Failed to verify a SEP-53 message",
      details:
        "Provide UTF-8 text or Uint8Array message bytes and a detached signature.",
      cause,
      data: null,
    });
  }
}

export const ERROR_SIG_LOC = {
  [Code.CANNOT_REMOVE_MASTER_TARGET]: CANNOT_REMOVE_MASTER_TARGET,
  [Code.SECRET_NOT_ACCESSIBLE]: SECRET_NOT_ACCESSIBLE,
  [Code.SIGNER_DESTROYED]: SIGNER_DESTROYED,
  [Code.MESSAGE_SIGNER_DESTROYED]: MESSAGE_SIGNER_DESTROYED,
  [Code.MESSAGE_SIGNING_FAILED]: MESSAGE_SIGNING_FAILED,
  [Code.MESSAGE_VERIFICATION_FAILED]: MESSAGE_VERIFICATION_FAILED,
};
