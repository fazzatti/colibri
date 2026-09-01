import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when a network-backed target lacks network configuration. */
export class MissingTargetNetworkError
  extends BuildVerificationError<Code.MISSING_TARGET_NETWORK> {
  /** Creates a missing target-network error. */
  constructor() {
    super({
      code: Code.MISSING_TARGET_NETWORK,
      source: "@colibri/build-verification/providers/target",
      message: "Missing target network",
      details:
        "A contract id, Wasm hash, or external-reference target requires networkConfig, rpc, or rpcUrl plus networkPassphrase.",
    });
  }
}

/** Compatibility error for a general Stellar RPC target-resolution failure. */
export class TargetResolutionFailedError
  extends BuildVerificationError<Code.TARGET_RESOLUTION_FAILED> {
  /** Creates a general target-resolution error. */
  constructor(target: string, cause: unknown) {
    super({
      code: Code.TARGET_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/target",
      message: "Failed to resolve verification target",
      details:
        "The requested contract instance or contract code could not be read from Stellar RPC.",
      data: { target },
      cause,
    });
  }
}

/** Raised when network inputs cannot initialize a target RPC reader. */
export class TargetRpcInitializationFailedError
  extends BuildVerificationError<Code.TARGET_RPC_INITIALIZATION_FAILED> {
  /** Creates an RPC reader initialization error. */
  constructor(cause: unknown) {
    super({
      code: Code.TARGET_RPC_INITIALIZATION_FAILED,
      source: "@colibri/build-verification/providers/target/stellar",
      message: "Failed to initialize target RPC",
      details:
        "The supplied Colibri network or granular RPC inputs could not initialize a target ledger reader.",
      cause,
    });
  }
}

/** Raised when a requested Wasm hash differs from RPC's returned code hash. */
export class TargetHashMismatchError
  extends BuildVerificationError<Code.TARGET_HASH_MISMATCH> {
  /** Creates a target hash-mismatch error. */
  constructor(expected: string, actual: string) {
    super({
      code: Code.TARGET_HASH_MISMATCH,
      source: "@colibri/build-verification/providers/target/stellar",
      message: "Resolved target hash mismatch",
      details:
        "Stellar RPC returned contract code whose observed hash differs from the requested Wasm hash.",
      data: { expected, actual },
    });
  }
}

/** Raised when a contract-instance lookup fails. */
export class TargetInstanceLookupFailedError
  extends BuildVerificationError<Code.TARGET_INSTANCE_LOOKUP_FAILED> {
  /** Creates a contract-instance lookup error. */
  constructor(contractId: string, cause: unknown) {
    super({
      code: Code.TARGET_INSTANCE_LOOKUP_FAILED,
      source: "@colibri/build-verification/providers/target/stellar",
      message: "Failed to resolve contract instance",
      details:
        "The target contract instance could not be read from Stellar RPC.",
      data: { contractId },
      cause,
    });
  }
}

/** Raised when a contract-code lookup fails after the target is known. */
export class TargetCodeLookupFailedError
  extends BuildVerificationError<Code.TARGET_CODE_LOOKUP_FAILED> {
  /** Creates a contract-code lookup error. */
  constructor(target: string, cause: unknown) {
    super({
      code: Code.TARGET_CODE_LOOKUP_FAILED,
      source: "@colibri/build-verification/providers/target/stellar",
      message: "Failed to resolve contract code",
      details:
        "The exact target Wasm bytes could not be read from Stellar RPC.",
      data: { target },
      cause,
    });
  }
}

/** Raised when a target provider throws an untyped value unexpectedly. */
export class TargetProviderUnexpectedError
  extends BuildVerificationError<Code.TARGET_PROVIDER_UNEXPECTED> {
  /** Creates an unexpected provider error. */
  constructor(cause: unknown) {
    super({
      code: Code.TARGET_PROVIDER_UNEXPECTED,
      source: "@colibri/build-verification/providers/target",
      message: "Unexpected target provider failure",
      details:
        "The selected target resolver failed outside its typed contract.",
      cause,
    });
  }
}

/** Raised when an owner/tag executable reference cannot be resolved. */
export class TargetExternalReferenceLookupFailedError
  extends BuildVerificationError<Code.TARGET_EXTERNAL_REFERENCE_LOOKUP_FAILED> {
  /** Creates an external-reference lookup error. */
  constructor(target: string, cause: unknown) {
    super({
      code: Code.TARGET_EXTERNAL_REFERENCE_LOOKUP_FAILED,
      source: "@colibri/build-verification/providers/target/stellar",
      message: "Failed to resolve external executable reference",
      details:
        "The owner-scoped executable tag could not be resolved to its currently selected Wasm hash through Stellar RPC.",
      data: { target },
      cause,
    });
  }
}
