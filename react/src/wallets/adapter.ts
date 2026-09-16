import type { EnvelopeSigner } from "@colibri/core/signers";
import type { Ed25519PublicKey } from "@colibri/core/strkey";
import type { WalletConnector } from "@/context/config.ts";
import { ReactNetworkMismatchError } from "@/errors/index.ts";
/** Explicit XDR signing bridge for browser wallets such as Freighter or Wallets Kit. */
export interface WalletEnvelopeOptions {
  /** The actual Ed25519 signer key, independently of a controlled account. */
  publicKey: Ed25519PublicKey;
  /** Network reported by the wallet. */
  networkPassphrase: string;
  /** Optional controlled G/C accounts; defaults to the signer public key. */
  accounts?: readonly string[];
  /** Ask the wallet to sign the complete envelope and return signed XDR. */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}
/** Adapt an explicit wallet envelope capability to Core, without importing a wallet SDK. */
export function createWalletEnvelopeSigner(
  options: WalletEnvelopeOptions,
): EnvelopeSigner {
  const accounts = new Set(options.accounts ?? [options.publicKey]);
  return {
    signerKey: () => options.publicKey,
    signsFor: (target) => accounts.has(target),
    signTransaction: async (transaction) => {
      if (transaction.networkPassphrase !== options.networkPassphrase) {
        throw new ReactNetworkMismatchError(
          "Transaction and wallet networks differ",
        );
      }
      return await options.signTransaction(
        transaction.toXDR(),
        options.networkPassphrase,
      );
    },
  };
}
/** Define a connector around an application-owned wallet SDK and its actual capabilities. */
export function createWalletConnector(
  connector: WalletConnector,
): WalletConnector {
  return Object.freeze({ ...connector });
}
