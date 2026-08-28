import type { BuildCommandPolicy, PolicyDecision } from "./types.ts";

/** Stable identifier of the default Stellar contract-build command policy. */
export const DEFAULT_BUILD_COMMAND_POLICY_ID =
  "colibri.stellar-contract-build-command";

/** Default policy that accepts only `stellar contract build`. */
export class DefaultBuildCommandPolicy implements BuildCommandPolicy {
  /** Evaluates the ordered command arguments without performing I/O. */
  evaluate(arguments_: readonly string[]): PolicyDecision {
    const accepted = arguments_.length === 2 &&
      arguments_[0] === "contract" && arguments_[1] === "build";
    return {
      accepted,
      policy: DEFAULT_BUILD_COMMAND_POLICY_ID,
      version: "1",
      checks: [{
        name: "exact-command",
        passed: accepted,
        observed: [...arguments_],
      }],
      reasons: accepted ? [] : [
        "The default executor accepts only the ordered command `contract build`.",
      ],
      warnings: [],
    };
  }
}
