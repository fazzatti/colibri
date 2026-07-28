import { authorizeEntry, type Keypair, xdr } from "stellar-sdk";
import type { ContractAuthContext, WebAuthCoreSigner } from "@/types.ts";
import { cloneSep45AuthorizationEntry } from "@/sep45/codec.ts";

/** Application-defined full-entry contract authorization hook. */
export type ContractAuthHandler = (
  entry: xdr.SorobanAuthorizationEntry,
  context: ContractAuthContext,
) =>
  | xdr.SorobanAuthorizationEntry
  | Promise<xdr.SorobanAuthorizationEntry>;

/** Small conventional adapters that preserve the raw full-entry boundary. */
export const ContractAuth = {
  /** Adapts a Colibri signer to the contract authorization hook. */
  fromSigner(signer: WebAuthCoreSigner): ContractAuthHandler {
    return async (entry, context) => {
      const signed = await signer.signSorobanAuthEntry(
        entry,
        context.validUntilLedgerSeq,
        context.networkPassphrase,
      );
      return xdr.SorobanAuthorizationEntry.fromXDR(
        (signed as xdr.SorobanAuthorizationEntry).toXDR(),
      );
    };
  },

  /** Uses the SDK's conventional Ed25519 Soroban signature encoding. */
  ed25519(keypair: Keypair): ContractAuthHandler {
    return async (entry, context) =>
      await authorizeEntry(
        entry,
        keypair,
        context.validUntilLedgerSeq,
        context.networkPassphrase,
      );
  },

  /** Explicitly authorizes without adding signature material. */
  none(): ContractAuthHandler {
    return (entry) => cloneSep45AuthorizationEntry(entry);
  },
};
