import { SignerError } from "@/signer/error.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";

/**
 * Stable error codes emitted by {@link DelegatedSigner}.
 */
export enum Code {
  DUPLICATE_NESTED_DELEGATE = "SIG_DEL_001",
  FAILED_TO_BUILD_DELEGATED_ENTRY = "SIG_DEL_002",
  FAILED_TO_AUTHORIZE_DELEGATE = "SIG_DEL_003",
}

type Address = Ed25519PublicKey | ContractId;

/** Base class for delegated-signer failures. */
export abstract class DelegatedSignerError extends SignerError<
  Code,
  { address: Address }
> {
  /** Source identifier for delegated-signer failures. */
  override readonly source = "@colibri/core/signer/delegated";
}

/** Raised when two siblings represent the same delegate address. */
export class DUPLICATE_NESTED_DELEGATE extends DelegatedSignerError {
  /**
   * Creates a duplicate-delegate error.
   *
   * @param address - Parent signer address.
   * @param duplicateAddress - Duplicate sibling delegate address.
   */
  constructor(address: Address, duplicateAddress: Address) {
    super({
      code: Code.DUPLICATE_NESTED_DELEGATE,
      message: "Nested delegate addresses must be unique!",
      data: { address },
      details:
        `The delegated signer '${address}' contains duplicate nested delegate '${duplicateAddress}'.`,
      diagnostic: {
        rootCause:
          "CAP-71 requires each sibling delegate array to contain unique addresses.",
        suggestion: "Remove the duplicate nested delegate.",
      },
    });
  }
}

/** Raised when the SDK cannot materialize the configured delegate topology. */
export class FAILED_TO_BUILD_DELEGATED_ENTRY extends DelegatedSignerError {
  /**
   * Creates a delegated-entry build failure.
   *
   * @param address - Top-level authorization address.
   * @param cause - Underlying SDK failure.
   */
  constructor(address: Address, cause: Error) {
    super({
      code: Code.FAILED_TO_BUILD_DELEGATED_ENTRY,
      message: "Failed to build delegated authorization entry!",
      data: { address },
      details:
        "The configured delegated signer topology could not be materialized into the authorization entry.",
      cause,
    });
  }
}

/** Raised when a signer cannot authorize its configured credential node. */
export class FAILED_TO_AUTHORIZE_DELEGATE extends DelegatedSignerError {
  /**
   * Creates a delegate authorization failure.
   *
   * @param address - Credential node being authorized.
   * @param cause - Underlying signer failure.
   */
  constructor(address: Address, cause: Error) {
    super({
      code: Code.FAILED_TO_AUTHORIZE_DELEGATE,
      message: "Failed to authorize delegated credential node!",
      data: { address },
      details:
        `The signer configured for '${address}' could not authorize its credential node.`,
      cause,
    });
  }
}

/** Delegated-signer error constructors indexed by stable code. */
export const ERROR_BY_CODE = {
  [Code.DUPLICATE_NESTED_DELEGATE]: DUPLICATE_NESTED_DELEGATE,
  [Code.FAILED_TO_BUILD_DELEGATED_ENTRY]: FAILED_TO_BUILD_DELEGATED_ENTRY,
  [Code.FAILED_TO_AUTHORIZE_DELEGATE]: FAILED_TO_AUTHORIZE_DELEGATE,
};
