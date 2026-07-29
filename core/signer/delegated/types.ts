import type { AuthEntrySigner } from "@/signer/types.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";

/**
 * Configuration used to create a recursive delegated authorization signer.
 */
export type DelegatedSignerConfig = {
  /**
   * Top-level or nested credential address represented by this signer node.
   */
  address: Ed25519PublicKey | ContractId;
  /**
   * Optional signer for this node's own signature value. Omit it when the
   * account authorizes entirely through its nested delegates.
   */
  signer?: AuthEntrySigner;
  /**
   * Recursive delegate nodes configured below this address.
   */
  nestedDelegates?: DelegatedSignerNode[];
};

/**
 * Public recursive surface implemented by {@link DelegatedSigner}.
 */
export type DelegatedSignerNode = AuthEntrySigner & {
  /** Returns the credential address represented by this node. */
  getAddress(): Ed25519PublicKey | ContractId;
  /** Returns a defensive copy of the node's canonical nested delegates. */
  getNestedDelegates(): DelegatedSignerNode[];
};
