import {
  Address,
  buildWithDelegatesEntry,
  type DelegateSignature,
  xdr,
} from "stellar-sdk";
import { Buffer } from "buffer";
import type { SorobanAuthorizationEntryLike } from "@/common/types/index.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import type { AuthEntrySigner } from "@/signer/types.ts";
import * as E from "@/signer/delegated/error.ts";

/**
 * Configuration used to create a recursive delegated authorization signer.
 */
export type DelegatedSignerConfig = {
  /**
   * Top-level or nested credential address represented by this signer.
   */
  address: Ed25519PublicKey | ContractId;
  /**
   * Optional signer for this node's own signature value. Omit it when the
   * account authorizes entirely through its nested delegates.
   */
  signer?: AuthEntrySigner;
  /**
   * Recursive delegated signers configured below this address.
   */
  nestedDelegates?: DelegatedSigner[];
};

/**
 * Recursively materializes and authorizes a CAP-71 delegated credential tree.
 *
 * Add only the top-level instance to `TransactionConfig.signers`. The
 * complete nested topology is supplied when the instance is constructed. When
 * Colibri invokes the root signer with a simulation-produced authorization
 * entry, the root wraps that entry with delegated credentials and recursively
 * asks every configured node to authorize the same top-level payload.
 */
export class DelegatedSigner implements AuthEntrySigner {
  private readonly address: Ed25519PublicKey | ContractId;
  private readonly signer?: DelegatedSignerConfig["signer"];
  private readonly nestedDelegates: DelegatedSigner[];

  /**
   * Creates a delegated signer node and canonicalizes its immediate children.
   *
   * @param config - Address, optional node signer, and recursive delegates.
   */
  constructor(config: DelegatedSignerConfig) {
    this.address = config.address;
    this.signer = config.signer;
    this.nestedDelegates = [...(config.nestedDelegates ?? [])].sort(
      compareDelegateAddresses,
    );

    for (let index = 1; index < this.nestedDelegates.length; index++) {
      const previous = this.nestedDelegates[index - 1].getAddress();
      const current = this.nestedDelegates[index].getAddress();
      if (previous === current) {
        throw new E.DUPLICATE_NESTED_DELEGATE(this.address, current);
      }
    }
  }

  /** Returns the credential address represented by this node. */
  getAddress(): Ed25519PublicKey | ContractId {
    return this.address;
  }

  /** Returns a defensive copy of the node's canonical nested delegates. */
  getNestedDelegates(): DelegatedSigner[] {
    return [...this.nestedDelegates];
  }

  /**
   * Returns whether this root can authorize the requested top-level address.
   *
   * @param target - Address requested by the sign-auth-entries process.
   * @returns Whether the target is this node's configured address.
   */
  signsFor(target: Ed25519PublicKey | ContractId): boolean {
    return target === this.address;
  }

  /**
   * Materializes the configured delegate topology and recursively authorizes
   * every configured credential node.
   *
   * @param authEntry - Recording-simulation entry or delegated entry to update.
   * @param validUntilLedgerSeq - Inclusive signature expiration ledger.
   * @param networkPassphrase - Network passphrase committed by every signer.
   * @param forAddress - Credential position this invocation should authorize.
   * @returns The complete delegated authorization entry.
   */
  async signSorobanAuthEntry(
    authEntry: SorobanAuthorizationEntryLike,
    validUntilLedgerSeq: number,
    networkPassphrase: string,
    forAddress: Ed25519PublicKey | ContractId = this.address,
  ): Promise<SorobanAuthorizationEntryLike> {
    let delegatedEntry = authEntry as xdr.SorobanAuthorizationEntry;

    if (!isDelegatedEntry(delegatedEntry)) {
      try {
        delegatedEntry = buildWithDelegatesEntry({
          entry: delegatedEntry,
          validUntilLedgerSeq,
          delegates: this.nestedDelegates.map(toDelegateSignature),
        });
      } catch (error) {
        throw new E.FAILED_TO_BUILD_DELEGATED_ENTRY(
          this.address,
          error as Error,
        );
      }
    }

    if (this.signer) {
      try {
        delegatedEntry = await this.signer.signSorobanAuthEntry(
          delegatedEntry,
          validUntilLedgerSeq,
          networkPassphrase,
          forAddress,
        ) as xdr.SorobanAuthorizationEntry;
      } catch (error) {
        if (error instanceof E.DelegatedSignerError) throw error;
        throw new E.FAILED_TO_AUTHORIZE_DELEGATE(
          forAddress,
          error as Error,
        );
      }
    }

    for (const nestedDelegate of this.nestedDelegates) {
      delegatedEntry = await nestedDelegate.signSorobanAuthEntry(
        delegatedEntry,
        validUntilLedgerSeq,
        networkPassphrase,
        nestedDelegate.getAddress(),
      ) as xdr.SorobanAuthorizationEntry;
    }

    return delegatedEntry;
  }
}

const compareDelegateAddresses = (
  left: DelegatedSigner,
  right: DelegatedSigner,
): number =>
  Buffer.compare(
    new Address(left.getAddress()).toScAddress().toXDR(),
    new Address(right.getAddress()).toScAddress().toXDR(),
  );

const toDelegateSignature = (
  delegate: DelegatedSigner,
): DelegateSignature => ({
  address: delegate.getAddress(),
  nestedDelegates: delegate.getNestedDelegates().map(toDelegateSignature),
});

const isDelegatedEntry = (
  entry: xdr.SorobanAuthorizationEntry,
): boolean =>
  entry.credentials().switch().value ===
    xdr.SorobanCredentialsType.sorobanCredentialsAddressWithDelegates().value;

/** Error constructors emitted by {@link DelegatedSigner}. */
export const DelegatedSignerErrors: typeof E = E;
