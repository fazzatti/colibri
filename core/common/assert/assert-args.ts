import type { ColibriError } from "@/error/index.ts";

// Asserts that all provided arguments are neither null nor undefined.
// Throws the provided error if any argument is invalid.
export function assertRequiredArgs(
  args: Record<string, unknown>,
  errorFn: (argName: string) => ColibriError
): asserts args is Record<string, unknown> {
  for (const argName of Object.keys(args)) {
    if (!(argName in args) || args[argName] === undefined)
      throw errorFn(argName);
  }
}
