import { DefaultVerificationArchiveExtractor } from "../archive/extract.ts";
import { DefaultBuildArtifactCollector } from "../artifacts/collect.ts";
import {
  createDefaultVerificationPolicy,
  DEFAULT_BUILD_VERIFICATION_LIMITS,
} from "../core/index.ts";
import type { BuildVerificationLimits } from "../core/index.ts";
import { InvalidVerifierOptionsError } from "../error/core.ts";
import type { BuildVerificationPipelineDependencies } from "../pipelines/build-verification/types.ts";
import { OciContainerImageResolver } from "../providers/image/oci.ts";
import { DefaultVerificationSourceProvider } from "../providers/source/router.ts";
import { DefaultVerificationTargetResolver } from "../providers/target/default.ts";
import { normalizeVerificationNetwork } from "../providers/target/stellar.ts";
import { DockerBuildRunner } from "../runners/docker/runner.ts";
import type { ContractBuildVerifierOptions } from "./types.ts";

/** Merges and validates all verifier resource limits. */
export const normalizeBuildVerificationLimits = (
  overrides: Partial<BuildVerificationLimits> = {},
): BuildVerificationLimits => {
  const limits = { ...DEFAULT_BUILD_VERIFICATION_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new InvalidVerifierOptionsError(
        "Every build-verification limit must be a positive finite number.",
        { name, value },
      );
    }
  }
  return Object.freeze(limits);
};

/** Creates every missing adapter used by the high-level verifier. */
export const createDefaultBuildVerificationDependencies = (
  options: ContractBuildVerifierOptions = {},
): BuildVerificationPipelineDependencies => {
  if (
    options.allowBuildNetwork !== undefined &&
    typeof options.allowBuildNetwork !== "boolean"
  ) {
    throw new InvalidVerifierOptionsError(
      "allowBuildNetwork must be a boolean when provided.",
    );
  }
  if (
    options.strictLogger !== undefined &&
    typeof options.strictLogger !== "boolean"
  ) {
    throw new InvalidVerifierOptionsError(
      "strictLogger must be a boolean when provided.",
    );
  }
  const limits = normalizeBuildVerificationLimits(options.limits);
  const policy = createDefaultVerificationPolicy(options.policy);
  const network = options.network
    ? normalizeVerificationNetwork(options.network)
    : undefined;
  return {
    targetResolver: options.targetResolver ??
      new DefaultVerificationTargetResolver(network, options.now),
    sourceProvider: options.sourceProvider ??
      new DefaultVerificationSourceProvider({
        sourcePolicy: policy.source,
        githubToken: options.githubToken,
        urlHeaders: options.urlHeaders,
      }),
    imageResolver: options.imageResolver ??
      new OciContainerImageResolver({ fetch: options.fetch }),
    imagePolicy: policy.image,
    commandPolicy: policy.command,
    optionPolicy: policy.options,
    archiveExtractor: options.archiveExtractor ??
      new DefaultVerificationArchiveExtractor(),
    runner: options.runner ?? new DockerBuildRunner(options.docker),
    artifactCollector: options.artifactCollector ??
      new DefaultBuildArtifactCollector(),
    allowBuildNetwork: options.allowBuildNetwork ?? false,
    limits,
    networkEvidence: network?.evidence,
    logging: options.logger || options.strictLogger
      ? { logger: options.logger, strict: options.strictLogger }
      : undefined,
    workspace: options.workspace,
    now: options.now,
  };
};
