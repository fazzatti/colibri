import type { ColibriError } from "@/error/index.ts";

// Asserts that all provided arguments are neither null nor undefined.
// Throws the provided error if any argument is invalid.
/**
 * Asserts that a bag of named arguments is fully defined.
 *
 * @param args Candidate argument bag.
 * @param errorFn Factory used to construct the thrown error.
 */
export function assertRequiredArgs(
  args: Record<string, unknown>,
  errorFn: (argName: string) => ColibriError
): asserts args is Record<string, unknown> {
  for (const argName of Object.keys(args)) {
    if (!(argName in args) || args[argName] === undefined)
      throw errorFn(argName);
  }
}
