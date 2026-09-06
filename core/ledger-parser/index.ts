/**
 * @module ledger-parser
 * @description Lazy XDR parsing for Stellar ledgers, transactions, and operations.
 *
 * Provides efficient parsing of ledger data returned from RPC `getLedgers()` with
 * memoized XDR decoding and version switching support.
 *
 * @example
 * ```typescript
 * import { Ledger, NetworkConfig } from "@colibri/core";
 * import { Server } from "npm:@stellar/stellar-sdk/rpc";
 *
 * const networkConfig = NetworkConfig.TestNet();
 * const rpc = new Server(networkConfig.rpcUrl);
 * const { sequence } = await rpc.getLatestLedger();
 * const response = await rpc.getLedgers({ startLedger: sequence, pagination: { limit: 1 } });
 * const ledger = Ledger.fromEntry(response.ledgers[0], networkConfig);
 *
 * console.log("Ledger:", ledger.sequence, "version:", ledger.version);
 * console.log("Total coins:", ledger.totalCoins);
 * console.log("Transactions:", ledger.transactions.length);
 * ```
 */

export * from "@/ledger-parser/ledger/index.ts";
export * from "@/ledger-parser/transaction/index.ts";
export * from "@/ledger-parser/operation/index.ts";
export * as ERRORS_LDP from "@/ledger-parser/error.ts";
