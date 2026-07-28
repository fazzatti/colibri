/**
 * Draft SEP-45 Web Authentication clients, challenge states, contract
 * authorization adapters, verification, and enforcing simulation helpers.
 *
 * @module sep45
 */

export * from "@/sep45/client.ts";
export * from "@/token.ts";
export * from "@/sep45/challenge.ts";
export * from "@/sep45/contract-auth.ts";
export * from "@/sep45/codec.ts";
export * from "@/sep45/verify-challenge.ts";
export * from "@/sep45/simulation.ts";
export * from "@/sep45/types.ts";

/** Stable SEP-45-specific error codes. */
export { Sep45Code } from "@/error.ts";

/** Base class for SEP-45-specific authentication failures. */
export { Sep45Error } from "@/error.ts";

/** Stable error codes shared by both WebAuth protocols. */
export { WebAuthCode } from "@/error.ts";

/** Base class for shared WebAuth failures. */
export { WebAuthError } from "@/error.ts";

/** Context supplied to a contract authorization handler. */
export type { ContractAuthContext } from "@/types.ts";

/** Protocol identifiers understood by WebAuth. */
export type { WebAuthProtocol } from "@/types.ts";

/** Supported challenge submission body encodings. */
export type { WebAuthSubmissionFormat } from "@/types.ts";
