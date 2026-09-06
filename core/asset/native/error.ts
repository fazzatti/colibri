import { ColibriError } from "@/error/index.ts";

/** Stable errors for native Stellar asset account operations. */
export enum Code {
  INVALID_ASSET = "STAS_001",
  MISSING_RPC_URL = "STAS_002",
  INVALID_RPC = "STAS_003",
  NATIVE_TRUSTLINE = "STAS_004",
  CHANGE_TRUST_FAILED = "STAS_005",
  TRANSFER_FAILED = "STAS_006",
  NATIVE_TRUSTLINE_FLAGS = "STAS_007",
  TRUSTLINE_FLAGS_FAILED = "STAS_008",
  NATIVE_CLAWBACK = "STAS_009",
  CLAWBACK_FAILED = "STAS_010",
  READ_ISSUER_FAILED = "STAS_011",
  READ_TRUSTLINE_FAILED = "STAS_012",
  NATIVE_ASSET_CODE_MISMATCH = "STAS_013",
  INVALID_CANONICAL_ASSET = "STAS_014",
  ISSUER_BALANCE_UNDEFINED = "STAS_015",
  BALANCE_TRUSTLINE_MISSING = "STAS_016",
  READ_BALANCE_FAILED = "STAS_017",
  SAC_BINDING_FAILED = "STAS_018",
  NATIVE_MINT = "STAS_019",
  NATIVE_BURN = "STAS_020",
  NATIVE_AUTHORIZATION = "STAS_021",
  AUTHORIZATION_TRUSTLINE_MISSING = "STAS_022",
  CREATE_CLAIMABLE_BALANCE_FAILED = "STAS_023",
}

/** Base error preserving the original asset-operation failure. */
export abstract class StellarAssetError<C extends Code>
  extends ColibriError<C> {
  /** Records a stable failure site and its original cause. */
  constructor(code: C, message: string, cause?: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/asset/native",
      code,
      message,
      meta: { cause },
    });
  }
}

/** The supplied code/issuer cannot form a native SDK Asset. */
export class INVALID_ASSET extends StellarAssetError<Code.INVALID_ASSET> {
  /** Preserves the SDK asset-construction failure. */
  constructor(cause: unknown) {
    super(Code.INVALID_ASSET, "Unable to construct the Stellar asset.", cause);
  }
}
/** Neither a native RPC server nor a configured URL was supplied. */
export class MISSING_RPC_URL extends StellarAssetError<Code.MISSING_RPC_URL> {
  /** Describes the missing network dependency. */
  constructor() {
    super(Code.MISSING_RPC_URL, "Provide an RPC server or a network RPC URL.");
  }
}
/** The configured RPC endpoint cannot construct a native SDK server. */
export class INVALID_RPC extends StellarAssetError<Code.INVALID_RPC> {
  /** Preserves the RPC-construction failure. */
  constructor(cause: unknown) {
    super(Code.INVALID_RPC, "Unable to construct the asset RPC server.", cause);
  }
}
/** Native XLM has no trustline to create, adjust, or remove. */
export class NATIVE_TRUSTLINE extends StellarAssetError<Code.NATIVE_TRUSTLINE> {
  /** Explains the unsupported native-asset operation. */
  constructor() {
    super(Code.NATIVE_TRUSTLINE, "Native XLM does not have trustlines.");
  }
}
/** The SDK rejected arguments while constructing a trustline operation. */
export class CHANGE_TRUST_FAILED
  extends StellarAssetError<Code.CHANGE_TRUST_FAILED> {
  /** Preserves the operation-construction failure. */
  constructor(cause: unknown) {
    super(
      Code.CHANGE_TRUST_FAILED,
      "Unable to construct the change-trust operation.",
      cause,
    );
  }
}
/** The SDK rejected arguments while constructing a payment operation. */
export class TRANSFER_FAILED extends StellarAssetError<Code.TRANSFER_FAILED> {
  /** Preserves the operation-construction failure. */
  constructor(cause: unknown) {
    super(
      Code.TRANSFER_FAILED,
      "Unable to construct the asset transfer operation.",
      cause,
    );
  }
}
/** Native XLM has no issuer-managed trustline flags. */
export class NATIVE_TRUSTLINE_FLAGS
  extends StellarAssetError<Code.NATIVE_TRUSTLINE_FLAGS> {
  /** Explains the unsupported native-asset operation. */
  constructor() {
    super(
      Code.NATIVE_TRUSTLINE_FLAGS,
      "Native XLM has no trustline authorization flags.",
    );
  }
}
/** The SDK rejected arguments while constructing a trustline-flags operation. */
export class TRUSTLINE_FLAGS_FAILED
  extends StellarAssetError<Code.TRUSTLINE_FLAGS_FAILED> {
  /** Preserves the operation-construction failure. */
  constructor(cause: unknown) {
    super(
      Code.TRUSTLINE_FLAGS_FAILED,
      "Unable to construct the trustline-flags operation.",
      cause,
    );
  }
}
/** Native XLM cannot be clawed back by an issuer. */
export class NATIVE_CLAWBACK extends StellarAssetError<Code.NATIVE_CLAWBACK> {
  /** Explains the unsupported native-asset operation. */
  constructor() {
    super(
      Code.NATIVE_CLAWBACK,
      "Native XLM has no issuer and cannot be clawed back.",
    );
  }
}
/** The SDK rejected arguments while constructing a clawback operation. */
export class CLAWBACK_FAILED extends StellarAssetError<Code.CLAWBACK_FAILED> {
  /** Preserves the operation-construction failure. */
  constructor(cause: unknown) {
    super(
      Code.CLAWBACK_FAILED,
      "Unable to construct the asset clawback operation.",
      cause,
    );
  }
}

/** A non-Colibri RPC failure prevented reading the issuer account. */
export class READ_ISSUER_FAILED
  extends StellarAssetError<Code.READ_ISSUER_FAILED> {
  /** Retains the original issuer-read transport failure. */
  constructor(cause: unknown) {
    super(
      Code.READ_ISSUER_FAILED,
      "Unable to read the Stellar asset issuer.",
      cause,
    );
  }
}

/** A non-Colibri RPC failure prevented reading the holder's trustline. */
export class READ_TRUSTLINE_FAILED
  extends StellarAssetError<Code.READ_TRUSTLINE_FAILED> {
  /** Retains the original trustline-read transport failure. */
  constructor(cause: unknown) {
    super(
      Code.READ_TRUSTLINE_FAILED,
      "Unable to read the Stellar asset trustline.",
      cause,
    );
  }
}

/** A native issuer marker was paired with a code other than XLM. */
export class NATIVE_ASSET_CODE_MISMATCH
  extends StellarAssetError<Code.NATIVE_ASSET_CODE_MISMATCH> {
  /** Records the mislabeled native asset without silently replacing its identity. */
  constructor(code: string) {
    super(
      Code.NATIVE_ASSET_CODE_MISMATCH,
      `Native lumens require code XLM, not ${code}.`,
    );
  }
}

/** The supplied string is not an exact SEP-11 asset identity. */
export class INVALID_CANONICAL_ASSET
  extends StellarAssetError<Code.INVALID_CANONICAL_ASSET> {
  /** Records the invalid identity. */
  constructor(value: string) {
    super(Code.INVALID_CANONICAL_ASSET, `Invalid canonical asset: ${value}.`);
  }
}
/** An issuer has no finite native trustline balance of its own asset. */
export class ISSUER_BALANCE_UNDEFINED
  extends StellarAssetError<Code.ISSUER_BALANCE_UNDEFINED> {
  /** Explains why an issuer cannot be treated as a trustline holder. */
  constructor() {
    super(
      Code.ISSUER_BALANCE_UNDEFINED,
      "An issuer has no finite balance of its own issued asset.",
    );
  }
}
/** A requested balance cannot be read because no trustline exists. */
export class BALANCE_TRUSTLINE_MISSING
  extends StellarAssetError<Code.BALANCE_TRUSTLINE_MISSING> {
  /** Identifies the account whose holding is absent. */
  constructor(account: string) {
    super(
      Code.BALANCE_TRUSTLINE_MISSING,
      `No trustline exists for ${account}.`,
    );
  }
}
/** A transport failure prevented reading the native asset balance. */
export class READ_BALANCE_FAILED
  extends StellarAssetError<Code.READ_BALANCE_FAILED> {
  /** Retains the account-read failure. */
  constructor(cause: unknown) {
    super(
      Code.READ_BALANCE_FAILED,
      "Unable to read the native asset balance.",
      cause,
    );
  }
}
/** The associated Stellar Asset Contract could not be bound. */
export class SAC_BINDING_FAILED
  extends StellarAssetError<Code.SAC_BINDING_FAILED> {
  /** Retains the SAC binding failure. */
  constructor(cause: unknown) {
    super(
      Code.SAC_BINDING_FAILED,
      "Unable to bind the Stellar Asset Contract.",
      cause,
    );
  }
}
/** Native XLM cannot be minted by a user account. */
export class NATIVE_MINT extends StellarAssetError<Code.NATIVE_MINT> {
  /** Explains the missing native issuer. */
  constructor() {
    super(
      Code.NATIVE_MINT,
      "Native XLM has no issuer from which to mint units.",
    );
  }
}
/** Native XLM cannot be burned by paying an issuer. */
export class NATIVE_BURN extends StellarAssetError<Code.NATIVE_BURN> {
  /** Explains the missing burn destination. */
  constructor() {
    super(
      Code.NATIVE_BURN,
      "Native XLM has no issuer to which to return units for burning.",
    );
  }
}

/** Native XLM has no issuer-managed authorization. */
export class NATIVE_AUTHORIZATION
  extends StellarAssetError<Code.NATIVE_AUTHORIZATION> {
  /** Explains why native XLM authorization cannot be changed. */
  constructor() {
    super(
      Code.NATIVE_AUTHORIZATION,
      "Native XLM has no issuer-managed authorization.",
    );
  }
}

/** Revocation cannot determine the current authorization without a trustline. */
export class AUTHORIZATION_TRUSTLINE_MISSING
  extends StellarAssetError<Code.AUTHORIZATION_TRUSTLINE_MISSING> {
  /** Identifies the account with no trustline to revoke. */
  constructor(account: string) {
    super(
      Code.AUTHORIZATION_TRUSTLINE_MISSING,
      `No trustline exists to revoke authorization for ${account}.`,
    );
  }
}

/** The SDK rejected the asset's claimable-balance construction arguments. */
export class CREATE_CLAIMABLE_BALANCE_FAILED
  extends StellarAssetError<Code.CREATE_CLAIMABLE_BALANCE_FAILED> {
  /** Preserves the native operation-construction failure. */
  constructor(cause: unknown) {
    super(
      Code.CREATE_CLAIMABLE_BALANCE_FAILED,
      "Unable to construct the asset claimable-balance operation.",
      cause,
    );
  }
}

/** Asset-operation error constructors indexed by stable code. */
export const ERROR_STAS = {
  [Code.INVALID_ASSET]: INVALID_ASSET,
  [Code.MISSING_RPC_URL]: MISSING_RPC_URL,
  [Code.INVALID_RPC]: INVALID_RPC,
  [Code.NATIVE_TRUSTLINE]: NATIVE_TRUSTLINE,
  [Code.CHANGE_TRUST_FAILED]: CHANGE_TRUST_FAILED,
  [Code.TRANSFER_FAILED]: TRANSFER_FAILED,
  [Code.NATIVE_TRUSTLINE_FLAGS]: NATIVE_TRUSTLINE_FLAGS,
  [Code.TRUSTLINE_FLAGS_FAILED]: TRUSTLINE_FLAGS_FAILED,
  [Code.NATIVE_CLAWBACK]: NATIVE_CLAWBACK,
  [Code.CLAWBACK_FAILED]: CLAWBACK_FAILED,
  [Code.READ_ISSUER_FAILED]: READ_ISSUER_FAILED,
  [Code.READ_TRUSTLINE_FAILED]: READ_TRUSTLINE_FAILED,
  [Code.NATIVE_ASSET_CODE_MISMATCH]: NATIVE_ASSET_CODE_MISMATCH,
  [Code.INVALID_CANONICAL_ASSET]: INVALID_CANONICAL_ASSET,
  [Code.ISSUER_BALANCE_UNDEFINED]: ISSUER_BALANCE_UNDEFINED,
  [Code.BALANCE_TRUSTLINE_MISSING]: BALANCE_TRUSTLINE_MISSING,
  [Code.READ_BALANCE_FAILED]: READ_BALANCE_FAILED,
  [Code.SAC_BINDING_FAILED]: SAC_BINDING_FAILED,
  [Code.NATIVE_MINT]: NATIVE_MINT,
  [Code.NATIVE_BURN]: NATIVE_BURN,
  [Code.NATIVE_AUTHORIZATION]: NATIVE_AUTHORIZATION,
  [Code.AUTHORIZATION_TRUSTLINE_MISSING]: AUTHORIZATION_TRUSTLINE_MISSING,
  [Code.CREATE_CLAIMABLE_BALANCE_FAILED]: CREATE_CLAIMABLE_BALANCE_FAILED,
};
