/**
 * Type guard for SEP10Challenge instances.
 */

import { SEP10Challenge } from "@/challenge/challenge.ts";

/**
 * Type guard to check if a value is a SEP10Challenge instance.
 *
 * @param value - The value to check
 * @returns true if value is a SEP10Challenge instance
 *
 * @example
 * ```typescript
 * import { isSEP10Challenge } from "@colibri/sep10";
 *
 * function handleChallenge(value: unknown) {
 *   if (isSEP10Challenge(value)) {
 *     // TypeScript knows value is SEP10Challenge
 *     console.log(value.homeDomain);
 *   }
 * }
 * ```
 */
export function isSEP10Challenge(value: unknown): value is SEP10Challenge {
  return value instanceof SEP10Challenge;
}
