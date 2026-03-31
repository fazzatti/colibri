// deno-coverage-ignore-start — Babel decorator helpers are injected at line 1 during transpilation; this excludes them from coverage
/**
 * @module ledger-parser/transaction
 * @description Transaction class for lazy operation parsing
 */

import { memoize } from "@/common/decorators/memoize/index.ts";
// deno-coverage-ignore-stop
import type { xdr } from "stellar-sdk";
import {
  parseAccountId,
  parseMuxedAccount,
} from "@/common/helpers/xdr/index.ts";
import { Operation } from "@/ledger-parser/operation/index.ts";
import { INVALID_TRANSACTION_INDEX } from "@/ledger-parser/error.ts";
import type { Ledger } from "@/ledger-parser/ledger/index.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";

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
   * Factory method to create a Transaction from transaction result metadata
   *
   * Note: Only supports TransactionMeta v4.
   * Envelope is NOT available in v4 meta - use fromMetaWithEnvelope for LedgerCloseMeta v2.
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
    const txMeta = txResultMeta.txApplyProcessing();
    const resultPair = txResultMeta.result(); // TransactionResultPair
    const txResult = resultPair.result(); // TransactionResult
    const txHash = resultPair.transactionHash(); // Buffer with the hash

    // TransactionMeta v4: envelope is not stored in meta
    // For LedgerCloseMeta v2, envelope comes from txSet (use fromMetaWithEnvelope)
    // For v0/v1, envelope is not available
    const txEnvelope = undefined;

    return new Transaction(ledger, txEnvelope, txResult, txMeta, txHash, index);
  }

  /**
   * Factory method for V2 where envelope comes from txSet separately
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

    const txMeta = txResultMeta.txApplyProcessing();
    const resultPair = txResultMeta.result();
    const txResult = resultPair.result();
    const txHash = resultPair.transactionHash();

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
    // TransactionResultCode.txSuccess() returns 0
    return this.txResult.result().switch().value === 0;
  }

  /**
   * Get the transaction result code
   */
  @memoize()
  get resultCode(): string {
    const resultSwitch = this.txResult.result().switch().value;
    // Map numeric codes to strings (0 = txSuccess, etc.)
    const codeMap: Record<number, string> = {
      0: "txSuccess",
      1: "txFailed",
      2: "txTooEarly",
      3: "txTooLate",
      4: "txMissingOperation",
      5: "txBadSeq",
      6: "txBadAuth",
      7: "txInsufficientBalance",
      8: "txNoAccount",
      9: "txInsufficientFee",
      10: "txBadAuthExtra",
      11: "txInternalError",
      12: "txNotSupported",
      13: "txFeeBumpInnerSuccess",
      14: "txFeeBumpInnerFailed",
      15: "txNotEnoughSponsoring",
      16: "txBadSponsorship",
      17: "txBadMinSeqAgeOrGap",
      18: "txMalformed",
      19: "txSorobanInvalid",
    };
    return codeMap[resultSwitch] || `unknown_${resultSwitch}`;
  }

  /**
   * Get the source account from the transaction envelope
   */
  @memoize()
  get sourceAccount(): string {
    if (!this.txEnvelope) {
      throw new Error(
        `Cannot get source account for transaction ${this.hash} - envelope not available`,
      );
    }

    const envelope = this.envelope;
    const envType = envelope.switch().value; // Returns 0=TxV0, 2=Tx, 5=FeeBump

    // Handle different envelope types (numeric codes)
    if (envType === 2) {
      // envelopeTypeTx
      const tx = envelope.v1().tx();
      return parseMuxedAccount(tx.sourceAccount());
    } else if (envType === 0) {
      // envelopeTypeTxV0
      const tx = envelope.v0().tx();
      const ed25519 = tx.sourceAccountEd25519();
      // Create a minimal AccountId-compatible object
      // parseAccountId only uses ed25519(), so switch is not needed
      return parseAccountId({
        ed25519: () => ed25519,
      } as unknown as xdr.AccountId);
    } else if (envType === 5) {
      // envelopeTypeTxFeeBump
      const feeBump = envelope.feeBump().tx();
      return parseMuxedAccount(feeBump.feeSource());
    }

    throw new Error(`Unsupported envelope type: ${envType}`);
  }

  /**
   * Get the transaction fee
   * For v4: returns feeCharged from TransactionResult
   * For v0-v3: returns fee from envelope
   */
  @memoize()
  get fee(): bigint {
    // V4 and all versions: use feeCharged from result (actual fee paid)
    return this.txResult.feeCharged().toBigInt();
  }

  /**
   * Get the transaction sequence number
   */
  @memoize()
  get sequence(): bigint {
    if (!this.txEnvelope) {
      throw new Error(
        `Cannot get sequence for transaction ${this.hash} - envelope not available`,
      );
    }

    const envelope = this.envelope;
    const envType = envelope.switch().value; // Returns 0=TxV0, 2=Tx, 5=FeeBump

    if (envType === 2) {
      // envelopeTypeTx
      return envelope.v1().tx().seqNum().toBigInt();
    } else if (envType === 0) {
      // envelopeTypeTxV0
      return envelope.v0().tx().seqNum().toBigInt();
    } else if (envType === 5) {
      // envelopeTypeTxFeeBump
      // Fee bump wraps an inner transaction
      const innerTx = envelope.feeBump().tx().innerTx().v1().tx();
      return innerTx.seqNum().toBigInt();
    }

    return 0n;
  }

  /**
   * Parse and return all operations in this transaction
   *
   * @memoized - First access parses operations, subsequent accesses return cached array
   */
  @memoize()
  get operations(): Operation[] {
    if (!this.txEnvelope) {
      throw new Error(
        `Cannot get operations for transaction ${this.hash} - envelope not available`,
      );
    }

    const envelope = this.envelope;
    const envType = envelope.switch().value;
    let ops: xdr.Operation[];

    if (envType === 2) {
      // envelopeTypeTx
      ops = envelope.v1().tx().operations();
    } else if (envType === 0) {
      // envelopeTypeTxV0
      ops = envelope.v0().tx().operations();
    } else if (envType === 5) {
      // envelopeTypeTxFeeBump
      ops = envelope.feeBump().tx().innerTx().v1().tx().operations();
    } else {
      ops = [];
    }

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
      fee: this.fee.toString(),
      sequence: this.sequence.toString(),
      operationCount: this.operationCount,
    };
  }
}
