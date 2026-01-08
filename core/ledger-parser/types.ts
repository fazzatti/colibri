/**
 * @module ledger-parser/types
 * @description Type definitions for the Ledger Parser module.
 *
 * Re-exports Stellar SDK RPC API types for type safety.
 */

import type { rpc } from "stellar-sdk";
import type { Ledger } from "@/ledger-parser/ledger/index.ts";
import type { Transaction } from "@/ledger-parser/transaction/index.ts";
import type { Operation } from "@/ledger-parser/operation/index.ts";

/**
 * Ledger entry from RPC `getLedgers()` response.
 *
 * Uses the official Stellar SDK type for RPC getLedgers raw response.
 * This ensures compatibility with the actual RPC API structure.
 *
 * @see {@link https://developers.stellar.org/docs/data/rpc/api-reference/methods/getLedgers | getLedgers API reference}
 *
 * @example
 * ```typescript
 * const response = await rpc.Server.getLedgers({ startLedger: 1000, pagination: { limit: 10 } });
 * const entry: LedgerEntry = response.ledgers[0];
 * const ledger = Ledger.fromEntry(entry);
 * ```
 */
export type LedgerEntry = rpc.Api.RawLedgerResponse;

/**
 * Instance type for a parsed Ledger.
 *
 * This type represents a fully constructed Ledger instance with all its methods
 * and properties available. Use this when you need to reference a Ledger instance
 * in type annotations.
 *
 * @example
 * ```typescript
 * function processLedger(ledger: ParsedLedger): void {
 *   console.log(\`Ledger \${ledger.sequence} has \${ledger.transactions.length} transactions\`);
 * }
 * ```
 */
export type ParsedLedger = Ledger;

/**
 * Instance type for a parsed Transaction.
 *
 * @example
 * ```typescript
 * function analyzeTransaction(tx: ParsedTransaction): void {
 *   console.log(\`Transaction \${tx.hash} has \${tx.operations.length} operations\`);
 * }
 * ```
 */
export type ParsedTransaction = Transaction;

/**
 * Instance type for a parsed Operation.
 *
 * @example
 * ```typescript
 * function handleOperation(op: ParsedOperation): void {
 *   if (op.type === 'payment') {
 *     console.log('Payment operation:', op.body);
 *   }
 * }
 * ```
 */
export type ParsedOperation = Operation;
