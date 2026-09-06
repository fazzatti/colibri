import type { Asset as NativeAsset, Operation } from "stellar-sdk";
import type { Server as NativeServer } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";
import type { ClassicTransactionPipelinePlugins } from "@/pipelines/classic-transaction/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

/** @internal Exact native SDK asset type. */
export type Asset = NativeAsset;
/** @internal Exact native SDK RPC server type. */
export type Server = NativeServer;
/** @internal Exact native SDK trustline-operation options. */
export type ChangeTrustOpts = Parameters<typeof Operation.changeTrust>[0];
/** @internal Exact native SDK payment-operation options. */
export type PaymentOpts = Parameters<typeof Operation.payment>[0];
/** @internal Exact native SDK trustline-flags options. */
export type SetTrustLineFlagsOpts = Parameters<
  typeof Operation.setTrustLineFlags
>[0];
/** @internal Exact native SDK clawback-operation options. */
export type ClawbackOpts = Parameters<typeof Operation.clawback>[0];
/** @internal Exact native SDK claimable-balance options, including Claimant[]. */
export type CreateClaimableBalanceOpts = Parameters<
  typeof Operation.createClaimableBalance
>[0];

/** Asset identity and network used by a {@link StellarAsset}. */
export type StellarAssetArgs =
  & {
    /** Network passphrase and, unless `rpc` is supplied, RPC endpoint. */
    networkConfig: NetworkConfig;
    /** Optional native SDK RPC server, shared by reads and the transaction pipe. */
    rpc?: Server;
    /** Plugins for the owned transaction pipe, including channel accounts and fee bumps. */
    plugins?: ClassicTransactionPipelinePlugins;
  }
  & (
    | {
      /** Native SDK asset, retained without wrapping or copying. */ asset:
        Asset;
    }
    | {
      /** Issued asset code, including issuer-backed assets named `XLM`. */
      code: string;
      /** Issuer account defining the issued asset identity. */
      issuer: Ed25519PublicKey;
    }
    | {
      /** Native lumens use the exact code `XLM`. */
      code: "XLM";
      /** Explicit marker selecting native lumens. */
      issuer: "native";
    }
  );

/** Explicit trustline creation, limit adjustment, or removal (`limit: "0"`). */
export type StellarAssetChangeTrustArgs =
  & Omit<ChangeTrustOpts, "asset" | "line">
  & {
    /** Envelope configuration. The operation defaults to this source before plugins run. */
    config: TransactionConfig;
  };

/** Transfer of this asset using the native payment operation. */
export type StellarAssetTransferArgs =
  & Omit<PaymentOpts, "asset">
  & {
    /** Envelope configuration; includes any additional operation-source signer. */
    config: TransactionConfig;
  };

/** Explicit issuer-managed trustline flag changes. */
export type StellarAssetSetTrustLineFlagsArgs =
  & Omit<SetTrustLineFlagsOpts, "asset">
  & {
    /** Envelope configuration. The operation defaults to the asset issuer. */
    config: TransactionConfig;
  };

/** Issuer clawback of an explicitly selected holder and amount. */
export type StellarAssetClawbackArgs =
  & Omit<ClawbackOpts, "asset">
  & {
    /** Envelope configuration. The operation defaults to the asset issuer. */
    config: TransactionConfig;
  };

/** Connection shared by native asset factories. */
export type StellarAssetNetwork = {
  networkConfig: NetworkConfig;
  rpc?: Server;
  /** Plugins for the native transaction pipe; not copied by `toContract()`. */
  plugins?: ClassicTransactionPipelinePlugins;
};
/** Inputs for native asset balance and authorization reads. */
export type StellarAssetBalanceArgs = { id: Ed25519PublicKey };
/** Mints units through an issuer-signed native payment. */
export type StellarAssetMintArgs = Omit<StellarAssetTransferArgs, "source">;
/** Burns units through a holder-signed payment back to the issuer. */
export type StellarAssetBurnArgs = Omit<
  StellarAssetTransferArgs,
  "destination"
>;

/** Issuer-controlled transfer authorization, preserving existing liabilities on revocation. */
export type StellarAssetSetAuthorizedArgs = {
  /** Account whose trustline authorization is changed. */
  id: Ed25519PublicKey;
  /** Enable full authorization, or revoke transfers while retaining existing liabilities. */
  authorize: boolean;
  /** Envelope configuration; the operation is always sourced by the asset issuer. */
  config: TransactionConfig;
};

/** Creates a claimable balance of this asset with native SDK claimants and predicates. */
export type StellarAssetCreateClaimableBalanceArgs =
  & Omit<CreateClaimableBalanceOpts, "asset">
  & {
    /** Envelope configuration; the operation defaults to its source before plugins run. */
    config: TransactionConfig;
  };
