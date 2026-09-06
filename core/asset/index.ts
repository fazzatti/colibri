import * as StellarAssetContractErrors from "@/asset/sac/error.ts";
import * as SEP41TokenContractErrors from "@/asset/sep41-token/error.ts";
import * as StellarAssetErrors from "@/asset/native/error.ts";
import * as StellarAssetAmountErrors from "@/asset/native/amount.error.ts";

export * from "@/asset/native/index.ts";
/** Error constructors for StellarAsset amount conversion. */
export const ERRORS_STELLAR_ASSET_AMOUNT: typeof StellarAssetAmountErrors =
  StellarAssetAmountErrors;
/** Error constructors for native Stellar asset account operations. */
export const ERRORS_STELLAR_ASSET: typeof StellarAssetErrors =
  StellarAssetErrors;

export * from "@/asset/sep11/index.ts";
export type * from "@/asset/sep11/types.ts";

export * from "@/asset/sac/index.ts";
export * from "@/asset/sac/types.ts";
/** Error constructors for Stellar Asset Contract helpers. */
export const ERRORS_SAC: typeof StellarAssetContractErrors =
  StellarAssetContractErrors;

export * from "@/asset/sep41-token/index.ts";
/** Error constructors for the SEP-41 token client. */
export const ERRORS_SEP41_TOKEN: typeof SEP41TokenContractErrors =
  SEP41TokenContractErrors;
