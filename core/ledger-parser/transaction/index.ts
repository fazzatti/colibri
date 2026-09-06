// deno-coverage-ignore-start — Babel decorator helpers are injected at line 1 during transpilation; this excludes them from coverage
/**
 * @module ledger-parser/transaction
 * @description Transaction class for lazy operation parsing
 */

import { memoize } from "@/common/decorators/memoize/index.ts";
// deno-coverage-ignore-stop
import { xdr } from "stellar-sdk";
import { parseMuxedAccount } from "@/common/helpers/xdr/index.ts";
import { StrKey } from "@/strkeys/index.ts";
import { Operation } from "@/ledger-parser/operation/index.ts";
import {
  INVALID_TRANSACTION_INDEX,
  MISSING_FEE_SOURCE_ENVELOPE,
  MISSING_NATIVE_ENVELOPE,
  MISSING_TRANSACTION_ENVELOPE,
  NATIVE_ENVELOPE_DECODE_FAILED,
  UNSUPPORTED_ENVELOPE_TYPE,
} from "@/ledger-parser/error.ts";
import type { Ledger } from "@/ledger-parser/ledger/index.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";

/** @internal Exact native SDK envelope union, not a Colibri replacement. */
export type TransactionEnvelope = xdr.TransactionEnvelope;

/**
 * Transaction class for lazy operation parsing
 *
 * @example
 * ```typescript
 * const tx = ledger.transactions[0];
 * tx.index;          // Direct access, no parsing
 * tx.hash;           // Direct access from envelope
 * tx.successful;     // Check if transaction succeeded
 * tx.operations;     // Parses operations (memoized)
 * ```
 */
export class Transaction {
  /** Transaction index within the containing ledger. */
  readonly index: number;
  private readonly ledger: Ledger;
  private readonly txMeta: xdr.TransactionMeta;
  private readonly txEnvelope?: xdr.TransactionEnvelope;
  private readonly txResult: xdr.TransactionResult;
  private readonly txHash: Uint8Array;

  private constructor(
    ledger: Ledger,
    txEnvelope: xdr.TransactionEnvelope | undefined,
    txResult: xdr.TransactionResult,
    txMeta: xdr.TransactionMeta,
    txHash: Uint8Array,
    index: number,
  ) {
    this.ledger = ledger;
    this.txEnvelope = txEnvelope;
    this.txResult = txResult;
    this.txMeta = txMeta;
    this.txHash = txHash;
    this.index = index;
  }

  /**
   * Creates a result-only transaction. Application metadata does not contain
   * its envelope; use fromMetaWithEnvelope after associating the transaction set
   * by its network-specific hash, never by array index.
   */
  static fromMeta(
    ledger: Ledger,
    txResultMeta: xdr.TransactionResultMeta,
    index: number,
  ): Transaction {
    if (index < 0) {
      throw new INVALID_TRANSACTION_INDEX(index, ledger.sequence, -1);
    }

    // Extract components from TransactionResultMeta
    const txMeta = txResultMeta.txApplyProcessing;
    const resultPair = txResultMeta.result;
    const txResult = resultPair.result;
    const txHash = resultPair.transactionHash.toBytes();

    // Envelopes live in the ledger transaction set, not application metadata.
    const txEnvelope = undefined;

    return new Transaction(ledger, txEnvelope, txResult, txMeta, txHash, index);
  }

  /**
   * Creates a transaction from a result and its already-associated native envelope.
   * This low-level factory trusts that the caller matched their hashes correctly.
   */
  static fromMetaWithEnvelope(
    ledger: Ledger,
    txResultMeta: xdr.TransactionResultMeta,
    envelope: xdr.TransactionEnvelope,
    index: number,
  ): Transaction {
    if (index < 0) {
      throw new INVALID_TRANSACTION_INDEX(index, ledger.sequence, -1);
    }

    const txMeta = txResultMeta.txApplyProcessing;
    const resultPair = txResultMeta.result;
    const txResult = resultPair.result;
    const txHash = resultPair.transactionHash.toBytes();

    return new Transaction(ledger, envelope, txResult, txMeta, txHash, index);
  }

  /**
   * Check if transaction envelope is available
   */
  get hasEnvelope(): boolean {
    return isDefined(this.txEnvelope);
  }

  /**
   * Get the transaction envelope
   *
   * Note: For V2+, envelope comes from txSet, not TransactionMeta
   * Private getter is only called after public methods verify txEnvelope exists.
   */
  @memoize()
  private get envelope(): xdr.TransactionEnvelope {
    // All public getters that use this check txEnvelope first,
    // so this is guaranteed to be non-null when called
    return this.txEnvelope!;
  }

  /**
   * Get the transaction hash
   */
  @memoize()
  get hash(): string {
    return Array.from(this.txHash, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  /**
   * Check if the transaction was successful
   */
  @memoize()
  get successful(): boolean {
    return this.txResult.result.type === "txSuccess" ||
      this.txResult.result.type === "txFeeBumpInnerSuccess";
  }

  /**
   * Get the transaction result code
   */
  @memoize()
  get resultCode(): string {
    return this.txResult.result.type;
  }

  /**
   * Source executing the operations, including the inner source of a fee bump.
   * This is distinct from `feeSource`, which identifies the envelope fee payer.
   */
  @memoize()
  get sourceAccount(): string {
    if (!this.txEnvelope) {
      throw new MISSING_TRANSACTION_ENVELOPE(this.hash, "source account");
    }

    const envelope = this.envelope;

    switch (envelope.type) {
      case "envelopeTypeTx":
        return parseMuxedAccount(envelope.v1.tx.sourceAccount);
      case "envelopeTypeTxV0":
        return StrKey.encodeEd25519PublicKey(
          envelope.v0.tx.sourceAccountEd25519.toBytes(),
        );
      case "envelopeTypeTxFeeBump":
        return parseMuxedAccount(
          envelope.feeBump.tx.innerTx.v1.tx.sourceAccount,
        );
      default:
        throw new UNSUPPORTED_ENVELOPE_TYPE(
          (envelope as { type: string }).type,
        );
    }
  }

  /** Fee payer, preserving an M address when present; independent of the operation source. */
  get feeSource(): string {
    if (!this.txEnvelope) throw new MISSING_FEE_SOURCE_ENVELOPE(this.hash);
    return this.txEnvelope.type === "envelopeTypeTxFeeBump"
      ? parseMuxedAccount(this.txEnvelope.feeBump.tx.feeSource)
      : this.sourceAccount;
  }

  /** Returns an independent native SDK envelope for hashing, decoding or inspection. */
  toEnvelope(): TransactionEnvelope {
    if (!this.txEnvelope) throw new MISSING_NATIVE_ENVELOPE(this.hash);
    try {
      return xdr.TransactionEnvelope.fromXdr(
        this.txEnvelope.toXdr("base64"),
        "base64",
      );
    } catch (cause) {
      throw new NATIVE_ENVELOPE_DECODE_FAILED(this.hash, cause as Error);
    }
  }

  /**
   * Get the transaction fee
   * For v4: returns feeCharged from TransactionResult
   * For v0-v3: returns fee from envelope
   */
  @memoize()
  get fee(): bigint {
    // V4 and all versions: use feeCharged from result (actual fee paid)
    return this.txResult.feeCharged;
  }

  /**
   * Get the transaction sequence number
   */
  @memoize()
  get sequence(): bigint {
    if (!this.txEnvelope) {
      throw new MISSING_TRANSACTION_ENVELOPE(this.hash, "sequence");
    }

    const envelope = this.envelope;

    switch (envelope.type) {
      case "envelopeTypeTx":
        return envelope.v1.tx.seqNum;
      case "envelopeTypeTxV0":
        return envelope.v0.tx.seqNum;
      case "envelopeTypeTxFeeBump":
        return envelope.feeBump.tx.innerTx.v1.tx.seqNum;
      default:
        return 0n;
    }
  }

  /**
   * Parse and return all operations in this transaction
   *
   * @memoized - First access parses operations, subsequent accesses return cached array
   */
  @memoize()
  get operations(): Operation[] {
    if (!this.txEnvelope) {
      throw new MISSING_TRANSACTION_ENVELOPE(this.hash, "operations");
    }

    const envelope = this.envelope;
    const ops: xdr.Operation[] = envelope.type === "envelopeTypeTx"
      ? envelope.v1.tx.operations
      : envelope.type === "envelopeTypeTxV0"
      ? envelope.v0.tx.operations
      : envelope.type === "envelopeTypeTxFeeBump"
      ? envelope.feeBump.tx.innerTx.v1.tx.operations
      : [];

    return ops.map((op, index) => Operation.fromXdr(this, op, index));
  }

  /**
   * Get the total number of operations in this transaction
   */
  get operationCount(): number {
    return this.operations.length;
  }

  /**
   * Get an operation by index
   */
  getOperation(index: number): Operation | undefined {
    return this.operations[index];
  }

  /**
   * Get the ledger this transaction belongs to
   */
  get parentLedger(): Ledger {
    return this.ledger;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      index: this.index,
      hash: this.hash,
      successful: this.successful,
      resultCode: this.resultCode,
      sourceAccount: this.sourceAccount,
      feeSource: this.feeSource,
      fee: this.fee.toString(),
      sequence: this.sequence.toString(),
      operationCount: this.operationCount,
    };
  }
}
