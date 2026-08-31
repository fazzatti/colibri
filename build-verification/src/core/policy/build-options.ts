import { posix } from "node:path";
import type {
  BuildOptionPolicy,
  PolicyCheck,
  PolicyDecision,
} from "@/core/policy/types.ts";

/** Stable identifier of the default Stellar contract-build option policy. */
export const DEFAULT_BUILD_OPTION_POLICY_ID =
  "colibri.stellar-contract-build-options";

const FLAG_OPTIONS = new Set([
  "--all-features",
  "--ignore-checks",
  "--locked",
  "--no-default-features",
  "--offline",
  "--optimize",
  "--release",
  "--wasm32v1-none",
]);
const VALUE_OPTIONS = new Set([
  "--features",
  "--manifest-path",
  "--package",
  "--profile",
]);
const PATH_OPTIONS = new Set(["--manifest-path"]);

const isSafeRelativePath = (value: string): boolean => {
  if (!value || value.includes("\0") || value.includes("\\")) return false;
  if (posix.isAbsolute(value) || value.split("/").includes("..")) return false;
  const normalized = posix.normalize(value);
  return normalized !== "." && !normalized.startsWith("../");
};

const evaluateOption = (option: string): PolicyCheck => {
  if (FLAG_OPTIONS.has(option)) {
    return { name: `option:${option}`, passed: true, observed: option };
  }
  const equals = option.indexOf("=");
  const name = equals < 0 ? option : option.slice(0, equals);
  const value = equals < 0 ? "" : option.slice(equals + 1);
  const known = VALUE_OPTIONS.has(name);
  const complete = known && equals > 0 && value.length > 0;
  const safePath = !PATH_OPTIONS.has(name) || isSafeRelativePath(value);
  return {
    name: `option:${name || "unknown"}`,
    passed: complete && safePath,
    observed: option,
  };
};

/** Versioned allow-list for reproducible `stellar contract build` options. */
export class DefaultBuildOptionPolicy implements BuildOptionPolicy {
  /** Evaluates each complete option and its command context. */
  evaluate(
    options: readonly string[],
    arguments_: readonly string[],
  ): PolicyDecision {
    const commandAccepted = arguments_.length === 2 &&
      arguments_[0] === "contract" && arguments_[1] === "build";
    const optionChecks = options.map(evaluateOption);
    const duplicateSingleton = options.map((option) => option.split("=", 1)[0])
      .some((name, index, names) =>
        VALUE_OPTIONS.has(name) && names.indexOf(name) !== index
      );
    const checks: PolicyCheck[] = [
      {
        name: "command-context",
        passed: commandAccepted,
        observed: [...arguments_],
      },
      ...optionChecks,
      {
        name: "singleton-options",
        passed: !duplicateSingleton,
      },
    ];
    const accepted = checks.every(({ passed }) => passed);
    return {
      accepted,
      policy: DEFAULT_BUILD_OPTION_POLICY_ID,
      version: "1",
      checks,
      reasons: accepted ? [] : [
        "One or more build options are unsupported, incomplete, duplicated, or escape the source root.",
      ],
      warnings: [],
    };
  }
}
