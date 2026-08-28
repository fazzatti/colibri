import type Dockerode from "dockerode";
import type { BuildVerificationLimits } from "../core/types/limits.ts";
import type { BuildRunnerCapabilities } from "../core/types/result.ts";
import type { ContainerImageDetails } from "../core/policy/types.ts";

/** Connection settings used by the Docker-backed build runner. */
export type DockerConnectionConfig = {
  readonly dockerOptions?: Dockerode.DockerOptions;
  readonly dockerSocketPath?: string;
};

/** Exact execution plan passed to a contract build runner. */
export type ContractBuildPlan = {
  readonly sourceDirectory: string;
  readonly image: ContainerImageDetails;
  readonly arguments: readonly string[];
  readonly rustupToolchain: string;
  readonly allowNetwork: boolean;
  readonly limits: BuildVerificationLimits;
};

/** Successful execution facts returned before artifact collection. */
export type ContractBuildRunnerOutput = {
  readonly exitCode: 0;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly runtimeImageDigest: string;
  readonly runner: { readonly name: string; readonly version: string };
  readonly capabilities: BuildRunnerCapabilities;
};

/** Pluggable boundary limited to isolated contract build execution. */
export interface ContractBuildRunner {
  /** Executes an approved plan without discovering or selecting a Wasm. */
  run(input: ContractBuildPlan): Promise<ContractBuildRunnerOutput>;
}
