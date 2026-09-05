import type { Asset as NativeAsset, Operation } from "stellar-sdk";
import type { Server as NativeServer } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";
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

/** Asset identity and network used by a {@link StellarAsset}. */
export type StellarAssetArgs =
  & {
    /** Network passphrase and, unless `rpc` is supplied, RPC endpoint. */
    networkConfig: NetworkConfig;
    /** Optional native SDK RPC server, shared by reads and the transaction pipe. */
    rpc?: Server;
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
