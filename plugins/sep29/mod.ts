/**
 * Opt-in SEP-29 memo-presence checks for Stellar transactions using RPC.
 * Includes a standalone checker and a non-mutating Colibri submission plugin.
 * @module
 */
export { checkMemoRequired } from "@/check-memo-required.ts";
export { createSep29Plugin } from "@/index.ts";
export {
  SEP29_MEMO_REQUIRED_DATA_NAME,
  SEP29_PLUGIN_ID,
  SEP29_PLUGIN_TARGET,
} from "@/types.ts";
export type { CheckMemoRequiredInput } from "@/types.ts";
export { Code, ERROR_PLG_SEP29 } from "@/error.ts";
import * as E from "@/error.ts";
/** Typed SEP-29 failures for code-based or constructor-based handling. */
export const Sep29Errors: typeof E = E;
