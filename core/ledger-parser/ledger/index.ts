// deno-coverage-ignore-start — Babel decorator helpers are injected at line 1 during transpilation; this excludes them from coverage
/**
 * @module ledger-parser/ledger
 * @description Ledger class for lazy XDR parsing with version switching
 */

import { memoize } from "@/common/decorators/memoize/index.ts";
// deno-coverage-ignore-stop
import { xdr } from "stellar-sdk";
import type { NetworkConfig } from "@/network/index.ts";
import { matchTransactionEnvelopes } from "@/ledger-parser/ledger/match-envelopes.ts";
import { INVALID_NETWORK_PASSPHRASE } from "@/ledger-parser/error.ts";
import type { LedgerEntry } from "@/ledger-parser/types.ts";
import { ensureXdrType } from "@/common/helpers/xdr/ensure-xdr-type.ts";
import { Transaction } from "@/ledger-parser/transaction/index.ts";
import {
  INVALID_HEADER_XDR,
  INVALID_LEDGER_ENTRY,
  INVALID_METADATA_XDR,
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
} from "@/ledger-parser/error.ts";

/**
 * Ledger class for lazy XDR parsing
 *
 * Supported versions (based on Lightsail archive RPC):
 * - LedgerCloseMeta: v0, v1, v2
 * - Transaction result metadata is preserved in its native XDR form.
 *
 * Envelope availability:
 * - v0: Available from the simple transaction set.
 * - v1/v2: Available from the generalized transaction set.
 * - Matching envelopes to results requires the ledger network passphrase.
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

  private readonly networkPassphrase?: string;

  private constructor(entry: LedgerEntry, network?: NetworkConfig | string) {
    this.networkPassphrase = typeof network === "string"
      ? network
      : network?.networkPassphrase;
    if (
      network !== undefined &&
      (typeof this.networkPassphrase !== "string" ||
        this.networkPassphrase.length === 0)
    ) {
      throw new INVALID_NETWORK_PASSPHRASE();
    }
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
   * Parses an RPC ledger locally, without making network requests.
   * Supply its NetworkConfig or passphrase to associate transaction envelopes
   * with execution results by hash. Without it, transactions expose result-only
   * data; envelope-dependent access fails explicitly. The passphrase is captured
   * at construction so later configuration changes cannot alter this ledger.
   */
  static fromEntry(
    entry: LedgerEntry,
    network?: NetworkConfig | string,
  ): Ledger {
    return new Ledger(entry, network);
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
      const historyEntry = ensureXdrType<xdr.LedgerHeaderHistoryEntry>(
        this.headerXdr,
        xdr.LedgerHeaderHistoryEntry,
      );
      return historyEntry.header;
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
      return ensureXdrType<xdr.LedgerCloseMeta>(
        this.metadataXdr,
        xdr.LedgerCloseMeta,
      );
    } catch (error) {
      // ensureXdrType always throws Error instances
      throw new INVALID_METADATA_XDR(error as Error);
    }
  }

  /**
   * Get the LedgerCloseMeta version (v0, v1, or v2)
   */
  get version(): "v0" | "v1" | "v2" {
    const type = this.meta.type;
    switch (type) {
      case "v0":
      case "v1":
      case "v2":
        return type;
    }
    throw new UNSUPPORTED_LEDGER_CLOSE_META_VERSION(type as string);
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
    return this.header.previousLedgerHash.toString();
  }

  /**
   * Get the total number of coins in circulation from the header
   */
  @memoize()
  get totalCoins(): bigint {
    return this.header.totalCoins;
  }

  /**
   * Get the fee pool from the header
   */
  @memoize()
  get feePool(): bigint {
    return this.header.feePool;
  }

  /**
   * Get the protocol version from the header
   */
  @memoize()
  get protocolVersion(): number {
    return this.header.ledgerVersion;
  }

  /**
   * Parse and return all transactions in this ledger
   *
   * Extracts envelopes from txSet and matches txProcessing by network-specific hash.
   * Omitting network context returns result-only transactions, never index-based guesses.
   *
   * @memoized - First access parses transactions, subsequent accesses return cached array
   */
  @memoize()
  get transactions(): Transaction[] {
    const meta = this.meta;
    switch (meta.type) {
      case "v0":
        return this.parseTransactions(meta.v0.txProcessing, meta.v0.txSet.txs);
      case "v1":
        return this.parseTransactions(
          meta.v1.txProcessing,
          this.extractEnvelopesFromGeneralizedTxSet(meta.v1.txSet),
        );
      case "v2":
        return this.parseTransactions(
          meta.v2.txProcessing,
          this.extractEnvelopesFromGeneralizedTxSet(meta.v2.txSet),
        );
      default:
        throw new UNSUPPORTED_LEDGER_CLOSE_META_VERSION(
          (meta as { type: string }).type,
        );
    }
  }

  /** Builds result-only views or hash-matched native-envelope views. */
  private parseTransactions(
    results: xdr.TransactionResultMeta[],
    envelopes: xdr.TransactionEnvelope[],
  ): Transaction[] {
    if (this.networkPassphrase === undefined) {
      return results.map((result, index) =>
        Transaction.fromMeta(this, result, index)
      );
    }
    const matched = matchTransactionEnvelopes(
      results,
      envelopes,
      this.networkPassphrase,
    );
    return results.map((result, index) =>
      Transaction.fromMetaWithEnvelope(this, result, matched[index], index)
    );
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
    const phases = txSet.v1TxSet.phases;

    const allEnvelopes: xdr.TransactionEnvelope[] = [];

    for (const phase of phases) {
      if (phase.type === "v0Components") {
        // Classic transactions: phase contains TxSetComponent[]
        const components = phase.v0Components;
        for (const component of components) {
          const txsMaybeDiscounted = component.txsMaybeDiscountedFee;
          const txes = txsMaybeDiscounted.txs;
          allEnvelopes.push(...txes);
        }
      } else if (phase.type === "parallelTxsComponent") {
        // Soroban transactions: phase contains ParallelTxsComponent
        // Structure: executionStages -> stages -> clusters -> txs
        const stages = phase.parallelTxsComponent.executionStages;

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
