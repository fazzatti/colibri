/**
 * Colibri React classic transaction APIs.
 * @module
 */
export * from "@/transactions/classic.ts";

// Shared type exports are erased from the runtime bundle.
export type { MutationControls } from "@/query.ts";
export type {
  ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@colibri/core";
