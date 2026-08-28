import type {
  BuildVerificationLimits,
  VerificationNetwork,
  VerificationPolicy,
} from "../core/index.ts";
import type { VerificationArchiveExtractor } from "../archive/types.ts";
import type { BuildArtifactCollector } from "../artifacts/types.ts";
import type {
  BuildVerificationPipeline,
  BuildVerificationPipelinePlugin,
} from "../pipelines/build-verification/index.ts";
import type { ContractBuildWorkspace } from "../processes/execute-contract-build/types.ts";
import type { ContainerImageResolver } from "../providers/image/types.ts";
import type { VerificationSourceProvider } from "../providers/source/types.ts";
import type { VerificationTargetResolver } from "../providers/target/types.ts";
import type { VerificationLogger } from "../reporting/types.ts";
import type {
  ContractBuildRunner,
  DockerConnectionConfig,
} from "../runners/types.ts";

/** Options shared by reusable and one-shot verifier APIs. */
export type ContractBuildVerifierOptions = {
  readonly network?: VerificationNetwork;
  readonly targetResolver?: VerificationTargetResolver;
  readonly sourceProvider?: VerificationSourceProvider;
  readonly imageResolver?: ContainerImageResolver;
  readonly archiveExtractor?: VerificationArchiveExtractor;
  readonly artifactCollector?: BuildArtifactCollector;
  readonly runner?: ContractBuildRunner;
  readonly policy?: Partial<VerificationPolicy>;
  readonly allowBuildNetwork?: boolean;
  readonly limits?: Partial<BuildVerificationLimits>;
  readonly logger?: VerificationLogger;
  readonly strictLogger?: boolean;
  readonly githubToken?: string;
  readonly urlHeaders?: Readonly<Record<string, string>>;
  readonly docker?: DockerConnectionConfig;
  readonly fetch?: typeof globalThis.fetch;
  readonly plugins?: readonly BuildVerificationPipelinePlugin[];
  /** @internal Injectable clock used by deterministic tests. */
  readonly now?: () => string;
  /** @internal Injectable temporary-workspace boundary used by tests. */
  readonly workspace?: ContractBuildWorkspace;
};

/** Public high-level verifier contract. */
export interface ContractBuildVerifierLike {
  /** Composable pipeline that owns this verifier's workflow. */
  readonly verificationPipe: BuildVerificationPipeline;
}
