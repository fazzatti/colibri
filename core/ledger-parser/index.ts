/**
 * @module ledger-parser
 * @description Lazy XDR parsing for Stellar ledgers, transactions, and operations.
 *
 * Provides efficient parsing of ledger data returned from RPC `getLedgers()` with
 * memoized XDR decoding and version switching support.
 *
 * @example
 * ```typescript
 * import { Ledger } from "@colibri/core";
 *
 * const response = await rpc.Server.getLedgers({ startLedger: 1000, pagination: { limit: 1 } });
 * const ledger = Ledger.fromEntry(response.ledgers[0]);
 *
 * console.log(\`Ledger \${ledger.sequence} (version: \${ledger.version})\`);
 * console.log(\`Total coins: \${ledger.totalCoins}\`);
 * console.log(\`Transactions: \${ledger.transactions.length}\`);
 * ```
 */

export * from "@/ledger-parser/ledger/index.ts";
export * from "@/ledger-parser/transaction/index.ts";
export * from "@/ledger-parser/operation/index.ts";
export * as ERRORS_LDP from "@/ledger-parser/error.ts";
