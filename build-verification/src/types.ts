import type { INetworkConfig, RpcLedgerEntriesClient } from "@colibri/core";
import type Dockerode from "dockerode";

/** @internal Exact Core network shape retained without re-exporting Core. */
export type BuildVerificationNetworkConfig = INetworkConfig;

/** @internal Exact Core RPC reader shape retained without re-exporting Core. */
export type BuildVerificationRpcClient = RpcLedgerEntriesClient;

/** A contract wasm supplied directly or resolved from a Stellar network. */
export type VerificationTarget =
  | { readonly wasm: Uint8Array; readonly label?: string }
  | { readonly wasmHash: string; readonly label?: string }
  | { readonly contractId: string; readonly label?: string };

/** Network inputs accepted when a target must be read from Stellar RPC. */
export type VerificationNetwork =
  | {
    readonly networkConfig: BuildVerificationNetworkConfig;
    readonly rpc?: never;
    readonly rpcUrl?: never;
    readonly networkPassphrase?: never;
    readonly allowHttp?: never;
  }
  | {
    readonly rpc: BuildVerificationRpcClient;
    readonly networkPassphrase: string;
    readonly networkConfig?: never;
    readonly rpcUrl?: never;
    readonly allowHttp?: never;
  }
  | {
    readonly rpcUrl: string;
    readonly networkPassphrase: string;
    readonly allowHttp?: boolean;
    readonly networkConfig?: never;
    readonly rpc?: never;
  };

/** Supported source-code inputs. Directories are limited to out-of-band mode. */
export type VerificationSource =
  | {
    readonly type: "archive";
    readonly bytes: Uint8Array;
    readonly name: string;
  }
  | { readonly type: "path"; readonly path: string }
  | { readonly type: "url"; readonly url: string }
  | {
    readonly type: "github";
    readonly owner: string;
    readonly repository: string;
    readonly ref: string;
  };

/** Ordered metadata key/value pair replayed during a rebuild. */
export type ContractMetadataEntry = {
  readonly key: string;
  readonly value: string;
};

/** Exact build recipe discovered from SEP-58 metadata or supplied out of band. */
export type ContractBuildRecipe = {
  readonly image: string;
  readonly arguments: readonly string[];
  readonly options: readonly string[];
  readonly metadata: readonly ContractMetadataEntry[];
  readonly sourceUri?: string;
  readonly sourceSha256?: string;
};

/** Explicit recipe used when a target has no authoritative SEP-58 metadata. */
export type OutOfBandBuildRecipe = {
  readonly image: string;
  readonly arguments?: readonly string[];
  readonly options?: readonly string[];
  readonly metadata?: readonly ContractMetadataEntry[];
  readonly sourceSha256?: string;
};

/** Resource limits applied to source ingestion and build execution. */
export type BuildVerificationLimits = {
  readonly maxArchiveBytes: number;
  readonly maxExtractedBytes: number;
  readonly maxFileBytes: number;
  readonly maxFiles: number;
  readonly maxPathLength: number;
  readonly maxLogBytes: number;
  readonly timeoutMs: number;
  readonly memoryBytes: number;
  readonly cpus: number;
  readonly pids: number;
};

/** Default conservative limits used by the verifier. */
export const DEFAULT_BUILD_VERIFICATION_LIMITS: BuildVerificationLimits = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxExtractedBytes: 512 * 1024 * 1024,
  maxFileBytes: 128 * 1024 * 1024,
  maxFiles: 20_000,
  maxPathLength: 512,
  maxLogBytes: 1024 * 1024,
  timeoutMs: 10 * 60 * 1000,
  memoryBytes: 4 * 1024 * 1024 * 1024,
  cpus: 2,
  pids: 512,
};

/** Image facts resolved before an image policy makes its decision. */
export type ContainerImageDetails = {
  readonly reference: string;
  readonly registry: string;
  readonly repository: string;
  readonly digest: string;
  readonly mediaType: string;
  readonly architecture?: string;
  readonly os?: string;
};

/** Policy boundary used to accept or reject a pinned build image. */
export interface ContainerImagePolicy {
  /** Validates a resolved image or throws a typed build-verification error. */
  validate(details: ContainerImageDetails): void | Promise<void>;
}

/** Connection settings used by the Docker-backed runner. */
export type DockerConnectionConfig = {
  readonly dockerOptions?: Dockerode.DockerOptions;
  readonly dockerSocketPath?: string;
};

/** Inputs passed from the verifier to a build runner. */
export type ContractBuildRunnerInput = {
  readonly sourceDirectory: string;
  readonly recipe: ContractBuildRecipe;
  readonly allowNetwork: boolean;
  readonly limits: BuildVerificationLimits;
};

/** Successful build-runner output. Failed builds throw typed errors. */
export type ContractBuildRunnerOutput = {
  readonly wasm: Uint8Array;
  readonly artifactPath: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
};

/** Pluggable execution boundary for rebuilding a contract. */
export interface ContractBuildRunner {
  /** Runs one isolated build and returns the unambiguous rebuilt wasm. */
  run(input: ContractBuildRunnerInput): Promise<ContractBuildRunnerOutput>;
}

/** Options shared by reusable and one-shot verifier APIs. */
export type ContractBuildVerifierOptions = {
  readonly network?: VerificationNetwork;
  readonly runner?: ContractBuildRunner;
  readonly imagePolicy?: ContainerImagePolicy;
  readonly allowBuildNetwork?: boolean;
  readonly limits?: Partial<BuildVerificationLimits>;
  readonly fetch?: typeof globalThis.fetch;
};

/** Arguments for strict metadata-driven SEP-58 verification. */
export type StrictVerificationInput = {
  readonly mode?: "strictSep58";
  readonly target: VerificationTarget;
  readonly source?: VerificationSource;
};

/** Arguments for explicitly caller-directed, out-of-band verification. */
export type OutOfBandVerificationInput = {
  readonly mode: "outOfBand";
  readonly target: VerificationTarget;
  readonly source: VerificationSource;
  readonly recipe: OutOfBandBuildRecipe;
};

/** All supported contract build-verification inputs. */
export type ContractBuildVerificationInput =
  | StrictVerificationInput
  | OutOfBandVerificationInput;

/** Serializable evidence retained for every completed comparison. */
export type ContractBuildVerificationEvidence = {
  readonly mode: "strictSep58" | "outOfBand";
  readonly recipeProvenance: "onChainSep58Metadata" | "callerSupplied";
  readonly network?: {
    readonly networkPassphrase: string;
    readonly rpcUrl?: string;
  };
  readonly target: {
    readonly kind: "wasm" | "wasmHash" | "contractId";
    readonly label?: string;
    readonly contractId?: string;
    readonly wasmHash: string;
    readonly lastModifiedLedgerSeq?: number;
  };
  readonly source: {
    readonly kind: VerificationSource["type"] | "metadataUrl";
    readonly locator?: string;
    readonly sha256?: string;
  };
  readonly build: {
    readonly image: string;
    readonly arguments: readonly string[];
    readonly options: readonly string[];
    readonly networkEnabled: boolean;
    readonly artifactPath: string;
    readonly rebuiltWasmHash: string;
    readonly durationMs: number;
    readonly stdout: string;
    readonly stderr: string;
  };
  readonly observedAt: string;
};

/** Result returned after a complete byte comparison, or when SEP-58 is inapplicable. */
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
  };
