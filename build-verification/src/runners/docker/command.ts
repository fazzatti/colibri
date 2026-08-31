import type { ContractBuildPlan } from "@/runners/types.ts";
import { BuildPlanInvalidError } from "@/runners/docker/error.ts";

/** Returns the exact structured argument vector for a validated build plan. */
export const buildDockerCommand = (input: ContractBuildPlan): string[] => {
  if (
    input.arguments.length === 0 ||
    input.arguments.some((argument) =>
      typeof argument !== "string" || !argument
    )
  ) {
    throw new BuildPlanInvalidError(
      "The Docker build plan requires a non-empty structured argument vector.",
    );
  }
  return [...input.arguments];
};
