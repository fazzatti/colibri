import { authorizeEntry, xdr } from "stellar-sdk";
import type {
  AuthEntrySigner,
  ContractId,
  Ed25519PublicKey,
  SorobanAuthorizationEntryLike,
} from "@colibri/core";
import type { ContractAuthContext } from "@/types.ts";
import { cloneSep45AuthorizationEntry } from "@/sep45/codec.ts";
import type {
  Keypair,
  SorobanAuthorizationEntry,
} from "@/stellar-sdk-types.ts";

/** Colibri signer capability accepted by {@link ContractAuth.fromSigner}. */
export type {
  AuthEntrySigner,
  ContractId,
  Ed25519PublicKey,
  SorobanAuthorizationEntryLike,
};

/** Application-defined full-entry contract authorization hook. */
export type ContractAuthHandler = (
  entry: SorobanAuthorizationEntry,
  context: ContractAuthContext,
) =>
  | SorobanAuthorizationEntry
  | Promise<SorobanAuthorizationEntry>;

/** Small conventional adapters that preserve the raw full-entry boundary. */
export const ContractAuth: {
  fromSigner(signer: AuthEntrySigner): ContractAuthHandler;
  ed25519(keypair: Keypair): ContractAuthHandler;
  none(): ContractAuthHandler;
} = {
  /** Adapts a Colibri signer to the contract authorization hook. */
  fromSigner(signer: AuthEntrySigner): ContractAuthHandler {
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
