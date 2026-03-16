import type { Buffer } from "buffer";
import {
  type Transaction,
  type FeeBumpTransaction,
  authorizeEntry,
  Keypair,
  type xdr,
} from "stellar-sdk";
import type { TransactionXDRBase64 } from "@/common/types/index.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  Ed25519SecretKey,
} from "@/strkeys/types.ts";
import type { LocalSigner as LocalSignerType } from "@/signer/local/types.ts";
import * as E from "@/signer/local/error.ts";
import { assert } from "@/common/assert/assert.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";

/**
 * LocalSigner
 *
 * A signer that holds an Ed25519 keypair **only inside a constructor-scoped closure**.
 * No secret material is stored on `this`. The public key is accessible; the secret never is.
 *
 * Security notes:
 * - The secret `Keypair` instance is captured by arrow functions assigned in the constructor.
 * - `destroy()` best-effort zeroizes internal buffers (`_secretSeed`, `_secretKey`) and nulls the handle.
 * - Also implements `[Symbol.dispose]()` so you can use TS 5.2 `using` to auto-clean on scope exit.
 */
export class LocalSigner implements LocalSignerType {
  private targets: Set<Ed25519PublicKey | ContractId> = new Set();

  /**
   * Returns the public key for this signer. Public info is OK to expose.
   */
  publicKey: () => Ed25519PublicKey;

  /**
   * Returns the secret key for this signer. Secret info should be kept private.
   *
   * @throws Error if the signer has been destroyed or the secret key is hidden.
   */
  secretKey: () => Ed25519SecretKey;

  /**
   * Signs arbitrary data and returns the signature as a Buffer.
   * This method allows signing of data outside of transactions, such as challenges.
   */
  sign: (data: Buffer) => Buffer;

  /**
   * Signs a classic or fee-bump transaction and returns its XDR (string).
   * The secret key never touches object properties; it is used only within the closure.
   */
  signTransaction: (
    tx: Transaction | FeeBumpTransaction
  ) => TransactionXDRBase64;

  /**
   * Signs a Soroban authorization entry (SAC-style), returning the signed entry.
   */
  signSorobanAuthEntry: (
    entry: xdr.SorobanAuthorizationEntry,
    validUntil: number,
    passphrase: string
  ) => Promise<xdr.SorobanAuthorizationEntry>;

  /**
   *
   * @param {Buffer} data - The data to sign.
   * @param {Buffer} signature - The signature to verify.
   * @returns {boolean} True if the signature is valid, false otherwise.
   */
  verifySignature: (data: Buffer, signature: Buffer) => boolean;

  /**
   * Best-effort zeroization and invalidation of the internal keypair handle.
   * Safe to call multiple times (idempotent).
   */
  destroy: () => void;

  /**
   * Creates a `LocalSigner` by decoding an Ed25519 secret seed.
   * @param secret Ed25519 secret seed (S... decoded to bytes in your caller types)
   *
   * Implementation detail:
   * - `kp` (the secret keypair) exists **only** in this closure.
   * - Methods below close over `kp`; no secret is placed on `this`.
   */
  private constructor(secret: Ed25519SecretKey, hideSecret = false) {
    // Secret lives ONLY in this local, closed over by methods.
    let kp: Keypair | null = Keypair.fromSecret(secret);

    // Public methods close over `kp` to access secret material as needed.
    this.secretKey = hideSecret
      ? () => {
          throw new E.SECRET_NOT_ACCESSIBLE();
        }
      : () => {
          assert(isDefined(kp), new E.SIGNER_DESTROYED());
          return kp.secret() as Ed25519SecretKey;
        };

    const pub = kp.publicKey();

    this.publicKey = () => pub as Ed25519PublicKey;
    this.addTarget(this.publicKey());

    this.sign = (data: Buffer): Buffer => {
      assert(isDefined(kp), new E.SIGNER_DESTROYED());
      return kp.sign(data);
    };

    this.verifySignature = (data: Buffer, signature: Buffer): boolean => {
      const keypair = Keypair.fromPublicKey(this.publicKey());
      return keypair.verify(data, signature);
    };

    this.signTransaction = (
      tx: Transaction | FeeBumpTransaction
    ): TransactionXDRBase64 => {
      assert(isDefined(kp), new E.SIGNER_DESTROYED());
      tx.sign(kp);
      return tx.toXDR() as TransactionXDRBase64;
    };

    this.signSorobanAuthEntry = (
      entry: xdr.SorobanAuthorizationEntry,
      validUntil: number,
      passphrase: string
    ) => {
      assert(isDefined(kp), new E.SIGNER_DESTROYED());
      return authorizeEntry(entry, kp, validUntil, passphrase);
    };

    this.destroy = () => {
      if (!isDefined(kp)) return; // already destroyed
      // Best-effort zeroization of internal buffers used by stellar-base Keypair.
      const seed = (kp as unknown as { _secretSeed?: Uint8Array })._secretSeed;
      if (seed?.fill) seed.fill(0);
      const sk = (kp as unknown as { _secretKey?: Uint8Array })._secretKey;
      if (sk?.fill) sk.fill(0);
      kp = null; // drop reference so GC can reclaim
    };
  }

  /**
   * Factory: build a LocalSigner from an Ed25519 secret seed.
   * The constructor is private; use this entrypoint.
   */
  static fromSecret(secret: Ed25519SecretKey, hideSecret = false): LocalSigner {
    return new LocalSigner(secret, hideSecret);
  }

  /**
   * Factory: build a LocalSigner with a newly generated random key.
   * Use for throwaway/testing flows; persist the seed externally if needed.
   */
  static generateRandom(hideSecret = false): LocalSigner {
    return new LocalSigner(
      Keypair.random().secret() as Ed25519SecretKey,
      hideSecret
    );
  }

  /**
   * Adds a target (public key or contract ID) that this signer can sign for.
   * @param target Ed25519 public key or contract ID to add as a signing target.
   */
  public addTarget(target: Ed25519PublicKey | ContractId) {
    this.targets.add(target);
  }

  /**
   * Returns an array of all targets (public keys and contract IDs) this signer can sign for.
   */
  public getTargets(): (Ed25519PublicKey | ContractId)[] {
    return Array.from(this.targets);
  }

  /**
   * Removes a target (public key or contract ID) from this signer's signing targets.
   * @param target Ed25519 public key or contract ID to remove.
   */
  public removeTarget(target: Ed25519PublicKey | ContractId) {
    assert(target !== this.publicKey(), new E.CANNOT_REMOVE_MASTER_TARGET());
    this.targets.delete(target);
  }

  /**
   * Determines if this signer can sign for the given target (public key or contract ID).
   * @param target Ed25519 public key or contract ID to check.
   * @returns True if this signer can sign for the target, false otherwise.
   */
  public signsFor(target: Ed25519PublicKey | ContractId): boolean {
    return this.targets.has(target);
  }

  /**
   * JSON representation intentionally includes **only** the public key.
   * This keeps logs/snapshots free of secrets by default.
   */
  public toJSON() {
    return { publicKey: this.publicKey() };
  }

  /**
   * TS 5.2 disposable protocol — allows:
   *   `using signer = LocalSigner.fromSecret(secret);`
   * and guarantees `destroy()` runs at scope exit.
   */
  [Symbol.dispose](): void {
    this.destroy();
  }
}
