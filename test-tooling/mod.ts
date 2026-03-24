/**
 * @module @colibri/test-tooling
 *
 * Test infrastructure helpers for Colibri packages.
 *
 * The current public API focuses on `StellarTestLedger`, a small harness that
 * starts, reuses, and destroys a Stellar Quickstart container for integration
 * tests.
 *
 * @example
 * ```ts
 * import { StellarTestLedger } from "jsr:@colibri/test-tooling";
 *
 * const ledger = new StellarTestLedger();
 * await ledger.start();
 *
 * const network = await ledger.getNetworkDetails();
 * console.log(network.rpcUrl);
 *
 * await ledger.stop();
 * await ledger.destroy();
 * ```
 */

export * from "@/quickstart/index.ts";
export * from "@/quickstart/types.ts";
export * from "@/quickstart/error.ts";
