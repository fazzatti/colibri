import type { xdr as XDR } from "stellar-sdk/base";
import { type Ed25519PublicKey, StrKey } from "@colibri/core/strkey";
import type { AuthEntrySigner } from "@colibri/core/signers";
import {
  ReactInvalidConfigError,
  ReactNetworkMismatchError,
  ReactUnsupportedCapabilityError,
} from "@/errors/index.ts";

/** Explicit G-account authorization capability; separate from envelope signing. */
export interface WalletAuthEntryOptions {
  /** Account whose Soroban authorization the wallet can sign. */
  address: Ed25519PublicKey;
  /** Wallet-reported network passphrase. */
  networkPassphrase: string;
  /** Sign the complete authorization entry, preserving invocation, nonce and expiry. */
  signAuthEntry(xdr: string, networkPassphrase: string): Promise<string>;
}

/**
 * Adapt wallet authorization without inferring capability from a wallet method.
 * Copies the entry before setting expiry. Rejects changed address, nonce,
 * invocation or expiry returned by the wallet. Contract accounts require an
 * application-supplied signer implementing their own authorization policy.
 */
export function createWalletAuthEntrySigner(
  options: WalletAuthEntryOptions,
): AuthEntrySigner {
  if (!StrKey.isValidEd25519PublicKey(options.address)) {
    throw new ReactInvalidConfigError(
      "Wallet auth-entry signing requires a G-address",
    );
  }
  return {
    signsFor: (target) => target === options.address,
    async signSorobanAuthEntry(
      entry,
      validUntil,
      networkPassphrase,
      forAddress,
    ) {
      if (networkPassphrase !== options.networkPassphrase) {
        throw new ReactNetworkMismatchError(
          "Authorization and wallet networks differ",
        );
      }
      if (
        !Number.isInteger(validUntil) || validUntil < 1 ||
        validUntil > 0xffff_ffff
      ) {
        throw new ReactInvalidConfigError(
          "Authorization expiry must be a positive uint32 ledger sequence",
        );
      }
      const { Address, xdr } = await import("stellar-sdk/base");
      const original = entry as XDR.SorobanAuthorizationEntry;
      if (
        original.credentials.type !== "sorobanCredentialsAddress" ||
        Address.fromScAddress(original.credentials.address.address)
            .toString() !== options.address ||
        (forAddress !== undefined && forAddress !== options.address)
      ) {
        throw new ReactUnsupportedCapabilityError(
          "Authorization belongs to another account",
        );
      }
      const unsigned = new xdr.SorobanAuthorizationEntry({
        rootInvocation: original.rootInvocation,
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            ...original.credentials.address,
            signatureExpirationLedger: validUntil,
          }),
        ),
      });
      const signed = xdr.SorobanAuthorizationEntry.fromXdr(
        await options.signAuthEntry(
          unsigned.toXdr("base64"),
          networkPassphrase,
        ),
        "base64",
      );
      if (signed.credentials.type !== "sorobanCredentialsAddress") {
        throw new ReactInvalidConfigError(
          "Wallet changed authorization credentials",
        );
      }
      // Compare everything except the signature using an immutable XDR copy.
      const comparable = new xdr.SorobanAuthorizationEntry({
        rootInvocation: signed.rootInvocation,
        credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
          new xdr.SorobanAddressCredentials({
            ...signed.credentials.address,
            signature: original.credentials.address.signature,
          }),
        ),
      });
      if (comparable.toXdr("base64") !== unsigned.toXdr("base64")) {
        throw new ReactInvalidConfigError(
          "Wallet changed the authorization payload",
        );
      }
      return signed;
    },
  };
}
