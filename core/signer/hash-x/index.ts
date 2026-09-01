import { hash as sha256 } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";
import type {
  BinaryData,
  SignableTransaction,
  TransactionXDRBase64,
} from "@/common/types/index.ts";
import type { Ed25519PublicKey, Sha256Hash } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import * as E from "@/signer/hash-x/error.ts";

type HashXSignableTransaction = SignableTransaction & {
  signHashX(preimage: Uint8Array): void;
};

/**
 * Envelope signer that authorizes transactions by revealing a Hash-X preimage.
 *
 * The preimage is secret until it is included in a submitted envelope. Its
 * SHA-256 digest is exposed through {@link HashXSigner.hash}, and the matching
 * Stellar `X...` signer key through {@link HashXSigner.signerKey}.
 */
export class HashXSigner {
  private readonly targets = new Set<Ed25519PublicKey>();
  private readonly hashBytes: Uint8Array;
  private readonly key: Sha256Hash;

  /** Returns a defensive copy of the configured preimage. */
  preimage: () => BinaryData;
  /** Adds the preimage as a Hash-X transaction signature. */
  signTransaction: (
    transaction: SignableTransaction,
  ) => TransactionXDRBase64;
  /** Best-effort zeroizes and invalidates the retained preimage. */
  destroy: () => void;

  /** Derives the protocol SHA-256 digest for retained preimage bytes. */
  private static deriveHash(preimage: Uint8Array): Uint8Array {
    return sha256(preimage);
  }

  private constructor(preimage: BinaryData, hidePreimage: boolean) {
    let bytes: Uint8Array;
    try {
      bytes = toUint8Array(preimage);
    } catch (cause) {
      throw new E.FAILED_TO_NORMALIZE_PREIMAGE(cause as Error);
    }
    assert(bytes.length <= 64, new E.INVALID_PREIMAGE_LENGTH(bytes.length));

    let retainedPreimage: Uint8Array | null = bytes.slice();

    try {
      this.hashBytes = HashXSigner.deriveHash(bytes);
    } catch (cause) {
      throw new E.FAILED_TO_DERIVE_HASH(cause as Error);
    }

    try {
      this.key = StrKey.encodeSha256Hash(this.hashBytes);
    } catch (cause) {
      throw new E.FAILED_TO_ENCODE_SIGNER_KEY(cause as Error);
    }

    this.preimage = hidePreimage
      ? () => {
        throw new E.PREIMAGE_NOT_ACCESSIBLE();
      }
      : () => {
        assert(isDefined(retainedPreimage), new E.SIGNER_DESTROYED());
        return retainedPreimage.slice();
      };

    this.signTransaction = (
      transaction: SignableTransaction,
    ): TransactionXDRBase64 => {
      assert(isDefined(retainedPreimage), new E.SIGNER_DESTROYED());

      try {
        (transaction as HashXSignableTransaction).signHashX(
          retainedPreimage.slice(),
        );
      } catch (cause) {
        throw new E.FAILED_TO_ADD_PREIMAGE_SIGNATURE(
          this.key,
          cause as Error,
        );
      }

      try {
        return transaction.toXdr() as TransactionXDRBase64;
      } catch (cause) {
        throw new E.FAILED_TO_SERIALIZE_TRANSACTION(
          this.key,
          cause as Error,
        );
      }
    };

    this.destroy = () => {
      if (!isDefined(retainedPreimage)) return;
      retainedPreimage.fill(0);
      retainedPreimage = null;
    };
  }

  /**
   * Creates a Hash-X signer from caller-provided preimage bytes.
   *
   * @param preimage - Preimage containing at most 64 bytes.
   * @param hidePreimage - Whether direct preimage access should be disabled.
   * @returns A Hash-X envelope signer.
   */
  static fromPreimage(
    preimage: BinaryData,
    hidePreimage = false,
  ): HashXSigner {
    return new HashXSigner(preimage, hidePreimage);
  }

  /**
   * Creates a Hash-X signer with a secure random 32-byte preimage.
   *
   * @param hidePreimage - Whether direct preimage access should be disabled.
   * @returns A randomly generated Hash-X envelope signer.
   */
  static generateRandom(hidePreimage = false): HashXSigner {
    try {
      return new HashXSigner(
        globalThis.crypto.getRandomValues(new Uint8Array(32)),
        hidePreimage,
      );
    } catch (cause) {
      if (cause instanceof E.HashXSignerError) throw cause;
      throw new E.FAILED_TO_GENERATE_PREIMAGE(cause as Error);
    }
  }

  /** Returns a defensive copy of the SHA-256 preimage digest. */
  hash(): BinaryData {
    return this.hashBytes.slice();
  }

  /** Returns the `X...` signer key derived from the preimage. */
  signerKey(): Sha256Hash {
    return this.key;
  }

  /** Adds an account that this signer is explicitly allowed to authorize. */
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

  /** Invokes best-effort preimage cleanup when used with `using`. */
  [Symbol.dispose](): void {
    this.destroy();
  }
}

/** Error constructors emitted by {@link HashXSigner}. */
export const HashXSignerErrors: typeof E = E;
