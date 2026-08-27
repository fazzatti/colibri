import { ColibriError } from "@colibri/core";
import type { Diagnostic } from "@colibri/core";

/** @internal Exact Core diagnostic shape retained without re-exporting Core. */
export type BuildVerificationDiagnostic = Diagnostic;

/** Structured metadata retained by build-verification errors. */
export type BuildVerificationErrorMeta = {
  readonly cause: unknown;
  readonly data: Readonly<Record<string, unknown>>;
};

/** Stable codes emitted by `@colibri/build-verification`. */
export enum Code {
  INVALID_VERIFIER_OPTIONS = "BLDV_000",
  MISSING_TARGET_NETWORK = "BLDV_001",
  TARGET_RESOLUTION_FAILED = "BLDV_002",
  INVALID_TARGET_WASM = "BLDV_003",
  METADATA_DECODING_FAILED = "BLDV_004",
  DUPLICATE_SEP58_METADATA = "BLDV_005",
  INVALID_SEP58_METADATA = "BLDV_006",
  MISSING_OUT_OF_BAND_RECIPE = "BLDV_007",
  MISSING_VERIFICATION_SOURCE = "BLDV_008",
  SOURCE_DOWNLOAD_FAILED = "BLDV_009",
  SOURCE_HASH_MISMATCH = "BLDV_010",
  UNSUPPORTED_SOURCE = "BLDV_011",
  UNSUPPORTED_ARCHIVE = "BLDV_012",
  UNSAFE_ARCHIVE_ENTRY = "BLDV_013",
  ARCHIVE_LIMIT_EXCEEDED = "BLDV_014",
  INVALID_ARCHIVE_TOPOLOGY = "BLDV_015",
  INVALID_IMAGE_REFERENCE = "BLDV_016",
  IMAGE_POLICY_REJECTED = "BLDV_017",
  IMAGE_MANIFEST_RESOLUTION_FAILED = "BLDV_018",
  MULTI_ARCH_IMAGE = "BLDV_019",
  DOCKER_CONFIGURATION_FAILED = "BLDV_020",
  DOCKER_UNAVAILABLE = "BLDV_021",
  IMAGE_PULL_FAILED = "BLDV_022",
  IMAGE_RUNTIME_MISMATCH = "BLDV_023",
  BUILD_TIMED_OUT = "BLDV_024",
  BUILD_COMMAND_FAILED = "BLDV_025",
  BUILD_LOG_COLLECTION_FAILED = "BLDV_026",
  BUILD_ARTIFACT_NOT_FOUND = "BLDV_027",
  BUILD_ARTIFACT_AMBIGUOUS = "BLDV_028",
  BUILD_ARTIFACT_READ_FAILED = "BLDV_029",
  EVIDENCE_WRITE_FAILED = "BLDV_030",
  INVALID_CLI_ARGUMENTS = "BLDV_031",
  IMAGE_PULL_STREAM_MISSING = "BLDV_032",
  IMAGE_PULL_PROGRESS_FAILED = "BLDV_033",
  IMAGE_INSPECTION_FAILED = "BLDV_034",
  BUILD_ARTIFACT_SNAPSHOT_FAILED = "BLDV_035",
  CONTAINER_CREATION_FAILED = "BLDV_036",
  CONTAINER_START_FAILED = "BLDV_037",
  CONTAINER_WAIT_FAILED = "BLDV_038",
  CONTAINER_KILL_FAILED = "BLDV_039",
  CONTAINER_LOGS_FAILED = "BLDV_040",
  CONTAINER_CLEANUP_FAILED = "BLDV_041",
  TARGET_RPC_INITIALIZATION_FAILED = "BLDV_042",
  ARCHIVE_DECODING_FAILED = "BLDV_043",
  SOURCE_EXTRACTION_INITIALIZATION_FAILED = "BLDV_044",
  SOURCE_EXTRACTION_FAILED = "BLDV_045",
  SOURCE_EXTRACTION_CLEANUP_FAILED = "BLDV_046",
  LOCAL_SOURCE_ARCHIVE_READ_FAILED = "BLDV_047",
  SOURCE_CLEANUP_FAILED = "BLDV_048",
}

/** Construction payload for one typed build-verification error. */
export type BuildVerificationErrorShape<C extends Code> = {
  readonly code: C;
  readonly message: string;
  readonly details: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly diagnostic?: BuildVerificationDiagnostic;
};

/** @internal Core error base retained without re-exporting Core. */
export class BuildVerificationErrorBase<C extends Code>
  extends ColibriError<C, BuildVerificationErrorMeta> {}

/** Base class for errors from `@colibri/build-verification`. */
export abstract class BuildVerificationError<C extends Code>
  extends BuildVerificationErrorBase<C> {
  /** Creates a typed build-verification error. */
  constructor(shape: BuildVerificationErrorShape<C>) {
    super({
      domain: "verifiers",
      source: "@colibri/build-verification",
      code: shape.code,
      message: shape.message,
      details: shape.details,
      diagnostic: shape.diagnostic,
      meta: { cause: shape.cause, data: shape.data ?? {} },
    });
  }
}

/** Raised when mutually exclusive or invalid verifier options are supplied. */
export class InvalidVerifierOptionsError
  extends BuildVerificationError<Code.INVALID_VERIFIER_OPTIONS> {
  /** Creates the error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.INVALID_VERIFIER_OPTIONS,
      message: "Invalid verifier options",
      details,
      data,
    });
  }
}

/** Raised when a network-backed target is used without network configuration. */
export class MissingTargetNetworkError
  extends BuildVerificationError<Code.MISSING_TARGET_NETWORK> {
  /** Creates the error. */
  constructor() {
    super({
      code: Code.MISSING_TARGET_NETWORK,
      message: "Missing target network",
      details:
        "A contract id or wasm hash target requires a Colibri network config, an RPC client, or an RPC URL with network passphrase.",
    });
  }
}

/** Raised when Stellar RPC cannot resolve the requested target. */
export class TargetResolutionFailedError
  extends BuildVerificationError<Code.TARGET_RESOLUTION_FAILED> {
  /** Creates the error. */
  constructor(target: string, cause: unknown) {
    super({
      code: Code.TARGET_RESOLUTION_FAILED,
      message: "Failed to resolve verification target",
      details:
        "The requested contract instance or contract code could not be read from Stellar RPC.",
      data: { target },
      cause,
    });
  }
}

/** Raised when the configured network cannot create a target RPC reader. */
export class TargetRpcInitializationFailedError
  extends BuildVerificationError<Code.TARGET_RPC_INITIALIZATION_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.TARGET_RPC_INITIALIZATION_FAILED,
      message: "Failed to initialize target RPC",
      details:
        "The supplied Colibri network configuration or granular RPC inputs could not initialize a target ledger reader.",
      cause,
    });
  }
}

/** Raised when target bytes are not a valid WebAssembly module. */
export class InvalidTargetWasmError
  extends BuildVerificationError<Code.INVALID_TARGET_WASM> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.INVALID_TARGET_WASM,
      message: "Invalid target wasm",
      details: "The target bytes could not be decoded as a WebAssembly module.",
      cause,
    });
  }
}

/** Raised when a `contractmetav0` section contains malformed XDR. */
export class MetadataDecodingFailedError
  extends BuildVerificationError<Code.METADATA_DECODING_FAILED> {
  /** Creates the error. */
  constructor(section: number, cause: unknown) {
    super({
      code: Code.METADATA_DECODING_FAILED,
      message: "Failed to decode contract metadata",
      details:
        "A contractmetav0 custom section did not contain a valid sequence of SCMetaEntry XDR values.",
      data: { section },
      cause,
    });
  }
}

/** Raised when a scalar SEP-58 metadata key appears more than once. */
export class DuplicateSep58MetadataError
  extends BuildVerificationError<Code.DUPLICATE_SEP58_METADATA> {
  /** Creates the error. */
  constructor(key: string) {
    super({
      code: Code.DUPLICATE_SEP58_METADATA,
      message: "Duplicate SEP-58 metadata",
      details:
        `The scalar SEP-58 metadata key "${key}" must occur exactly once.`,
      data: { key },
    });
  }
}

/** Raised when authoritative SEP-58 metadata has an invalid value. */
export class InvalidSep58MetadataError
  extends BuildVerificationError<Code.INVALID_SEP58_METADATA> {
  /** Creates the error. */
  constructor(key: string, value: unknown, reason: string) {
    super({
      code: Code.INVALID_SEP58_METADATA,
      message: "Invalid SEP-58 metadata",
      details: reason,
      data: { key, value },
    });
  }
}

/** Raised when out-of-band mode has no explicit recipe. */
export class MissingOutOfBandRecipeError
  extends BuildVerificationError<Code.MISSING_OUT_OF_BAND_RECIPE> {
  /** Creates the error. */
  constructor() {
    super({
      code: Code.MISSING_OUT_OF_BAND_RECIPE,
      message: "Missing out-of-band build recipe",
      details:
        "Out-of-band verification requires a caller-supplied image and build recipe.",
    });
  }
}

/** Raised when no source can be derived or was supplied. */
export class MissingVerificationSourceError
  extends BuildVerificationError<Code.MISSING_VERIFICATION_SOURCE> {
  /** Creates the error. */
  constructor() {
    super({
      code: Code.MISSING_VERIFICATION_SOURCE,
      message: "Missing verification source",
      details:
        "Provide a source archive, path, URL, or GitHub reference, or include source_uri in strict SEP-58 metadata.",
    });
  }
}

/** Raised when source bytes cannot be downloaded. */
export class SourceDownloadFailedError
  extends BuildVerificationError<Code.SOURCE_DOWNLOAD_FAILED> {
  /** Creates the error. */
  constructor(url: string, cause: unknown, status?: number) {
    super({
      code: Code.SOURCE_DOWNLOAD_FAILED,
      message: "Failed to download verification source",
      details:
        "The source URL could not be fetched within the configured size boundary.",
      data: { url, status },
      cause,
    });
  }
}

/** Raised when source archive bytes do not match the expected SHA-256. */
export class SourceHashMismatchError
  extends BuildVerificationError<Code.SOURCE_HASH_MISMATCH> {
  /** Creates the error. */
  constructor(expected: string, actual: string) {
    super({
      code: Code.SOURCE_HASH_MISMATCH,
      message: "Source archive hash mismatch",
      details:
        "The supplied or downloaded source archive is not the archive committed to by the build recipe.",
      data: { expected, actual },
    });
  }
}

/** Raised for a source form that cannot be used in the selected mode. */
export class UnsupportedSourceError
  extends BuildVerificationError<Code.UNSUPPORTED_SOURCE> {
  /** Creates the error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.UNSUPPORTED_SOURCE,
      message: "Unsupported verification source",
      details,
      data,
    });
  }
}

/** Raised when an archive extension or encoding is unsupported. */
export class UnsupportedArchiveError
  extends BuildVerificationError<Code.UNSUPPORTED_ARCHIVE> {
  /** Creates the error. */
  constructor(name: string) {
    super({
      code: Code.UNSUPPORTED_ARCHIVE,
      message: "Unsupported source archive",
      details: "Supported source archives are .tar, .tar.gz, and .tgz files.",
      data: { name },
    });
  }
}

/** Raised when a supported archive encoding is corrupt or cannot be decoded. */
export class ArchiveDecodingFailedError
  extends BuildVerificationError<Code.ARCHIVE_DECODING_FAILED> {
  /** Creates the error. */
  constructor(name: string, cause: unknown) {
    super({
      code: Code.ARCHIVE_DECODING_FAILED,
      message: "Failed to decode source archive",
      details:
        "The source uses a supported archive extension, but its encoded contents could not be decoded safely.",
      data: { name },
      cause,
    });
  }
}

/** Raised when a temporary extraction boundary cannot be created. */
export class SourceExtractionInitializationFailedError
  extends BuildVerificationError<Code.SOURCE_EXTRACTION_INITIALIZATION_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.SOURCE_EXTRACTION_INITIALIZATION_FAILED,
      message: "Failed to initialize source extraction",
      details:
        "Colibri could not create the temporary directory required for isolated source extraction.",
      cause,
    });
  }
}

/** Raised when validated archive entries cannot be materialized. */
export class SourceExtractionFailedError
  extends BuildVerificationError<Code.SOURCE_EXTRACTION_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.SOURCE_EXTRACTION_FAILED,
      message: "Failed to extract source archive",
      details:
        "A validated source archive entry could not be written into the temporary extraction boundary.",
      cause,
    });
  }
}

/** Raised when cleanup after a failed extraction also fails. */
export class SourceExtractionCleanupFailedError
  extends BuildVerificationError<Code.SOURCE_EXTRACTION_CLEANUP_FAILED> {
  /** Creates the error. */
  constructor(extractionCause: unknown, cleanupCause: unknown) {
    super({
      code: Code.SOURCE_EXTRACTION_CLEANUP_FAILED,
      message: "Failed to clean partial source extraction",
      details:
        "Source extraction failed and Colibri could not remove the partially materialized temporary tree.",
      cause: cleanupCause,
      data: { extractionCause: String(extractionCause) },
    });
  }
}

/** Raised when an existing local source archive cannot be read. */
export class LocalSourceArchiveReadFailedError
  extends BuildVerificationError<Code.LOCAL_SOURCE_ARCHIVE_READ_FAILED> {
  /** Creates the error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.LOCAL_SOURCE_ARCHIVE_READ_FAILED,
      message: "Failed to read local source archive",
      details:
        "The selected local source path exists but its archive bytes could not be read.",
      data: { path },
      cause,
    });
  }
}

/** Raised when a prepared source tree cannot be removed after verification. */
export class SourceCleanupFailedError
  extends BuildVerificationError<Code.SOURCE_CLEANUP_FAILED> {
  /** Creates the error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.SOURCE_CLEANUP_FAILED,
      message: "Failed to clean prepared verification source",
      details:
        "The verification completed or failed, but Colibri could not remove its temporary extracted source tree.",
      data: { path },
      cause,
    });
  }
}

/** Raised when an archive entry could escape or mutate extraction boundaries. */
export class UnsafeArchiveEntryError
  extends BuildVerificationError<Code.UNSAFE_ARCHIVE_ENTRY> {
  /** Creates the error. */
  constructor(path: string, reason: string) {
    super({
      code: Code.UNSAFE_ARCHIVE_ENTRY,
      message: "Unsafe source archive entry",
      details: reason,
      data: { path },
    });
  }
}

/** Raised when an archive exceeds a configured ingestion limit. */
export class ArchiveLimitExceededError
  extends BuildVerificationError<Code.ARCHIVE_LIMIT_EXCEEDED> {
  /** Creates the error. */
  constructor(limit: string, actual: number, maximum: number) {
    super({
      code: Code.ARCHIVE_LIMIT_EXCEEDED,
      message: "Source archive limit exceeded",
      details: `The archive exceeded the configured ${limit} limit.`,
      data: { limit, actual, maximum },
    });
  }
}

/** Raised when a source archive does not contain exactly one top-level directory. */
export class InvalidArchiveTopologyError
  extends BuildVerificationError<Code.INVALID_ARCHIVE_TOPOLOGY> {
  /** Creates the error. */
  constructor(entries: readonly string[]) {
    super({
      code: Code.INVALID_ARCHIVE_TOPOLOGY,
      message: "Invalid source archive topology",
      details:
        "A SEP-58 source archive must contain exactly one top-level directory and no top-level files.",
      data: { entries },
    });
  }
}

/** Raised when a build image is not a fully qualified digest reference. */
export class InvalidImageReferenceError
  extends BuildVerificationError<Code.INVALID_IMAGE_REFERENCE> {
  /** Creates the error. */
  constructor(reference: string) {
    super({
      code: Code.INVALID_IMAGE_REFERENCE,
      message: "Invalid build image reference",
      details:
        "SEP-58 build images must use an explicit registry and a sha256 digest.",
      data: { reference },
    });
  }
}

/** Raised when a configured policy declines an otherwise valid image. */
export class ImagePolicyRejectedError
  extends BuildVerificationError<Code.IMAGE_POLICY_REJECTED> {
  /** Creates the error. */
  constructor(reference: string, reason: string) {
    super({
      code: Code.IMAGE_POLICY_REJECTED,
      message: "Build image rejected by policy",
      details: reason,
      data: { reference },
    });
  }
}

/** Raised when the pinned OCI manifest cannot be resolved. */
export class ImageManifestResolutionFailedError
  extends BuildVerificationError<Code.IMAGE_MANIFEST_RESOLUTION_FAILED> {
  /** Creates the error. */
  constructor(reference: string, cause: unknown, status?: number) {
    super({
      code: Code.IMAGE_MANIFEST_RESOLUTION_FAILED,
      message: "Failed to resolve build image manifest",
      details:
        "The registry did not return the pinned OCI/Docker manifest needed for image-policy evaluation.",
      data: { reference, status },
      cause,
    });
  }
}

/** Raised when a digest points to a multi-platform image index. */
export class MultiArchImageError
  extends BuildVerificationError<Code.MULTI_ARCH_IMAGE> {
  /** Creates the error. */
  constructor(reference: string, mediaType: string) {
    super({
      code: Code.MULTI_ARCH_IMAGE,
      message: "Multi-architecture image is not reproducible",
      details:
        "SEP-58 requires bldimg to identify one concrete platform manifest rather than an image index.",
      data: { reference, mediaType },
    });
  }
}

/** Raised when Docker connection settings are invalid or ambiguous. */
export class DockerConfigurationFailedError
  extends BuildVerificationError<Code.DOCKER_CONFIGURATION_FAILED> {
  /** Creates the error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.DOCKER_CONFIGURATION_FAILED,
      message: "Invalid Docker configuration",
      details,
      data,
    });
  }
}

/** Raised when the configured Docker daemon cannot be reached. */
export class DockerUnavailableError
  extends BuildVerificationError<Code.DOCKER_UNAVAILABLE> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.DOCKER_UNAVAILABLE,
      message: "Docker is unavailable",
      details:
        "The build runner could not communicate with the configured Docker daemon.",
      cause,
    });
  }
}

/** Raised when Docker cannot pull the exact pinned build image. */
export class ImagePullFailedError
  extends BuildVerificationError<Code.IMAGE_PULL_FAILED> {
  /** Creates the error. */
  constructor(reference: string, cause: unknown) {
    super({
      code: Code.IMAGE_PULL_FAILED,
      message: "Failed to pull build image",
      details: "Docker could not pull the exact digest-pinned build image.",
      data: { reference },
      cause,
    });
  }
}

/** Raised when Docker accepts a pull request but returns no progress stream. */
export class ImagePullStreamMissingError
  extends BuildVerificationError<Code.IMAGE_PULL_STREAM_MISSING> {
  /** Creates the error. */
  constructor(reference: string) {
    super({
      code: Code.IMAGE_PULL_STREAM_MISSING,
      message: "Build image pull stream is missing",
      details:
        "Docker accepted the image pull request but did not provide the progress stream required to confirm completion.",
      data: { reference },
    });
  }
}

/** Raised when Docker reports a failure while following image-pull progress. */
export class ImagePullProgressFailedError
  extends BuildVerificationError<Code.IMAGE_PULL_PROGRESS_FAILED> {
  /** Creates the error. */
  constructor(reference: string, cause: unknown) {
    super({
      code: Code.IMAGE_PULL_PROGRESS_FAILED,
      message: "Build image pull did not complete",
      details:
        "Docker reported an error while consuming the exact image pull progress stream.",
      data: { reference },
      cause,
    });
  }
}

/** Raised when a pulled image cannot be inspected. */
export class ImageInspectionFailedError
  extends BuildVerificationError<Code.IMAGE_INSPECTION_FAILED> {
  /** Creates the error. */
  constructor(reference: string, cause: unknown) {
    super({
      code: Code.IMAGE_INSPECTION_FAILED,
      message: "Failed to inspect build image",
      details:
        "Docker pulled the image but could not return the runtime configuration required by SEP-58.",
      data: { reference },
      cause,
    });
  }
}

/** Raised when the image entrypoint or work directory violates SEP-58. */
export class ImageRuntimeMismatchError
  extends BuildVerificationError<Code.IMAGE_RUNTIME_MISMATCH> {
  /** Creates the error. */
  constructor(
    reference: string,
    entrypoint: readonly string[] | string | null | undefined,
    workingDir: string | null,
  ) {
    super({
      code: Code.IMAGE_RUNTIME_MISMATCH,
      message: "Build image runtime does not match SEP-58",
      details:
        "The image must use `stellar` as its entrypoint and `/source` as its working directory.",
      data: { reference, entrypoint, workingDir },
    });
  }
}

/** Raised when a contract build exceeds its configured wall-clock limit. */
export class BuildTimedOutError
  extends BuildVerificationError<Code.BUILD_TIMED_OUT> {
  /** Creates the error. */
  constructor(timeoutMs: number, stdout: string, stderr: string) {
    super({
      code: Code.BUILD_TIMED_OUT,
      message: "Contract build timed out",
      details:
        "The isolated build exceeded its configured timeout and was terminated.",
      data: { timeoutMs, stdout, stderr },
    });
  }
}

/** Raised when the build command exits unsuccessfully. */
export class BuildCommandFailedError
  extends BuildVerificationError<Code.BUILD_COMMAND_FAILED> {
  /** Creates the error. */
  constructor(exitCode: number, stdout: string, stderr: string) {
    super({
      code: Code.BUILD_COMMAND_FAILED,
      message: "Contract build failed",
      details: "The pinned build image completed with a non-zero exit code.",
      data: { exitCode, stdout, stderr },
    });
  }
}

/** Raised when the runner cannot collect bounded container output. */
export class BuildLogCollectionFailedError
  extends BuildVerificationError<Code.BUILD_LOG_COLLECTION_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.BUILD_LOG_COLLECTION_FAILED,
      message: "Failed to collect build logs",
      details:
        "The Docker output stream could not be decoded and bounded for evidence collection.",
      cause,
    });
  }
}

/** Raised when a successful build produces no eligible release wasm. */
export class BuildArtifactNotFoundError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_NOT_FOUND> {
  /** Creates the error. */
  constructor() {
    super({
      code: Code.BUILD_ARTIFACT_NOT_FOUND,
      message: "Build artifact not found",
      details:
        "The successful build did not produce a new or changed wasm in a supported Cargo release directory.",
    });
  }
}

/** Raised when artifact selection would require guessing. */
export class BuildArtifactAmbiguousError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_AMBIGUOUS> {
  /** Creates the error. */
  constructor(paths: readonly string[]) {
    super({
      code: Code.BUILD_ARTIFACT_AMBIGUOUS,
      message: "Build artifact is ambiguous",
      details:
        "More than one eligible wasm was produced and the build recipe did not identify one unambiguously.",
      data: { paths },
    });
  }
}

/** Raised when the selected rebuilt wasm cannot be read. */
export class BuildArtifactReadFailedError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_READ_FAILED> {
  /** Creates the error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.BUILD_ARTIFACT_READ_FAILED,
      message: "Failed to read build artifact",
      details:
        "The selected rebuilt wasm could not be read after the container exited.",
      data: { path },
      cause,
    });
  }
}

/** Raised when preexisting wasm artifacts cannot be inventoried before a build. */
export class BuildArtifactSnapshotFailedError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_SNAPSHOT_FAILED> {
  /** Creates the error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.BUILD_ARTIFACT_SNAPSHOT_FAILED,
      message: "Failed to snapshot preexisting build artifacts",
      details:
        "The runner could not inventory existing eligible wasm files before starting the container.",
      data: { path },
      cause,
    });
  }
}

/** Raised when Docker cannot create the isolated build container. */
export class ContainerCreationFailedError
  extends BuildVerificationError<Code.CONTAINER_CREATION_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_CREATION_FAILED,
      message: "Failed to create build container",
      details:
        "Docker rejected or could not materialize the isolated contract build configuration.",
      cause,
    });
  }
}

/** Raised when a created build container cannot be started. */
export class ContainerStartFailedError
  extends BuildVerificationError<Code.CONTAINER_START_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_START_FAILED,
      message: "Failed to start build container",
      details:
        "Docker created the contract build container but could not start it.",
      cause,
    });
  }
}

/** Raised when Docker cannot report the running container's terminal status. */
export class ContainerWaitFailedError
  extends BuildVerificationError<Code.CONTAINER_WAIT_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_WAIT_FAILED,
      message: "Failed while waiting for build container",
      details:
        "Docker could not report a terminal status for the running contract build.",
      cause,
    });
  }
}

/** Raised when a timed-out build container cannot be terminated. */
export class ContainerKillFailedError
  extends BuildVerificationError<Code.CONTAINER_KILL_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_KILL_FAILED,
      message: "Failed to terminate timed-out build container",
      details:
        "Docker did not terminate the build container after the configured timeout elapsed.",
      cause,
    });
  }
}

/** Raised when Docker cannot return completed build logs. */
export class ContainerLogsFailedError
  extends BuildVerificationError<Code.CONTAINER_LOGS_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_LOGS_FAILED,
      message: "Failed to read build container logs",
      details:
        "Docker could not return the completed container output needed for diagnostics and evidence.",
      cause,
    });
  }
}

/** Raised when a completed build container cannot be removed. */
export class ContainerCleanupFailedError
  extends BuildVerificationError<Code.CONTAINER_CLEANUP_FAILED> {
  /** Creates the error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_CLEANUP_FAILED,
      message: "Failed to remove build container",
      details:
        "Docker could not remove the disposable build container after execution completed.",
      cause,
    });
  }
}

/** Raised when verification evidence cannot be exported. */
export class EvidenceWriteFailedError
  extends BuildVerificationError<Code.EVIDENCE_WRITE_FAILED> {
  /** Creates the error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.EVIDENCE_WRITE_FAILED,
      message: "Failed to write verification evidence",
      details:
        "The completed verification evidence could not be serialized to the requested file.",
      data: { path },
      cause,
    });
  }
}

/** Raised when CLI flags are missing, conflicting, or malformed. */
export class InvalidCliArgumentsError
  extends BuildVerificationError<Code.INVALID_CLI_ARGUMENTS> {
  /** Creates the error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.INVALID_CLI_ARGUMENTS,
      message: "Invalid command-line arguments",
      details,
      data,
    });
  }
}
