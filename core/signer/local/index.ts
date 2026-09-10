import {
  authorizeEntry,
  Keypair as NativeKeypair,
  type xdr,
} from "stellar-sdk";
import type {
  BinaryData,
  SignableTransaction,
  SorobanAuthorizationEntryLike,
  TransactionXDRBase64,
} from "@/common/types/index.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  Ed25519SecretKey,
} from "@/strkeys/types.ts";
import type { LocalSigner as LocalSignerType } from "@/signer/local/types.ts";
import * as E from "@/signer/local/error.ts";
import { assert } from "@/common/assert/assert.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";

/** @internal Exact native SDK type, retained for JSR declaration generation. */
export type Keypair = NativeKeypair;

/**
 * LocalSigner
 *
 * A signer that holds an Ed25519 keypair **only inside a constructor-scoped closure**.
 * No secret material is stored on `this`. Secret access is controlled by `hideSecret`.
 *
 * Security notes:
 * - The secret `Keypair` instance is captured by arrow functions assigned in the constructor.
 * - `destroy()` best-effort zeroizes owned keys and nulls the handle. Borrowed
 *   keypairs from `fromKeypair()` remain under caller ownership.
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
   * Signs arbitrary payload bytes and returns the detached signature bytes.
   *
   * This method is intended for non-transaction payloads such as SEP-10
   * challenges or other signed messages.
   *
   * @param data - Payload bytes to sign.
   * @returns Detached signature bytes.
   */
  sign: (data: BinaryData) => BinaryData;

  /**
   * Signs a string (UTF-8) or raw bytes using SEP-53 domain separation through
   * Stellar SDK. Verify with native `Keypair.verifyMessage`, not `verify`.
   * Applications remain responsible for message intent, expiry and replay policy.
   */
  signMessage: (message: string | Uint8Array) => Uint8Array;

  /**
   * Verifies SEP-53 domain-separated message bytes using this signer's public key.
   * Like `verifySignature`, this remains available after secret destruction.
   * A valid signature proves the bytes were signed, not intent, freshness or consent.
   */
  verifyMessage: (
    message: string | Uint8Array,
    signature: Uint8Array,
  ) => boolean;

  /**
   * Returns the Ed25519 signer key represented by this local signer.
   *
   * @returns The signer's `G...` public key.
   */
  signerKey: () => Ed25519PublicKey;

  /**
   * Signs a classic or fee-bump transaction envelope.
   *
   * @param tx - Transaction envelope to sign.
   * @returns Signed transaction XDR as base64 text.
   */
  signTransaction: (
    tx: SignableTransaction,
  ) => TransactionXDRBase64;

  /**
   * Signs a Soroban authorization entry and returns the signed entry.
   *
   * @param entry - Authorization entry to sign.
   * @param validUntil - Ledger sequence at which the authorization expires.
   * @param passphrase - Network passphrase used for signing.
   * @param forAddress - Credential node that should receive the signature.
   * @returns Signed authorization entry.
   */
  signSorobanAuthEntry: (
    entry: SorobanAuthorizationEntryLike,
    validUntil: number,
    passphrase: string,
    forAddress?: Ed25519PublicKey | ContractId,
  ) => Promise<SorobanAuthorizationEntryLike>;

  /**
   * Verifies a detached signature against payload bytes.
   *
   * @param data - Payload bytes to verify.
   * @param signature - Detached signature bytes.
   * @returns `true` when the signature is valid, otherwise `false`.
   */
  verifySignature: (data: BinaryData, signature: BinaryData) => boolean;

  /**
   * Invalidates this signer. Best-effort zeroizes owned keypairs; borrowed
   * keypairs supplied to `fromKeypair()` are not modified.
   * Safe to call multiple times (idempotent).
   */
  destroy: () => void;

  /**
   * Creates a `LocalSigner` from an owned secret seed or a borrowed keypair.
   * @param source Ed25519 secret seed or caller-owned native SDK keypair.
   *
   * Implementation detail:
   * - `kp` (the secret keypair) exists **only** in this closure.
   * - Methods below close over `kp`; no secret is placed on `this`.
   */
  private constructor(source: Ed25519SecretKey | Keypair, hideSecret = false) {
    const ownsKeypair = typeof source === "string";
    // The keypair lives only in this closure; borrowed keys retain caller ownership.
    let kp: Keypair | null = typeof source === "string"
      ? NativeKeypair.fromSecret(source)
      : source;

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
    this.signerKey = this.publicKey;
    this.addTarget(this.publicKey());

    this.sign = (data: BinaryData): BinaryData => {
      assert(isDefined(kp), new E.SIGNER_DESTROYED());
      return kp.sign(toUint8Array(data));
    };

    this.signMessage = (message: string | Uint8Array): Uint8Array => {
      assert(isDefined(kp), new E.MESSAGE_SIGNER_DESTROYED());
      try {
        return kp.signMessage(message);
      } catch (cause) {
        throw new E.MESSAGE_SIGNING_FAILED(cause as Error);
      }
    };

    this.verifySignature = (
      data: BinaryData,
      signature: BinaryData,
    ): boolean => {
      const keypair = NativeKeypair.fromPublicKey(this.publicKey());
      return keypair.verify(toUint8Array(data), toUint8Array(signature));
    };

    this.verifyMessage = (message, signature): boolean => {
      try {
        return NativeKeypair.fromPublicKey(this.publicKey()).verifyMessage(
          message,
          signature,
        );
      } catch (cause) {
        throw new E.MESSAGE_VERIFICATION_FAILED(cause as Error);
      }
    };

    this.signTransaction = (
      tx: SignableTransaction,
    ): TransactionXDRBase64 => {
      assert(isDefined(kp), new E.SIGNER_DESTROYED());
      tx.sign(kp);
      return tx.toXdr() as TransactionXDRBase64;
    };

    this.signSorobanAuthEntry = (
      entry: SorobanAuthorizationEntryLike,
      validUntil: number,
      passphrase: string,
      forAddress?: Ed25519PublicKey | ContractId,
    ): Promise<SorobanAuthorizationEntryLike> => {
      assert(isDefined(kp), new E.SIGNER_DESTROYED());
      return authorizeEntry(
        entry as xdr.SorobanAuthorizationEntry,
        kp,
        validUntil,
        passphrase,
        forAddress,
      ) as Promise<SorobanAuthorizationEntryLike>;
    };

    this.destroy = () => {
      if (!isDefined(kp)) return; // already destroyed
      if (ownsKeypair) {
        // Best-effort zeroization applies only to keys created by this signer.
        const seed =
          (kp as unknown as { _secretSeed?: Uint8Array })._secretSeed;
        if (seed?.fill) seed.fill(0);
        const sk = (kp as unknown as { _secretKey?: Uint8Array })._secretKey;
        if (sk?.fill) sk.fill(0);
      }
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
   * Adapts a native Stellar SDK signing keypair to the existing LocalSigner API.
   * This is an explicit convenience: TransactionConfig.signers still accepts
   * Colibri signers, so pass the returned signer rather than the raw keypair.
   *
   * Borrows the keypair without extracting or copying its secret. The default
   * target is only keypair.publicKey(); use addTarget() deliberately for other
   * addresses with the required on-chain authority and authorization encoding.
   * Existing target selection and signing processes remain unchanged.
   *
   * destroy() and Symbol.dispose invalidate this signer without modifying the
   * caller-owned keypair. The caller remains responsible for that key's lifecycle.
   * hideSecret controls this signer's secretKey() method only; it does not hide
   * the original keypair. As with fromSecret(), it defaults to false.
   *
   * @param keypair - Native SDK keypair containing a signing key.
   * @param hideSecret - Prevent secret access through the returned signer.
   * @returns A LocalSigner using the supplied keypair.
   * @throws {E.KEYPAIR_CANNOT_SIGN} If the keypair is public-only.
   * @throws {E.KEYPAIR_ADAPTATION_FAILED} If the native keypair cannot be adapted.
   * @example Adapt an application-provided Stellar SDK keypair.
   * ```ts
   * const signer = LocalSigner.fromKeypair(keypair, true);
   * const config: TransactionConfig = {
   *   source: signer.publicKey(),
   *   fee: "100",
   *   timeout: 30,
   *   signers: [signer],
   * };
   * ```
   */
  static fromKeypair(keypair: Keypair, hideSecret = false): LocalSigner {
    try {
      assert(keypair.canSign(), new E.KEYPAIR_CANNOT_SIGN());
      return new LocalSigner(keypair, hideSecret);
    } catch (cause) {
      if (cause instanceof E.LocalSignerError) throw cause;
      throw new E.KEYPAIR_ADAPTATION_FAILED(cause as Error);
    }
  }

  /**
   * Factory: build a LocalSigner with a newly generated random key.
   * Use for throwaway/testing flows; persist the seed externally if needed.
   */
  static generateRandom(hideSecret = false): LocalSigner {
    return new LocalSigner(
      NativeKeypair.random().secret() as Ed25519SecretKey,
      hideSecret,
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
  public toJSON(): { publicKey: Ed25519PublicKey } {
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

/** Error constructors emitted by LocalSigner, including Keypair adaptation failures. */
export const LocalSignerErrors: typeof E = E;
