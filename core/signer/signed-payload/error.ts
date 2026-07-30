import { SignerError } from "@/signer/error.ts";
import type { Ed25519PublicKey, SignedPayload } from "@/strkeys/types.ts";

/** Stable error codes emitted by {@link Ed25519SignedPayloadSigner}. */
export enum Code {
  INVALID_PAYLOAD_LENGTH = "SIG_SPL_001",
  FAILED_TO_GET_PUBLIC_KEY = "SIG_SPL_002",
  FAILED_TO_DECODE_PUBLIC_KEY = "SIG_SPL_003",
  FAILED_TO_HASH_TRANSACTION = "SIG_SPL_004",
  FAILED_TO_SIGN_PAYLOAD = "SIG_SPL_005",
  FAILED_TO_BUILD_DECORATED_SIGNATURE = "SIG_SPL_006",
  FAILED_TO_ADD_DECORATED_SIGNATURE = "SIG_SPL_007",
  FAILED_TO_SERIALIZE_TRANSACTION = "SIG_SPL_008",
  FAILED_TO_NORMALIZE_PAYLOAD = "SIG_SPL_009",
  FAILED_TO_BUILD_SIGNER_KEY_XDR = "SIG_SPL_010",
  FAILED_TO_ENCODE_SIGNER_KEY = "SIG_SPL_011",
  FAILED_TO_NORMALIZE_SIGNATURE = "SIG_SPL_012",
}

type MetaData = {
  payloadLength?: number;
  publicKey?: Ed25519PublicKey;
  signerKey?: SignedPayload;
};

/** Base class for signed-payload signer failures. */
export abstract class SignedPayloadSignerError extends SignerError<
  Code,
  MetaData
> {
  /** Source identifier for signed-payload signer failures. */
  override readonly source = "@colibri/core/signer/signed-payload";
}

/** Raised when a payload is empty or exceeds the protocol limit. */
export class INVALID_PAYLOAD_LENGTH extends SignedPayloadSignerError {
  /** @param payloadLength - Supplied payload length in bytes. */
  constructor(payloadLength: number) {
    super({
      code: Code.INVALID_PAYLOAD_LENGTH,
      message: "Signed payload length is invalid!",
      data: { payloadLength },
      details:
        `The signed payload is ${payloadLength} bytes long, but Stellar requires between 1 and 64 bytes.`,
      diagnostic: {
        rootCause: "The supplied payload is empty or exceeds 64 bytes.",
        suggestion: "Use a non-empty payload containing at most 64 bytes.",
      },
    });
  }
}

/** Raised when the underlying Ed25519 signer cannot expose its public key. */
export class FAILED_TO_GET_PUBLIC_KEY extends SignedPayloadSignerError {
  /** @param cause - Underlying signer failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_GET_PUBLIC_KEY,
      message: "Failed to get the signed-payload public key!",
      data: {},
      details:
        "The underlying Ed25519 signer could not provide its public key.",
      cause,
    });
  }
}

/** Raised when the configured Ed25519 public key cannot be decoded. */
export class FAILED_TO_DECODE_PUBLIC_KEY extends SignedPayloadSignerError {
  /**
   * Creates a public-key decoding error.
   *
   * @param publicKey - Ed25519 key bound to the payload.
   * @param cause - Underlying SDK failure.
   */
  constructor(publicKey: Ed25519PublicKey, cause: Error) {
    super({
      code: Code.FAILED_TO_DECODE_PUBLIC_KEY,
      message: "Failed to decode the signed-payload public key!",
      data: { publicKey },
      details:
        `The public key '${publicKey}' could not be decoded into Ed25519 bytes.`,
      cause,
    });
  }
}

/** Raised when a transaction hash cannot be derived for a payload. */
export class FAILED_TO_HASH_TRANSACTION extends SignedPayloadSignerError {
  /** @param cause - Underlying transaction hashing failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_HASH_TRANSACTION,
      message: "Failed to hash the future transaction!",
      data: {},
      details:
        "The future transaction could not be converted into a signed payload.",
      cause,
    });
  }
}

/** Raised when the underlying Ed25519 signer cannot sign the payload. */
export class FAILED_TO_SIGN_PAYLOAD extends SignedPayloadSignerError {
  /**
   * @param signerKey - Signed-payload key being authorized.
   * @param cause - Underlying signer failure.
   */
  constructor(signerKey: SignedPayload, cause: Error) {
    super({
      code: Code.FAILED_TO_SIGN_PAYLOAD,
      message: "Failed to sign the configured payload!",
      data: { signerKey },
      details: `The payload represented by '${signerKey}' could not be signed.`,
      cause,
    });
  }
}

/** Raised when the signed-payload signature cannot be decorated. */
export class FAILED_TO_BUILD_DECORATED_SIGNATURE
  extends SignedPayloadSignerError {
  /**
   * @param signerKey - Signed-payload key being decorated.
   * @param cause - Underlying XDR failure.
   */
  constructor(signerKey: SignedPayload, cause: Error) {
    super({
      code: Code.FAILED_TO_BUILD_DECORATED_SIGNATURE,
      message: "Failed to build the signed-payload decorated signature!",
      data: { signerKey },
      details:
        `The signature for '${signerKey}' could not be represented as envelope XDR.`,
      cause,
    });
  }
}

/** Raised when the decorated signature cannot be added to the envelope. */
export class FAILED_TO_ADD_DECORATED_SIGNATURE
  extends SignedPayloadSignerError {
  /**
   * @param signerKey - Signed-payload key being applied.
   * @param cause - Underlying transaction failure.
   */
  constructor(signerKey: SignedPayload, cause: Error) {
    super({
      code: Code.FAILED_TO_ADD_DECORATED_SIGNATURE,
      message: "Failed to add the signed-payload signature!",
      data: { signerKey },
      details:
        `The decorated signature for '${signerKey}' could not be added to the transaction envelope.`,
      cause,
    });
  }
}

/** Raised when the signed-payload-authorized transaction cannot be serialized. */
export class FAILED_TO_SERIALIZE_TRANSACTION extends SignedPayloadSignerError {
  /**
   * @param signerKey - Signed-payload key already applied.
   * @param cause - Underlying serialization failure.
   */
  constructor(signerKey: SignedPayload, cause: Error) {
    super({
      code: Code.FAILED_TO_SERIALIZE_TRANSACTION,
      message: "Failed to serialize the signed-payload transaction!",
      data: { signerKey },
      details:
        `The transaction authorized by '${signerKey}' could not be serialized to XDR.`,
      cause,
    });
  }
}

/** Raised when supplied payload bytes cannot be normalized. */
export class FAILED_TO_NORMALIZE_PAYLOAD extends SignedPayloadSignerError {
  /** Creates a payload-normalization error. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_NORMALIZE_PAYLOAD,
      message: "Failed to normalize the signed payload!",
      data: {},
      details:
        "The supplied payload is not a supported JavaScript binary value.",
      cause,
    });
  }
}

/** Raised when the signed-payload signer-key XDR cannot be built. */
export class FAILED_TO_BUILD_SIGNER_KEY_XDR extends SignedPayloadSignerError {
  /**
   * Creates a signer-key XDR construction error.
   *
   * @param publicKey - Ed25519 key bound to the payload.
   * @param cause - Underlying XDR failure.
   */
  constructor(publicKey: Ed25519PublicKey, cause: Error) {
    super({
      code: Code.FAILED_TO_BUILD_SIGNER_KEY_XDR,
      message: "Failed to build signed-payload signer-key XDR!",
      data: { publicKey },
      details:
        `The public key '${publicKey}' and payload could not be represented as signer-key XDR.`,
      cause,
    });
  }
}

/** Raised when signed-payload signer-key XDR cannot be encoded as `P...`. */
export class FAILED_TO_ENCODE_SIGNER_KEY extends SignedPayloadSignerError {
  /**
   * Creates a signer-key StrKey encoding error.
   *
   * @param publicKey - Ed25519 key bound to the payload.
   * @param cause - Underlying signer-key encoding failure.
   */
  constructor(publicKey: Ed25519PublicKey, cause: Error) {
    super({
      code: Code.FAILED_TO_ENCODE_SIGNER_KEY,
      message: "Failed to encode the signed-payload signer key!",
      data: { publicKey },
      details:
        `The signer-key XDR for public key '${publicKey}' could not be encoded as a P... StrKey.`,
      cause,
    });
  }
}

/** Raised when returned signature bytes cannot be normalized. */
export class FAILED_TO_NORMALIZE_SIGNATURE extends SignedPayloadSignerError {
  /**
   * Creates a payload-signature normalization error.
   *
   * @param signerKey - Signed-payload key being authorized.
   * @param cause - Underlying normalization failure.
   */
  constructor(signerKey: SignedPayload, cause: Error) {
    super({
      code: Code.FAILED_TO_NORMALIZE_SIGNATURE,
      message: "Failed to normalize the signed-payload signature!",
      data: { signerKey },
      details:
        `The signature returned for '${signerKey}' is not a supported JavaScript binary value.`,
      cause,
    });
  }
}

/** Signed-payload signer error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.INVALID_PAYLOAD_LENGTH]: INVALID_PAYLOAD_LENGTH,
  [Code.FAILED_TO_GET_PUBLIC_KEY]: FAILED_TO_GET_PUBLIC_KEY,
  [Code.FAILED_TO_DECODE_PUBLIC_KEY]: FAILED_TO_DECODE_PUBLIC_KEY,
  [Code.FAILED_TO_HASH_TRANSACTION]: FAILED_TO_HASH_TRANSACTION,
  [Code.FAILED_TO_SIGN_PAYLOAD]: FAILED_TO_SIGN_PAYLOAD,
  [Code.FAILED_TO_BUILD_DECORATED_SIGNATURE]:
    FAILED_TO_BUILD_DECORATED_SIGNATURE,
  [Code.FAILED_TO_ADD_DECORATED_SIGNATURE]: FAILED_TO_ADD_DECORATED_SIGNATURE,
  [Code.FAILED_TO_SERIALIZE_TRANSACTION]: FAILED_TO_SERIALIZE_TRANSACTION,
  [Code.FAILED_TO_NORMALIZE_PAYLOAD]: FAILED_TO_NORMALIZE_PAYLOAD,
  [Code.FAILED_TO_BUILD_SIGNER_KEY_XDR]: FAILED_TO_BUILD_SIGNER_KEY_XDR,
  [Code.FAILED_TO_ENCODE_SIGNER_KEY]: FAILED_TO_ENCODE_SIGNER_KEY,
  [Code.FAILED_TO_NORMALIZE_SIGNATURE]: FAILED_TO_NORMALIZE_SIGNATURE,
};
