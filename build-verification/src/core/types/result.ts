import type {
  ContainerImageDetails,
  JsonValue,
  PolicyDecision,
} from "../policy/types.ts";
import type { ContractMetadataEntry } from "../recipe/types.ts";
import type { VerificationNetworkEvidence } from "./network.ts";
import type { VerificationSourceEvidence } from "./source.ts";
import type { VerificationTargetEvidence } from "./target.ts";

/** Stable verification stages used by structured logs and plugins. */
export type BuildVerificationStage =
  | "resolve-verification-target"
  | "parse-contract-metadata"
  | "validate-build-recipe"
  | "resolve-source-archive"
  | "resolve-build-image"
  | "execute-contract-build"
  | "select-build-artifact"
  | "compare-contract-wasm";

/** One bounded structured event emitted during verification. */
export type VerificationLogEvent = {
  readonly timestamp: string;
  readonly stage: BuildVerificationStage;
  readonly level: "debug" | "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, JsonValue>>;
};

/** Metadata observations retained without collapsing duplicate entries. */
export type VerificationMetadataEvidence = {
  readonly sectionCount: number;
  readonly selectedSection?: number;
  readonly entries: readonly ContractMetadataEntry[];
  readonly source: "contractmetav0";
};

/** Recipe and policy observations retained in verification evidence. */
export type VerificationRecipeEvidence = {
  readonly provenance: "onChainSep58Metadata" | "callerSupplied";
  readonly image: string;
  readonly arguments: readonly string[];
  readonly options: readonly string[];
  readonly metadata: readonly ContractMetadataEntry[];
  readonly sourceUri?: string;
  readonly sourceSha256?: string;
  readonly commandPolicy: PolicyDecision;
  readonly optionPolicy: PolicyDecision;
};

/** Resolved image and image-policy observations retained in evidence. */
export type VerificationImageEvidence = {
  readonly details: Omit<ContainerImageDetails, "environment"> & {
    readonly environmentVariableNames: readonly string[];
  };
  readonly policy: PolicyDecision;
};

/** One candidate Wasm captured before the disposable workspace is removed. */
export type BuildArtifactCandidateEvidence = {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
};

/** Build-runner capabilities recorded without overstating enforcement. */
export type BuildRunnerCapabilities = {
  readonly networkIsolation: boolean;
  readonly readOnlyRootFilesystem: boolean;
  readonly cpuLimit: boolean;
  readonly memoryLimit: boolean;
  readonly pidLimit: boolean;
  readonly timeout: boolean;
  readonly hardDiskLimit: boolean;
};

/** Serializable execution facts retained in verification evidence. */
export type VerificationExecutionEvidence = {
  readonly image: string;
  readonly arguments: readonly string[];
  readonly rustupToolchain: string;
  readonly networkEnabled: boolean;
  readonly limits: Readonly<Record<string, number>>;
  readonly runner: { readonly name: string; readonly version: string };
  readonly capabilities: BuildRunnerCapabilities;
  readonly runtimeImageDigest: string;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly candidates: readonly BuildArtifactCandidateEvidence[];
};

/** Serializable selected-artifact facts retained in verification evidence. */
export type VerificationArtifactEvidence = {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
};

/** Immutable evidence progressively refined by verification processes. */
export type ContractBuildVerificationEvidence = {
  readonly package: {
    readonly name: "@colibri/build-verification";
    readonly version: string;
  };
  readonly mode: "strictSep58" | "outOfBand";
  readonly recipeProvenance?: "onChainSep58Metadata" | "callerSupplied";
  readonly network?: VerificationNetworkEvidence;
  readonly target?: VerificationTargetEvidence;
  readonly metadata?: VerificationMetadataEvidence;
  readonly recipe?: VerificationRecipeEvidence;
  readonly source?: VerificationSourceEvidence & {
    readonly policy?: PolicyDecision;
  };
  readonly image?: VerificationImageEvidence;
  readonly execution?: VerificationExecutionEvidence;
  readonly artifact?: VerificationArtifactEvidence;
  readonly comparison?: {
    readonly equal: boolean;
    readonly targetLength: number;
    readonly rebuiltLength: number;
  };
  readonly logs: readonly VerificationLogEvent[];
  readonly observedAt: string;
};

/** Result returned after comparison or a standards-defined early completion. */
export type ContractBuildVerificationResult =
  | {
    readonly status: "verified";
    readonly evidence: ContractBuildVerificationEvidence;
  }
  | {
    readonly status: "mismatch";
    readonly evidence: ContractBuildVerificationEvidence;
  }
  | {
    readonly status: "notApplicable";
    readonly reason: "stellarAssetContract" | "missingSep58Metadata";
    readonly targetWasmHash?: string;
    readonly evidence: ContractBuildVerificationEvidence;
  };
