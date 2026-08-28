import type { ContractBuildVerificationInput } from "../types/input.ts";

/** Validates the runtime shape of a strict or out-of-band request. */
export const isContractBuildVerificationInput = (
  value: unknown,
): value is ContractBuildVerificationInput => {
  if (typeof value !== "object" || value === null || !("target" in value)) {
    return false;
  }
  const input = value as Record<string, unknown>;
  if (
    input.mode !== undefined && input.mode !== "strictSep58" &&
    input.mode !== "outOfBand"
  ) return false;
  if (input.mode === "outOfBand") {
    return input.source !== undefined &&
      typeof input.recipe === "object" && input.recipe !== null;
  }
  return !("recipe" in input) || input.recipe === undefined;
};
