import type {
  BuildVerificationLimits,
  VerificationState,
} from "../../core/index.ts";
import type {
  BuildArtifactCandidate,
  BuildArtifactCollector,
} from "../../artifacts/types.ts";
import type { VerificationArchiveExtractor } from "../../archive/types.ts";
import type {
  ContractBuildRunner,
  ContractBuildRunnerOutput,
} from "../../runners/types.ts";
import type { VerificationLogging } from "../../reporting/types.ts";
import type { ResolvedBuildImageValue } from "../resolve-build-image/types.ts";

/** Active value produced after execution and candidate capture. */
export type ExecutedContractBuildValue = ResolvedBuildImageValue & {
  readonly buildArguments: readonly string[];
  readonly execution: ContractBuildRunnerOutput;
  readonly candidates: readonly BuildArtifactCandidate[];
};

/** Injectable workspace filesystem seams used by the execution process. */
export type ContractBuildWorkspace = {
  readonly makeTempDir?: typeof Deno.makeTempDir;
  readonly remove?: typeof Deno.remove;
};

/** Input accepted by {@link executeContractBuild}. */
export type ExecuteContractBuildInput = {
  readonly state: VerificationState<ResolvedBuildImageValue>;
  readonly extractor: VerificationArchiveExtractor;
  readonly runner: ContractBuildRunner;
  readonly artifactCollector: BuildArtifactCollector;
  readonly allowBuildNetwork: boolean;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly workspace?: ContractBuildWorkspace;
  readonly now?: () => string;
};

/** Output produced by {@link executeContractBuild}. */
export type ExecuteContractBuildOutput = VerificationState<
  ExecutedContractBuildValue
>;
