/**
 * SEP-10 Web Authentication clients, challenge states, verification helpers,
 * token handling, and typed errors.
 *
 * @module sep10
 */

export * from "@/sep10/client.ts";
export * from "@/token.ts";
export * from "@/sep10/challenge.ts";
export * from "@/sep10/verify-challenge.ts";
export * from "@/sep10/types.ts";

/** Stable SEP-10-specific error codes. */
export { Sep10Code } from "@/error.ts";

/** Base class for SEP-10-specific authentication failures. */
export { Sep10Error } from "@/error.ts";

/** Stable error codes shared by both WebAuth protocols. */
export { WebAuthCode } from "@/error.ts";

/** Base class for shared WebAuth failures. */
export { WebAuthError } from "@/error.ts";

/** Protocol identifiers understood by WebAuth. */
export type { WebAuthProtocol } from "@/types.ts";

/** Supported challenge submission body encodings. */
export type { WebAuthSubmissionFormat } from "@/types.ts";
