/**
 * Colibri's shared error class and types without contract or parser initialization.
 * The root and this entrypoint export the same constructor.
 * @module
 */
export { ColibriError, GeneralCode, UnexpectedError } from "@/error/index.ts";
export type * from "@/error/types.ts";
