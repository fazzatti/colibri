import type { ColibriError } from "../../mod.ts";

// Asserts that the given condition is true.
// Throws the provided error if the condition is false.
export function assert(
  condition: unknown,
  error: ColibriError
): asserts condition {
  if (!condition) throw error;
}
