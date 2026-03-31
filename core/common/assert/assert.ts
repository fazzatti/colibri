import type { ColibriError } from "@/error/index.ts";

// Asserts that the given condition is true.
// Throws the provided error if the condition is false.
/**
 * Asserts that a condition is truthy.
 *
 * @param condition Value to validate.
 * @param error Error thrown when the condition is falsy.
 */
export function assert(
  condition: unknown,
  error: ColibriError
): asserts condition {
  if (!condition) throw error;
}
