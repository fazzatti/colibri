import type { ColibriError } from "../../mod.ts";

export function assert(
  condition: unknown,
  error: ColibriError
): asserts condition {
  if (!condition) throw error;
}
