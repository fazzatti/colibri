/**
 * Docker-backed build runner and Docker connection helpers.
 *
 * @module
 */

export { DockerBuildRunner, resolveDockerOptions } from "@/docker-runner.ts";
export type {
  BuildVerificationLimits,
  ContractBuildRecipe,
  ContractBuildRunner,
  ContractBuildRunnerInput,
  ContractBuildRunnerOutput,
  ContractMetadataEntry,
  DockerConnectionConfig,
} from "@/types.ts";
