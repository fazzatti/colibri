/**
 * Colibri React classic transaction APIs.
 * @module
 */
export * from "@/transactions/classic/hook.ts";

// Shared type exports are erased from the runtime bundle.
export type { MutationControls } from "@/query/options.ts";
export type {
  ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@colibri/core";
