import {
  SignerKey as StellarSignerKey,
  StrKey as StellarStrKey,
  type xdr,
  xdr as stellarXdr,
} from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import type {
  BinaryData,
  SignableTransaction,
  TransactionXDRBase64,
} from "@/common/types/index.ts";
import type { KeypairSigner } from "@/signer/types.ts";
import type { Ed25519PublicKey, SignedPayload } from "@/strkeys/types.ts";
import * as E from "@/signer/signed-payload/error.ts";

type PayloadSigningCapability = Pick<KeypairSigner, "publicKey" | "sign">;
type HashableTransaction = SignableTransaction & { hash(): Uint8Array };
type DecoratedSignatureTransaction = SignableTransaction & {
  addDecoratedSignature(signature: xdr.DecoratedSignature): void;
};

/**
 * Envelope signer that discloses an Ed25519 signature over a fixed payload.
 *
 * The payload is embedded in the signer's `P...` key and is signed directly,
 * without transaction hashing or network-domain separation. Prefer
 * {@link Ed25519SignedPayloadSigner.forTransaction} when the disclosed
 * signature is intended to authorize one exact future Stellar transaction.
 */
export class Ed25519SignedPayloadSigner {
  private readonly targets = new Set<Ed25519PublicKey>();
  private readonly signer: PayloadSigningCapability;
  private readonly payloadBytes: Uint8Array;
  private readonly publicKeyBytes: Uint8Array;
  private readonly publicKeyValue: Ed25519PublicKey;
  private readonly key: SignedPayload;

  /** Builds the signed-payload arm of Stellar's signer-key XDR union. */
  private static buildSignerKeyXdr(
    publicKey: Uint8Array,
    payload: Uint8Array,
  ): xdr.SignerKey {
    const signedPayload = new stellarXdr.SignerKeyEd25519SignedPayload({
      ed25519: publicKey,
      payload,
    });
    return stellarXdr.SignerKey.signerKeyTypeEd25519SignedPayload(
      signedPayload,
    );
  }

  private constructor(
    signer: PayloadSigningCapability,
    payload: BinaryData,
  ) {
    this.signer = signer;
    try {
      this.payloadBytes = toUint8Array(payload).slice();
    } catch (cause) {
      throw new E.FAILED_TO_NORMALIZE_PAYLOAD(cause as Error);
    }
    assert(
      this.payloadBytes.length > 0 && this.payloadBytes.length <= 64,
      new E.INVALID_PAYLOAD_LENGTH(this.payloadBytes.length),
    );

    try {
      this.publicKeyValue = signer.publicKey();
    } catch (cause) {
      throw new E.FAILED_TO_GET_PUBLIC_KEY(cause as Error);
    }

    try {
      this.publicKeyBytes = StellarStrKey.decodeEd25519PublicKey(
        this.publicKeyValue,
      );
    } catch (cause) {
      throw new E.FAILED_TO_DECODE_PUBLIC_KEY(
        this.publicKeyValue,
        cause as Error,
      );
    }

    let signerKeyXdr: xdr.SignerKey;
    try {
      signerKeyXdr = Ed25519SignedPayloadSigner.buildSignerKeyXdr(
        this.publicKeyBytes,
        this.payloadBytes,
      );
    } catch (cause) {
      throw new E.FAILED_TO_BUILD_SIGNER_KEY_XDR(
        this.publicKeyValue,
        cause as Error,
      );
    }

    try {
      this.key = StellarSignerKey.encodeSignerKey(
        signerKeyXdr,
      ) as SignedPayload;
    } catch (cause) {
      throw new E.FAILED_TO_ENCODE_SIGNER_KEY(
        this.publicKeyValue,
        cause as Error,
      );
    }
  }

  /**
   * Creates a signer for an explicit protocol or application payload.
   *
   * @param args - Ed25519 signing capability and non-empty payload bytes.
   * @returns A signed-payload envelope signer.
   */
  static fromPayload(args: {
    signer: Pick<KeypairSigner, "publicKey" | "sign">;
    payload: BinaryData;
  }): Ed25519SignedPayloadSigner {
    return new Ed25519SignedPayloadSigner(args.signer, args.payload);
  }

  /**
   * Creates a signer whose payload is one exact future transaction hash.
   *
   * @param args - Ed25519 signing capability and finalized future transaction.
   * @returns A transaction-bound signed-payload envelope signer.
   */
  static forTransaction(args: {
    signer: Pick<KeypairSigner, "publicKey" | "sign">;
    transaction: SignableTransaction;
  }): Ed25519SignedPayloadSigner {
    let payload: Uint8Array;
    try {
      payload = (args.transaction as HashableTransaction).hash();
    } catch (cause) {
      throw new E.FAILED_TO_HASH_TRANSACTION(cause as Error);
    }
    return new Ed25519SignedPayloadSigner(args.signer, payload);
  }

  /** Returns a defensive copy of the raw payload embedded in the signer key. */
  payload(): BinaryData {
    return this.payloadBytes.slice();
  }

  /** Returns the Ed25519 public key bound to the payload. */
  publicKey(): Ed25519PublicKey {
    return this.publicKeyValue;
  }

  /** Returns the `P...` signer key containing the public key and payload. */
  signerKey(): SignedPayload {
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

  /**
   * Signs the configured payload and adds its decorated signature to an
   * envelope.
   */
  signTransaction(
    transaction: SignableTransaction,
  ): TransactionXDRBase64 {
    let signatureData: BinaryData;
    try {
      signatureData = this.signer.sign(this.payloadBytes.slice());
    } catch (cause) {
      throw new E.FAILED_TO_SIGN_PAYLOAD(this.key, cause as Error);
    }

    let signature: Uint8Array;
    try {
      signature = toUint8Array(signatureData);
    } catch (cause) {
      throw new E.FAILED_TO_NORMALIZE_SIGNATURE(
        this.key,
        cause as Error,
      );
    }

    let decoratedSignature: xdr.DecoratedSignature;
    try {
      const publicKeyHint = this.publicKeyBytes.subarray(-4);
      const payloadHint = new Uint8Array(4);
      payloadHint.set(this.payloadBytes.subarray(-4));
      const hint = payloadHint.map((byte, index) =>
        byte ^ publicKeyHint[index]
      );
      decoratedSignature = new stellarXdr.DecoratedSignature({
        hint,
        signature,
      });
      decoratedSignature.toXdr();
    } catch (cause) {
      throw new E.FAILED_TO_BUILD_DECORATED_SIGNATURE(
        this.key,
        cause as Error,
      );
    }

    try {
      (transaction as DecoratedSignatureTransaction).addDecoratedSignature(
        decoratedSignature,
      );
    } catch (cause) {
      throw new E.FAILED_TO_ADD_DECORATED_SIGNATURE(
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
  }
}

/** Error constructors emitted by {@link Ed25519SignedPayloadSigner}. */
export const Ed25519SignedPayloadSignerErrors: typeof E = E;
