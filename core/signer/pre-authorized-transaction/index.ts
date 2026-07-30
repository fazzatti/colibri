import { Buffer } from "buffer";
import { assert } from "@/common/assert/assert.ts";
import { toBuffer } from "@/common/helpers/internal-buffer.ts";
import type { BinaryData, SignableTransaction } from "@/common/types/index.ts";
import type { Ed25519PublicKey, PreAuthTx } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import * as E from "@/signer/pre-authorized-transaction/error.ts";

type HashableTransaction = SignableTransaction & { hash(): Buffer };

/**
 * Signer that authorizes one exact transaction through its pre-authorized hash.
 *
 * It never adds a decorated signature. The transaction hash must already be
 * registered as a `T...` signer on every account targeted by this instance.
 */
export class PreAuthorizedTransactionSigner {
  private readonly targets = new Set<Ed25519PublicKey>();
  private readonly hashBytes: Buffer;
  private readonly key: PreAuthTx;

  private constructor(hash: BinaryData | PreAuthTx) {
    if (typeof hash === "string") {
      this.key = hash;
      try {
        this.hashBytes = Buffer.from(StrKey.decodePreAuthTx(hash));
      } catch (cause) {
        throw new E.FAILED_TO_DECODE_SIGNER_KEY(hash, cause as Error);
      }
    } else {
      try {
        this.hashBytes = toBuffer(hash);
      } catch (cause) {
        throw new E.FAILED_TO_NORMALIZE_TRANSACTION_HASH(cause as Error);
      }
      assert(
        this.hashBytes.length === 32,
        new E.INVALID_TRANSACTION_HASH_LENGTH(this.hashBytes.length),
      );
      try {
        this.key = StrKey.encodePreAuthTx(this.hashBytes);
      } catch (cause) {
        throw new E.FAILED_TO_ENCODE_SIGNER_KEY(cause as Error);
      }
    }
  }

  /**
   * Creates a signer from an exact finalized transaction.
   *
   * @param transaction - Final transaction whose hash will be authorized.
   * @returns A pre-authorized transaction signer.
   */
  static fromTransaction(
    transaction: SignableTransaction,
  ): PreAuthorizedTransactionSigner {
    try {
      return new PreAuthorizedTransactionSigner(
        (transaction as HashableTransaction).hash(),
      );
    } catch (cause) {
      if (cause instanceof E.PreAuthorizedTransactionSignerError) throw cause;
      throw new E.FAILED_TO_HASH_TRANSACTION_DURING_CREATION(
        cause as Error,
      );
    }
  }

  /**
   * Creates a signer from raw 32-byte hash data or a `T...` signer key.
   *
   * @param hash - Transaction hash bytes or their StrKey representation.
   * @returns A pre-authorized transaction signer.
   */
  static fromHash(
    hash: BinaryData | PreAuthTx,
  ): PreAuthorizedTransactionSigner {
    return new PreAuthorizedTransactionSigner(hash);
  }

  /** Returns a defensive copy of the authorized transaction hash. */
  hash(): BinaryData {
    return Buffer.from(this.hashBytes);
  }

  /** Returns the pre-authorized transaction's `T...` signer key. */
  signerKey(): PreAuthTx {
    return this.key;
  }

  /** Adds an account that registered this pre-authorized signer key. */
  addTarget(target: Ed25519PublicKey): void {
    this.targets.add(target);
  }

  /** Returns a defensive copy of the configured account targets. */
  getTargets(): Ed25519PublicKey[] {
    return Array.from(this.targets);
  }

  /** Removes an account from this signer's explicit targets. */
  removeTarget(target: Ed25519PublicKey): void {
    this.targets.delete(target);
  }

  /** Returns whether this signer is configured for the supplied account. */
  signsFor(target: string): boolean {
    return this.targets.has(target as Ed25519PublicKey);
  }

  /** Returns whether the supplied transaction exactly matches this signer. */
  authorizesTransaction(transaction: SignableTransaction): boolean {
    let transactionHash: Buffer;
    try {
      transactionHash = Buffer.from(
        (transaction as HashableTransaction).hash(),
      );
    } catch (cause) {
      throw new E.FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION(
        this.key,
        cause as Error,
      );
    }
    return transactionHash.equals(this.hashBytes);
  }
}

/** Error constructors emitted by {@link PreAuthorizedTransactionSigner}. */
export const PreAuthorizedTransactionSignerErrors: typeof E = E;
