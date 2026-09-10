import { SignerError } from "@/signer/error.ts";

/** Stable codes for LocalSigner configuration, lifecycle and signing errors. */
export enum Code {
  CANNOT_REMOVE_MASTER_TARGET = "SIG_LOC_001",
  SECRET_NOT_ACCESSIBLE = "SIG_LOC_002",
  SIGNER_DESTROYED = "SIG_LOC_003",
  MESSAGE_SIGNER_DESTROYED = "SIG_LOC_004",
  MESSAGE_SIGNING_FAILED = "SIG_LOC_005",
  MESSAGE_VERIFICATION_FAILED = "SIG_LOC_006",
  KEYPAIR_CANNOT_SIGN = "SIG_LOC_007",
  KEYPAIR_ADAPTATION_FAILED = "SIG_LOC_008",
}
/** Metadata supported by LocalSigner errors. */
export type MetaData = unknown;

/** Base class for LocalSigner errors. */
export abstract class LocalSignerError extends SignerError<Code, MetaData> {
  /** Module that produced the error. */
  override readonly source = "@colibri/core/signer/local";
}

/** The signer's own account cannot be removed from its targets. */
export class CANNOT_REMOVE_MASTER_TARGET extends LocalSignerError {
  /** Creates the corresponding LocalSigner error without retaining key material. */
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

/** Secret access was explicitly disabled for this signer. */
export class SECRET_NOT_ACCESSIBLE extends LocalSignerError {
  /** Creates the corresponding LocalSigner error without retaining key material. */
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

/** Signing was attempted after the signer was destroyed. */
export class SIGNER_DESTROYED extends LocalSignerError {
  /** Creates the corresponding LocalSigner error without retaining key material. */
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

/** A public-only keypair cannot create a signing LocalSigner. */
export class KEYPAIR_CANNOT_SIGN extends LocalSignerError {
  /** Reports the missing signing capability without retaining the keypair. */
  constructor() {
    super({
      code: Code.KEYPAIR_CANNOT_SIGN,
      message: "The keypair does not contain a signing key",
      details:
        "Pass a native Stellar SDK keypair that can sign to LocalSigner.fromKeypair().",
      data: null,
    });
  }
}

/** A native keypair could not be adapted to a LocalSigner. */
export class KEYPAIR_ADAPTATION_FAILED extends LocalSignerError {
  /** Retains the cause without copying the supplied keypair into metadata. */
  constructor(cause: Error) {
    super({
      code: Code.KEYPAIR_ADAPTATION_FAILED,
      message: "Failed to create a LocalSigner from the keypair",
      details: "Provide a valid native Stellar SDK signing Keypair.",
      cause,
      data: null,
    });
  }
}

/** Error constructors indexed by their stable code. */
export const ERROR_SIG_LOC = {
  ["SIG_LOC_001" as Code.CANNOT_REMOVE_MASTER_TARGET]:
    CANNOT_REMOVE_MASTER_TARGET,
  ["SIG_LOC_002" as Code.SECRET_NOT_ACCESSIBLE]: SECRET_NOT_ACCESSIBLE,
  ["SIG_LOC_003" as Code.SIGNER_DESTROYED]: SIGNER_DESTROYED,
  ["SIG_LOC_004" as Code.MESSAGE_SIGNER_DESTROYED]: MESSAGE_SIGNER_DESTROYED,
  ["SIG_LOC_005" as Code.MESSAGE_SIGNING_FAILED]: MESSAGE_SIGNING_FAILED,
  ["SIG_LOC_006" as Code.MESSAGE_VERIFICATION_FAILED]:
    MESSAGE_VERIFICATION_FAILED,
  ["SIG_LOC_007" as Code.KEYPAIR_CANNOT_SIGN]: KEYPAIR_CANNOT_SIGN,
  ["SIG_LOC_008" as Code.KEYPAIR_ADAPTATION_FAILED]: KEYPAIR_ADAPTATION_FAILED,
};
