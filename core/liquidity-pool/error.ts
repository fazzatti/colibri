import { ColibriError } from "@/error/index.ts";

/** Stable codes for native liquidity-pool helpers. */
export enum Code {
  INVALID_ASSET_PAIR = "NLP_001",
  FAILED_TO_CREATE_RPC = "NLP_002",
  FAILED_TO_BUILD_TRUSTLINE = "NLP_003",
  FAILED_TO_BUILD_DEPOSIT = "NLP_004",
  FAILED_TO_BUILD_WITHDRAWAL = "NLP_005",
  FAILED_TO_READ_POOL = "NLP_006",
  POOL_NOT_FOUND = "NLP_007",
  INVALID_DEPOSIT_ASSETS = "NLP_008",
  INVALID_WITHDRAWAL_ASSETS = "NLP_009",
  FAILED_TO_READ_TRUSTLINE = "NLP_010",
}

/** Base error for explicit protocol-native pool actions. */
export abstract class NativeLiquidityPoolError
  extends ColibriError<Code, { cause?: unknown }> {
  /** Creates an error preserving its original cause. */
  constructor(code: Code, message: string, cause?: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/liquidity-pool",
      code,
      message,
      details: message,
      meta: { cause },
    });
  }
}
/** Invalid or identical assets cannot identify a pool. */
export class INVALID_ASSET_PAIR extends NativeLiquidityPoolError {
  /** Creates a pool-identity error. */
  constructor(cause: unknown) {
    super(
      Code.INVALID_ASSET_PAIR,
      "Expected two distinct native SDK assets.",
      cause,
    );
  }
}
/** The configured RPC endpoint could not be instantiated. */
export class FAILED_TO_CREATE_RPC extends NativeLiquidityPoolError {
  /** Creates an RPC construction error. */
  constructor(cause: unknown) {
    super(
      Code.FAILED_TO_CREATE_RPC,
      "Could not create the pool RPC client.",
      cause,
    );
  }
}
/** The native SDK rejected the trustline operation. */
export class FAILED_TO_BUILD_TRUSTLINE extends NativeLiquidityPoolError {
  /** Creates a trustline construction error. */
  constructor(cause: unknown) {
    super(
      Code.FAILED_TO_BUILD_TRUSTLINE,
      "Could not build the pool-share trustline change.",
      cause,
    );
  }
}
/** The native SDK rejected the deposit operation. */
export class FAILED_TO_BUILD_DEPOSIT extends NativeLiquidityPoolError {
  /** Creates a deposit construction error. */
  constructor(cause: unknown) {
    super(
      Code.FAILED_TO_BUILD_DEPOSIT,
      "Could not build the pool deposit.",
      cause,
    );
  }
}
/** The native SDK rejected the withdrawal operation. */
export class FAILED_TO_BUILD_WITHDRAWAL extends NativeLiquidityPoolError {
  /** Creates a withdrawal construction error. */
  constructor(cause: unknown) {
    super(
      Code.FAILED_TO_BUILD_WITHDRAWAL,
      "Could not build the pool withdrawal.",
      cause,
    );
  }
}
/** RPC retrieval or decoding of the requested pool failed. */
export class FAILED_TO_READ_POOL extends NativeLiquidityPoolError {
  /** Creates a pool-read error. */
  constructor(cause: unknown) {
    super(
      Code.FAILED_TO_READ_POOL,
      "Could not read the pool ledger entry.",
      cause,
    );
  }
}
/** A successful RPC lookup contained no entry for the pool. */
export class POOL_NOT_FOUND extends NativeLiquidityPoolError {
  /** Creates a not-found error distinct from RPC failure. */
  constructor() {
    super(
      Code.POOL_NOT_FOUND,
      "The requested pool does not exist in the observed ledger.",
    );
  }
}
/** Deposit maximums must name each pool asset exactly once. */
export class INVALID_DEPOSIT_ASSETS extends NativeLiquidityPoolError {
  /** Creates a deposit asset-mapping error. */
  constructor() {
    super(
      Code.INVALID_DEPOSIT_ASSETS,
      "Deposit maximums must specify each pool asset exactly once.",
    );
  }
}
/** Withdrawal minimums must name each pool asset exactly once. */
export class INVALID_WITHDRAWAL_ASSETS extends NativeLiquidityPoolError {
  /** Creates a withdrawal asset-mapping error. */
  constructor() {
    super(
      Code.INVALID_WITHDRAWAL_ASSETS,
      "Withdrawal minimums must specify each pool asset exactly once.",
    );
  }
}

/** RPC transport failed while reading a pool-share trustline. */
export class FAILED_TO_READ_TRUSTLINE extends NativeLiquidityPoolError {
  /** Creates a trustline-read error, preserving the underlying cause. */
  constructor(cause: unknown) {
    super(
      Code.FAILED_TO_READ_TRUSTLINE,
      "Could not read the pool-share trustline.",
      cause,
    );
  }
}
