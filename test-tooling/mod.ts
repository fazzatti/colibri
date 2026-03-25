/**
 * @module @colibri/test-tooling
 *
 * Test infrastructure helpers for Colibri packages.
 *
 * The current public API focuses on `StellarTestLedger`, a small harness that
 * starts, reuses, and destroys a Stellar Quickstart container for integration
 * tests across local, testnet, and futurenet variants.
 *
 * @example
 * ```ts
 * import {
 *   QuickstartImageTags,
 *   QuickstartServices,
 *   StellarTestLedger,
 * } from "jsr:@colibri/test-tooling";
 *
 * const ledger = new StellarTestLedger({
 *   containerImageVersion: QuickstartImageTags.TESTING,
 *   enabledServices: [
 *     QuickstartServices.CORE,
 *     QuickstartServices.HORIZON,
 *     QuickstartServices.RPC,
 *     QuickstartServices.LAB,
 *   ] as const,
 * });
 * await ledger.start();
 *
 * const details = await ledger.getNetworkDetails();
 * console.log(details.rpcUrl);
 * console.log(details.labUrl);
 *
 * await ledger.stop();
 * await ledger.destroy();
 * ```
 */

export * from "@/quickstart/index.ts";
export * from "@/quickstart/types.ts";
export * from "@/quickstart/error.ts";
