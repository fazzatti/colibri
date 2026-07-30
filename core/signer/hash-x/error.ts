import { SignerError } from "@/signer/error.ts";
import type { Sha256Hash } from "@/strkeys/types.ts";

/** Stable error codes emitted by {@link HashXSigner}. */
export enum Code {
  INVALID_PREIMAGE_LENGTH = "SIG_HSX_001",
  PREIMAGE_NOT_ACCESSIBLE = "SIG_HSX_002",
  SIGNER_DESTROYED = "SIG_HSX_003",
  FAILED_TO_GENERATE_PREIMAGE = "SIG_HSX_004",
  FAILED_TO_DERIVE_HASH = "SIG_HSX_005",
  FAILED_TO_ENCODE_SIGNER_KEY = "SIG_HSX_006",
  FAILED_TO_ADD_PREIMAGE_SIGNATURE = "SIG_HSX_007",
  FAILED_TO_SERIALIZE_TRANSACTION = "SIG_HSX_008",
  FAILED_TO_NORMALIZE_PREIMAGE = "SIG_HSX_009",
}

type MetaData = {
  preimageLength?: number;
  signerKey?: Sha256Hash;
};

/** Base class for Hash-X signer failures. */
export abstract class HashXSignerError extends SignerError<Code, MetaData> {
  /** Source identifier for Hash-X signer failures. */
  override readonly source = "@colibri/core/signer/hash-x";
}

/** Raised when a Hash-X preimage exceeds Stellar's 64-byte signature limit. */
export class INVALID_PREIMAGE_LENGTH extends HashXSignerError {
  /** @param preimageLength - Supplied preimage length in bytes. */
  constructor(preimageLength: number) {
    super({
      code: Code.INVALID_PREIMAGE_LENGTH,
      message: "Hash-X preimage is too long!",
      data: { preimageLength },
      details:
        `The Hash-X preimage is ${preimageLength} bytes long, but Stellar signatures permit at most 64 bytes.`,
      diagnostic: {
        rootCause: "The supplied preimage exceeds the protocol limit.",
        suggestion: "Use a preimage containing at most 64 bytes.",
      },
    });
  }
}

/** Raised when direct preimage access was disabled. */
export class PREIMAGE_NOT_ACCESSIBLE extends HashXSignerError {
  constructor() {
    super({
      code: Code.PREIMAGE_NOT_ACCESSIBLE,
      message: "Hash-X preimage is not accessible!",
      data: {},
      details:
        "This signer was configured to retain the preimage only for envelope authorization.",
    });
  }
}

/** Raised when a destroyed Hash-X signer is used. */
export class SIGNER_DESTROYED extends HashXSignerError {
  constructor() {
    super({
      code: Code.SIGNER_DESTROYED,
      message: "Hash-X signer has been destroyed!",
      data: {},
      details:
        "The signer no longer retains its preimage and cannot authorize transactions.",
    });
  }
}

/** Raised when secure random preimage generation fails. */
export class FAILED_TO_GENERATE_PREIMAGE extends HashXSignerError {
  /** @param cause - Underlying random-source failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_GENERATE_PREIMAGE,
      message: "Failed to generate a Hash-X preimage!",
      data: {},
      details: "The runtime could not produce a secure random preimage.",
      cause,
    });
  }
}

/** Raised when the SDK cannot hash the configured preimage. */
export class FAILED_TO_DERIVE_HASH extends HashXSignerError {
  /** @param cause - Underlying hashing failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_DERIVE_HASH,
      message: "Failed to derive the Hash-X digest!",
      data: {},
      details: "The SDK could not calculate SHA-256 for the supplied preimage.",
      cause,
    });
  }
}

/** Raised when the Hash-X digest cannot be encoded as an `X...` signer key. */
export class FAILED_TO_ENCODE_SIGNER_KEY extends HashXSignerError {
  /** @param cause - Underlying StrKey encoding failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_ENCODE_SIGNER_KEY,
      message: "Failed to encode the Hash-X signer key!",
      data: {},
      details: "The derived digest could not be encoded as an X... StrKey.",
      cause,
    });
  }
}

/** Raised when the SDK cannot append the preimage signature. */
export class FAILED_TO_ADD_PREIMAGE_SIGNATURE extends HashXSignerError {
  /**
   * @param signerKey - Hash-X signer key being applied.
   * @param cause - Underlying SDK failure.
   */
  constructor(signerKey: Sha256Hash, cause: Error) {
    super({
      code: Code.FAILED_TO_ADD_PREIMAGE_SIGNATURE,
      message: "Failed to add the Hash-X preimage signature!",
      data: { signerKey },
      details:
        `The preimage for signer '${signerKey}' could not be added to the transaction envelope.`,
      cause,
    });
  }
}

/** Raised when the Hash-X-authorized transaction cannot be serialized. */
export class FAILED_TO_SERIALIZE_TRANSACTION extends HashXSignerError {
  /**
   * @param signerKey - Hash-X signer key already applied.
   * @param cause - Underlying serialization failure.
   */
  constructor(signerKey: Sha256Hash, cause: Error) {
    super({
      code: Code.FAILED_TO_SERIALIZE_TRANSACTION,
      message: "Failed to serialize the Hash-X-authorized transaction!",
      data: { signerKey },
      details:
        `The transaction authorized by '${signerKey}' could not be serialized to XDR.`,
      cause,
    });
  }
}

/** Raised when supplied preimage bytes cannot be normalized. */
export class FAILED_TO_NORMALIZE_PREIMAGE extends HashXSignerError {
  /** Creates a preimage-normalization error. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_NORMALIZE_PREIMAGE,
      message: "Failed to normalize the Hash-X preimage!",
      data: {},
      details:
        "The supplied preimage is not a supported JavaScript binary value.",
      cause,
    });
  }
}

/** Hash-X signer error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.INVALID_PREIMAGE_LENGTH]: INVALID_PREIMAGE_LENGTH,
  [Code.PREIMAGE_NOT_ACCESSIBLE]: PREIMAGE_NOT_ACCESSIBLE,
  [Code.SIGNER_DESTROYED]: SIGNER_DESTROYED,
  [Code.FAILED_TO_GENERATE_PREIMAGE]: FAILED_TO_GENERATE_PREIMAGE,
  [Code.FAILED_TO_DERIVE_HASH]: FAILED_TO_DERIVE_HASH,
  [Code.FAILED_TO_ENCODE_SIGNER_KEY]: FAILED_TO_ENCODE_SIGNER_KEY,
  [Code.FAILED_TO_ADD_PREIMAGE_SIGNATURE]: FAILED_TO_ADD_PREIMAGE_SIGNATURE,
  [Code.FAILED_TO_SERIALIZE_TRANSACTION]: FAILED_TO_SERIALIZE_TRANSACTION,
  [Code.FAILED_TO_NORMALIZE_PREIMAGE]: FAILED_TO_NORMALIZE_PREIMAGE,
};
