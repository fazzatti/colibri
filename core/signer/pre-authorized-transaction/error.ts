import { SignerError } from "@/signer/error.ts";
import type { PreAuthTx } from "@/strkeys/types.ts";

/** Stable error codes emitted by {@link PreAuthorizedTransactionSigner}. */
export enum Code {
  INVALID_TRANSACTION_HASH_LENGTH = "SIG_PAT_001",
  FAILED_TO_HASH_TRANSACTION_DURING_CREATION = "SIG_PAT_002",
  FAILED_TO_DECODE_SIGNER_KEY = "SIG_PAT_003",
  FAILED_TO_ENCODE_SIGNER_KEY = "SIG_PAT_004",
  FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION = "SIG_PAT_005",
  FAILED_TO_NORMALIZE_TRANSACTION_HASH = "SIG_PAT_006",
}

type MetaData = {
  hashLength?: number;
  signerKey?: PreAuthTx;
};

/** Base class for pre-authorized transaction signer failures. */
export abstract class PreAuthorizedTransactionSignerError extends SignerError<
  Code,
  MetaData
> {
  /** Source identifier for pre-authorized transaction signer failures. */
  override readonly source = "@colibri/core/signer/pre-authorized-transaction";
}

/** Raised when a supplied transaction hash is not 32 bytes. */
export class INVALID_TRANSACTION_HASH_LENGTH
  extends PreAuthorizedTransactionSignerError {
  /** @param hashLength - Supplied transaction hash length in bytes. */
  constructor(hashLength: number) {
    super({
      code: Code.INVALID_TRANSACTION_HASH_LENGTH,
      message: "Pre-authorized transaction hash length is invalid!",
      data: { hashLength },
      details:
        `The supplied transaction hash is ${hashLength} bytes long, but Stellar transaction hashes must contain 32 bytes.`,
    });
  }
}

/** Raised when the factory cannot hash a prepared transaction. */
export class FAILED_TO_HASH_TRANSACTION_DURING_CREATION
  extends PreAuthorizedTransactionSignerError {
  /** @param cause - Underlying transaction hashing failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_HASH_TRANSACTION_DURING_CREATION,
      message: "Failed to hash the prepared transaction!",
      data: {},
      details:
        "The pre-authorized transaction signer could not be created from the supplied transaction.",
      cause,
    });
  }
}

/** Raised when a supplied `T...` key cannot be decoded. */
export class FAILED_TO_DECODE_SIGNER_KEY
  extends PreAuthorizedTransactionSignerError {
  /**
   * @param signerKey - Invalid pre-authorized transaction signer key.
   * @param cause - Underlying StrKey decoding failure.
   */
  constructor(signerKey: PreAuthTx, cause: Error) {
    super({
      code: Code.FAILED_TO_DECODE_SIGNER_KEY,
      message: "Failed to decode the pre-authorized transaction signer key!",
      data: { signerKey },
      details: `The signer key '${signerKey}' could not be decoded.`,
      cause,
    });
  }
}

/** Raised when raw transaction-hash bytes cannot be encoded as a `T...` key. */
export class FAILED_TO_ENCODE_SIGNER_KEY
  extends PreAuthorizedTransactionSignerError {
  /** @param cause - Underlying StrKey encoding failure. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_ENCODE_SIGNER_KEY,
      message: "Failed to encode the pre-authorized transaction signer key!",
      data: {},
      details: "The transaction hash could not be encoded as a T... StrKey.",
      cause,
    });
  }
}

/** Raised when authorization-time transaction hashing fails. */
export class FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION
  extends PreAuthorizedTransactionSignerError {
  /**
   * @param signerKey - Pre-authorized signer being checked.
   * @param cause - Underlying transaction hashing failure.
   */
  constructor(signerKey: PreAuthTx, cause: Error) {
    super({
      code: Code.FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION,
      message: "Failed to verify the pre-authorized transaction hash!",
      data: { signerKey },
      details:
        `The transaction could not be hashed while checking signer '${signerKey}'.`,
      cause,
    });
  }
}

/** Raised when raw transaction-hash bytes cannot be normalized. */
export class FAILED_TO_NORMALIZE_TRANSACTION_HASH
  extends PreAuthorizedTransactionSignerError {
  /** Creates a transaction-hash normalization error. */
  constructor(cause: Error) {
    super({
      code: Code.FAILED_TO_NORMALIZE_TRANSACTION_HASH,
      message: "Failed to normalize the pre-authorized transaction hash!",
      data: {},
      details:
        "The supplied transaction hash is not a supported JavaScript binary value.",
      cause,
    });
  }
}

/** Pre-authorized transaction signer errors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.INVALID_TRANSACTION_HASH_LENGTH]: INVALID_TRANSACTION_HASH_LENGTH,
  [Code.FAILED_TO_HASH_TRANSACTION_DURING_CREATION]:
    FAILED_TO_HASH_TRANSACTION_DURING_CREATION,
  [Code.FAILED_TO_DECODE_SIGNER_KEY]: FAILED_TO_DECODE_SIGNER_KEY,
  [Code.FAILED_TO_ENCODE_SIGNER_KEY]: FAILED_TO_ENCODE_SIGNER_KEY,
  [Code.FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION]:
    FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION,
  [Code.FAILED_TO_NORMALIZE_TRANSACTION_HASH]:
    FAILED_TO_NORMALIZE_TRANSACTION_HASH,
};
