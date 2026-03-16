import { SignerError } from "@/signer/error.ts";

export enum Code {
  CANNOT_REMOVE_MASTER_TARGET = "SIG_LOC_001",
  SECRET_NOT_ACCESSIBLE = "SIG_LOC_002",
  SIGNER_DESTROYED = "SIG_LOC_003",
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
      details: `The signer's own public key is a required target and cannot be removed from the signer's targets list.`,
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

export const ERROR_SIG_LOC = {
  [Code.CANNOT_REMOVE_MASTER_TARGET]: CANNOT_REMOVE_MASTER_TARGET,
  [Code.SECRET_NOT_ACCESSIBLE]: SECRET_NOT_ACCESSIBLE,
  [Code.SIGNER_DESTROYED]: SIGNER_DESTROYED,
};
