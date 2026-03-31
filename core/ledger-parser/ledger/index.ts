// deno-coverage-ignore-start — Babel decorator helpers are injected at line 1 during transpilation; this excludes them from coverage
/**
 * @module ledger-parser/ledger
 * @description Ledger class for lazy XDR parsing with version switching
 */

import { memoize } from "@/common/decorators/memoize/index.ts";
// deno-coverage-ignore-stop
import { xdr } from "stellar-sdk";
import type { LedgerEntry } from "@/ledger-parser/types.ts";
import { ensureXdrType } from "@/common/helpers/xdr/ensure-xdr-type.ts";
import { Transaction } from "@/ledger-parser/transaction/index.ts";
import {
  INVALID_LEDGER_ENTRY,
  INVALID_HEADER_XDR,
  INVALID_METADATA_XDR,
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
} from "@/ledger-parser/error.ts";

/**
 * Ledger class for lazy XDR parsing
 *
 * Supported versions (based on Lightsail archive RPC):
 * - LedgerCloseMeta: v0, v1, v2
 * - TransactionMeta: v4 only (archive normalizes all to v4)
 *
 * Envelope availability:
 * - v2: Available from txSet.phases
 * - v0/v1: Not available (v4 meta doesn't include envelope)
 *
 * Uses @memoize() to cache expensive parsing operations.
 *
 * @example
 * ```typescript
 * const ledger = Ledger.fromEntry({
 *   sequence: 12345,
 *   hash: "abc...",
 *   ledgerCloseTime: "1234567890",
 *   headerXdr: "AAAA...",
 *   metadataXdr: "AAAA..."
 * });
 *
 * ledger.sequence;      // Direct access, no parsing
 * ledger.header;        // Parses headerXdr (memoized)
 * ledger.transactions;  // Parses metadataXdr (memoized)
 * ```
 */
export class Ledger {
  /** Ledger sequence number. */
  readonly sequence: number;
  /** Ledger hash. */
  readonly hash: string;
  /** Raw ledger close timestamp as provided by RPC. */
  readonly ledgerCloseTime: string;

  private readonly headerXdr:
    | string
    | Uint8Array
    | xdr.LedgerHeaderHistoryEntry;
  private readonly metadataXdr: string | Uint8Array | xdr.LedgerCloseMeta;

  private constructor(entry: LedgerEntry) {
    // Validate required fields
    if (!entry.sequence || !entry.hash || !entry.ledgerCloseTime) {
      throw new INVALID_LEDGER_ENTRY(
        JSON.stringify({ sequence: entry.sequence, hash: entry.hash }),
      );
    }

    this.sequence = entry.sequence;
    this.hash = entry.hash;
    this.ledgerCloseTime = String(entry.ledgerCloseTime);
    this.headerXdr = entry.headerXdr;
    this.metadataXdr = entry.metadataXdr;
  }

  /**
   * Factory method to create a Ledger instance from RPC response
   */
  static fromEntry(entry: LedgerEntry): Ledger {
    return new Ledger(entry);
  }

  /**
   * Parse and return the LedgerHeader
   *
   * RPC returns LedgerHeaderHistoryEntry, so we need to extract the header from it.
   *
   * @memoized - First access parses XDR, subsequent accesses return cached result
   */
  /** @internal */
  @memoize()
  get header(): xdr.LedgerHeader {
    try {
      // RPC returns base64-encoded LedgerHeaderHistoryEntry
      const historyEntry = ensureXdrType(
        this.headerXdr,
        xdr.LedgerHeaderHistoryEntry,
      );
      return historyEntry.header();
    } catch (error) {
      // ensureXdrType always throws Error instances
      throw new INVALID_HEADER_XDR(error as Error);
    }
  }

  /**
   * Parse and return the LedgerCloseMeta
   *
   * @memoized - First access parses XDR, subsequent accesses return cached result
   */
  /** @internal */
  @memoize()
  get meta(): xdr.LedgerCloseMeta {
    try {
      return ensureXdrType(this.metadataXdr, xdr.LedgerCloseMeta);
    } catch (error) {
      // ensureXdrType always throws Error instances
      throw new INVALID_METADATA_XDR(error as Error);
    }
  }

  /**
   * Get the LedgerCloseMeta version (v0, v1, or v2)
   */
  get version(): "v0" | "v1" | "v2" {
    const versionNumber = this.meta.switch();
    switch (versionNumber) {
      case 0:
        return "v0";
      case 1:
        return "v1";
      case 2:
        return "v2";
      default:
        throw new UNSUPPORTED_LEDGER_CLOSE_META_VERSION(`v${versionNumber}`);
    }
  }

  /**
   * Get the ledger close timestamp as a Date
   */
  get closedAt(): Date {
    return new Date(Number(this.ledgerCloseTime) * 1000);
  }

  /**
   * Get the previous ledger hash from the header
   */
  @memoize()
  get previousLedgerHash(): string {
    return this.header.previousLedgerHash().toString("hex");
  }

  /**
   * Get the total number of coins in circulation from the header
   */
  @memoize()
  get totalCoins(): bigint {
    return this.header.totalCoins().toBigInt();
  }

  /**
   * Get the fee pool from the header
   */
  @memoize()
  get feePool(): bigint {
    return this.header.feePool().toBigInt();
  }

  /**
   * Get the protocol version from the header
   */
  @memoize()
  get protocolVersion(): number {
    return this.header.ledgerVersion();
  }

  /**
   * Parse and return all transactions in this ledger
   *
   * Extracts envelopes from txSet for all versions and matches with txProcessing
   *
   * @memoized - First access parses transactions, subsequent accesses return cached array
   */
  @memoize()
  get transactions(): Transaction[] {
    const meta = this.meta;
    const version = this.version;

    switch (version) {
      case "v0": {
        const v0 = meta.v0();
        const txProcessing = v0.txProcessing();

        // v0 has simple TransactionSet with txes()
        const envelopes = v0.txSet().txes();

        return txProcessing.map((resultMeta, index) => {
          const envelope = envelopes[index];
          if (envelope) {
            return Transaction.fromMetaWithEnvelope(
              this,
              resultMeta,
              envelope,
              index,
            );
          } else {
            return Transaction.fromMeta(this, resultMeta, index);
          }
        });
      }
      case "v1": {
        const v1 = meta.v1();
        const txProcessing = v1.txProcessing();

        // v1 has GeneralizedTransactionSet with v1TxSet().phases()
        const envelopes = this.extractEnvelopesFromGeneralizedTxSet(v1.txSet());

        return txProcessing.map((resultMeta, index) => {
          const envelope = envelopes[index];
          if (envelope) {
            return Transaction.fromMetaWithEnvelope(
              this,
              resultMeta,
              envelope,
              index,
            );
          } else {
            return Transaction.fromMeta(this, resultMeta, index);
          }
        });
      }
      case "v2": {
        const v2 = meta.v2();
        const txProcessing = v2.txProcessing();

        // Extract envelopes from txSet
        const envelopes = this.extractEnvelopesFromGeneralizedTxSet(v2.txSet());

        // Match envelopes with transaction results by index
        return txProcessing.map((resultMeta, index) => {
          const envelope = envelopes[index];
          if (envelope) {
            return Transaction.fromMetaWithEnvelope(
              this,
              resultMeta,
              envelope,
              index,
            );
          } else {
            // Fallback to fromMeta if envelope not found (shouldn't happen normally)
            return Transaction.fromMeta(this, resultMeta, index);
          }
        });
      }
      default:
        throw new UNSUPPORTED_LEDGER_CLOSE_META_VERSION(`${version}`);
    }
  }

  /**
   * Extract transaction envelopes from GeneralizedTransactionSet (V1/V2 format)
   *
   * In V1/V2, envelopes are stored in txSet.v1TxSet().phases, not in TransactionMeta.
   *
   * Phase types:
   * - v0Components: Classic transactions (TxSetComponent[])
   * - parallelTxsComponent: Soroban transactions (ParallelTxExecutionStage[][])
   */
  private extractEnvelopesFromGeneralizedTxSet(
    txSet: xdr.GeneralizedTransactionSet,
  ): xdr.TransactionEnvelope[] {
    const txSetV1 = txSet.v1TxSet();
    const phases = txSetV1.phases();

    const allEnvelopes: xdr.TransactionEnvelope[] = [];

    for (const phase of phases) {
      // Use arm() method if available, otherwise fall back to switch().name
      // deno-lint-ignore no-explicit-any
      const arm = (phase as any).arm?.() ?? (phase as any).switch?.().name;

      if (arm === "v0Components") {
        // Classic transactions: phase contains TxSetComponent[]
        const components = phase.v0Components();
        for (const component of components) {
          const txsMaybeDiscounted = component.txsMaybeDiscountedFee();
          const txes = txsMaybeDiscounted.txes();
          allEnvelopes.push(...txes);
        }
      } else if (arm === "parallelTxsComponent") {
        // Soroban transactions: phase contains ParallelTxsComponent
        // Structure: executionStages -> stages -> clusters -> txs
        const parallel = phase.parallelTxsComponent();
        const stages = parallel.executionStages();

        for (const stage of stages) {
          // Each stage is an array of clusters
          for (const cluster of stage) {
            // Each cluster is an array of TransactionEnvelope
            allEnvelopes.push(...cluster);
          }
        }
      }
      // Other phase types are ignored (shouldn't exist currently)
    }

    return allEnvelopes;
  }

  /**
   * Get the total number of transactions in this ledger
   */
  get transactionCount(): number {
    return this.transactions.length;
  }

  /**
   * Get a transaction by index
   */
  getTransaction(index: number): Transaction | undefined {
    return this.transactions[index];
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      sequence: this.sequence,
      hash: this.hash,
      ledgerCloseTime: this.ledgerCloseTime,
      closedAt: this.closedAt.toISOString(),
      version: this.version,
      protocolVersion: this.protocolVersion,
      transactionCount: this.transactionCount,
      totalCoins: this.totalCoins.toString(),
      feePool: this.feePool.toString(),
      previousLedgerHash: this.previousLedgerHash,
    };
  }
}
