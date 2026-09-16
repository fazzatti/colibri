import type { WalletAuthEntryOptions } from "@/wallets/auth-entry/index.ts";
import type * as Kit from "@creit.tech/stellar-wallets-kit/sdk";
import type {
  AuthEntrySigner,
  MessageSigner,
  Signer,
} from "@colibri/core/signers";

/** Published Kit 2.6+ API used by the adapter; the application owns initialization. */
export type StellarWalletsKitApi =
  & Pick<
    (typeof Kit)["StellarWalletsKit"],
    | "authModal"
    | "getAddress"
    | "getNetwork"
    | "signTransaction"
    | "selectedModule"
    | "disconnect"
    | "on"
  >
  & Partial<Pick<(typeof Kit)["StellarWalletsKit"], "signAuthEntry">>;

/** Account and module for which the application declares signing capabilities. */
export interface WalletsKitAccount {
  /** Kit's active account; distinct from authority supplied by custom signers. */
  address: string;
  /** Network read from the selected wallet module. */
  networkPassphrase: string;
  /** The actual upstream module, including its stable productId. */
  module: StellarWalletsKitApi["selectedModule"];
}

/** Explicit capabilities; method presence alone does not establish wallet support. */
export interface WalletsKitCapabilities {
  /** Adapt Kit transaction signing for this G-address. Omitted means unavailable. */
  envelope?: boolean;
  /** Opt in with createWalletAuthEntrySigner; connection-only bundles do not load XDR. */
  authEntry?: (options: WalletAuthEntryOptions) => AuthEntrySigner;
  /** Additional application-owned Core signers, including contract-account authorization. */
  signers?: readonly Signer[];
  /** Application-owned SEP-53 message signer, if supported by this wallet. */
  messageSigner?: MessageSigner;
}

/** Application policy for the optional Wallets Kit connector. */
export interface StellarWalletsKitConnectorOptions {
  /** Stable connector identifier; defaults to stellar-wallets-kit. */
  id?: string;
  /** Declare capabilities for the selected module and account, without prompting. */
  capabilities(account: WalletsKitAccount): WalletsKitCapabilities;
  /** Explicit connection UI; defaults to kit.authModal(). Must update Kit's active account. */
  connect?: () => ReturnType<StellarWalletsKitApi["authModal"]>;
}
