import { ColibriError } from "@colibri/core";
import type { Diagnostic } from "@colibri/core";
import type {
  ContractBuildVerificationEvidence,
  VerificationLogEvent,
} from "../core/types/result.ts";

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
  TARGET_HASH_MISMATCH = "BLDV_049",
  TARGET_INSTANCE_LOOKUP_FAILED = "BLDV_050",
  TARGET_CODE_LOOKUP_FAILED = "BLDV_051",
  TARGET_PROVIDER_UNEXPECTED = "BLDV_052",
  COMMAND_POLICY_REJECTED = "BLDV_053",
  OPTION_POLICY_REJECTED = "BLDV_054",
  SOURCE_POLICY_REJECTED = "BLDV_055",
  SOURCE_REDIRECT_LIMIT_EXCEEDED = "BLDV_056",
  SOURCE_DNS_RESOLUTION_FAILED = "BLDV_057",
  SOURCE_REQUEST_TIMED_OUT = "BLDV_058",
  GITHUB_REVISION_RESOLUTION_FAILED = "BLDV_059",
  GITHUB_RELEASE_ASSET_RESOLUTION_FAILED = "BLDV_060",
  ZIP_DECODING_FAILED = "BLDV_061",
  DUPLICATE_ARCHIVE_ENTRY = "BLDV_062",
  ARCHIVE_ENTRY_TYPE_CONFLICT = "BLDV_063",
  WORKSPACE_INITIALIZATION_FAILED = "BLDV_064",
  SOURCE_DIRECTORY_COPY_FAILED = "BLDV_065",
  ARTIFACT_LIMIT_EXCEEDED = "BLDV_066",
  UNSAFE_ARTIFACT_PATH = "BLDV_067",
  IMAGE_CONFIG_RESOLUTION_FAILED = "BLDV_068",
  IMAGE_REFERRERS_RESOLUTION_FAILED = "BLDV_069",
  IMAGE_ATTESTATION_DECODING_FAILED = "BLDV_070",
  IMAGE_TOOLCHAIN_MISSING = "BLDV_071",
  RUNTIME_IMAGE_DIGEST_MISMATCH = "BLDV_072",
  LOG_WRITE_FAILED = "BLDV_073",
  LOGGER_FAILED = "BLDV_074",
  PIPELINE_CONSTRUCTION_FAILED = "BLDV_075",
  PROCESS_DEPENDENCY_MISSING = "BLDV_076",
  RESOLVE_TARGET_UNEXPECTED = "BLDV_077",
  PARSE_METADATA_UNEXPECTED = "BLDV_078",
  VALIDATE_RECIPE_UNEXPECTED = "BLDV_079",
  RESOLVE_SOURCE_UNEXPECTED = "BLDV_080",
  RESOLVE_IMAGE_UNEXPECTED = "BLDV_081",
  EXECUTE_BUILD_UNEXPECTED = "BLDV_082",
  SELECT_ARTIFACT_UNEXPECTED = "BLDV_083",
  COMPARE_WASM_UNEXPECTED = "BLDV_084",
  SOURCE_RESPONSE_READ_FAILED = "BLDV_085",
  WORKSPACE_CLEANUP_FAILED = "BLDV_086",
  ARTIFACT_COLLECTION_FAILED = "BLDV_087",
  BUILD_PLAN_INVALID = "BLDV_088",
  IMAGE_MANIFEST_DIGEST_MISMATCH = "BLDV_089",
  IMAGE_CONFIG_DIGEST_MISMATCH = "BLDV_090",
  IMAGE_REFERRER_DIGEST_MISMATCH = "BLDV_091",
  SOURCE_REDIRECT_LOCATION_MISSING = "BLDV_092",
  INVALID_VERIFICATION_INPUT = "BLDV_093",
  PIPELINE_STEP_OUTPUT_MISSING = "BLDV_094",
  BUILD_RUNNER_UNEXPECTED = "BLDV_095",
  ARCHIVE_CRC_MISMATCH = "BLDV_096",
  UNSUPPORTED_ZIP_FEATURE = "BLDV_097",
}

/** Structured metadata retained by every build-verification error. */
export type BuildVerificationErrorMeta = {
  readonly cause: unknown;
  readonly data: Readonly<Record<string, unknown>>;
};

/**
 * Exact Core diagnostic shape retained without re-exporting Core.
 * @internal
 */
export type BuildVerificationDiagnostic = Diagnostic;

/** Construction payload shared by typed build-verification errors. */
export type BuildVerificationErrorShape<C extends Code> = {
  readonly code: C;
  readonly message: string;
  readonly details: string;
  readonly source?: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly diagnostic?: BuildVerificationDiagnostic;
};

/**
 * Core error base retained without re-exporting Core.
 * @internal
 */
export abstract class BuildVerificationErrorBase<C extends Code = Code>
  extends ColibriError<C, BuildVerificationErrorMeta> {}

/** Base class for all errors from `@colibri/build-verification`. */
export abstract class BuildVerificationError<C extends Code = Code>
  extends BuildVerificationErrorBase<C> {
  /** Creates a typed verifier-domain error with a precise owner source. */
  constructor(shape: BuildVerificationErrorShape<C>) {
    super({
      domain: "verifiers",
      source: shape.source ?? "@colibri/build-verification",
      code: shape.code,
      message: shape.message,
      details: shape.details,
      diagnostic: shape.diagnostic,
      meta: { cause: shape.cause, data: shape.data ?? {} },
    });
  }
}

/** Adds bounded process context to an existing typed package error. */
export const attachBuildVerificationErrorContext = <
  ErrorType extends BuildVerificationError,
>(
  error: ErrorType,
  context: {
    readonly input?: unknown;
    readonly evidence?: ContractBuildVerificationEvidence;
    readonly logs?: readonly VerificationLogEvent[];
  },
): ErrorType => {
  const data = {
    ...error.meta?.data,
    ...(context.input === undefined ? {} : { input: context.input }),
    ...(context.evidence === undefined ? {} : { evidence: context.evidence }),
    ...(context.logs === undefined ? {} : { logs: context.logs }),
  };
  Object.defineProperty(error, "meta", {
    configurable: true,
    enumerable: true,
    value: { cause: error.meta?.cause, data },
    writable: false,
  });
  return error;
};
