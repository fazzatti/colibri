import type {
  BuildCommandPolicy,
  BuildOptionPolicy,
  BuildVerificationLimits,
  ContainerImagePolicy,
  ContractBuildVerificationInput,
  VerificationNetworkEvidence,
} from "@/core/index.ts";
import type { BuildArtifactCollector } from "@/artifacts/types.ts";
import type { VerificationArchiveExtractor } from "@/archive/types.ts";
import type { ContractBuildWorkspace } from "@/processes/execute-contract-build/types.ts";
import type { ContainerImageResolver } from "@/providers/image/types.ts";
import type { VerificationSourceProvider } from "@/providers/source/types.ts";
import type { VerificationTargetResolver } from "@/providers/target/types.ts";
import type { VerificationLogging } from "@/reporting/types.ts";
import type { ContractBuildRunner } from "@/runners/types.ts";

/** Dependencies shared by the build-verification pipeline connectors. */
export type BuildVerificationPipelineDependencies = {
  readonly targetResolver: VerificationTargetResolver;
  readonly sourceProvider: VerificationSourceProvider;
  readonly imageResolver: ContainerImageResolver;
  readonly imagePolicy: ContainerImagePolicy;
  readonly commandPolicy: BuildCommandPolicy;
  readonly optionPolicy: BuildOptionPolicy;
  readonly archiveExtractor: VerificationArchiveExtractor;
  readonly runner: ContractBuildRunner;
  readonly artifactCollector: BuildArtifactCollector;
  readonly allowBuildNetwork: boolean;
  readonly limits: BuildVerificationLimits;
  readonly networkEvidence?: VerificationNetworkEvidence;
  readonly logging?: VerificationLogging;
  readonly workspace?: ContractBuildWorkspace;
  readonly now?: () => string;
};

/** Arguments accepted by {@link createBuildVerificationPipeline}. */
export type CreateBuildVerificationPipelineArgs =
  BuildVerificationPipelineDependencies;

/** Public input accepted by the build-verification pipeline. */
export type BuildVerificationPipelineInput = ContractBuildVerificationInput;
