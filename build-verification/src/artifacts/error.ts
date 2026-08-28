import { BuildVerificationError, Code } from "../error/base.ts";

/** Raised when a successful build produces no eligible Wasm. */
export class BuildArtifactNotFoundError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_NOT_FOUND> {
  /** Creates a missing artifact error. */
  constructor() {
    super({
      code: Code.BUILD_ARTIFACT_NOT_FOUND,
      source: "@colibri/build-verification/artifacts/select",
      message: "Build artifact not found",
      details:
        "The successful build produced no eligible contract Wasm candidate.",
    });
  }
}

/** Raised when artifact selection would require guessing. */
export class BuildArtifactAmbiguousError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_AMBIGUOUS> {
  /** Creates an ambiguous artifact error. */
  constructor(paths: readonly string[]) {
    super({
      code: Code.BUILD_ARTIFACT_AMBIGUOUS,
      source: "@colibri/build-verification/artifacts/select",
      message: "Build artifact is ambiguous",
      details: "More than one candidate matches the exact recipe expectation.",
      data: { paths },
    });
  }
}

/** Raised when one candidate Wasm cannot be read. */
export class BuildArtifactReadFailedError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_READ_FAILED> {
  /** Creates an artifact-read error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.BUILD_ARTIFACT_READ_FAILED,
      source: "@colibri/build-verification/artifacts/collect",
      message: "Failed to read build artifact",
      details: "A rebuilt Wasm candidate could not be read before cleanup.",
      data: { path },
      cause,
    });
  }
}

/** Compatibility error for pre-build artifact inventory failures. */
export class BuildArtifactSnapshotFailedError
  extends BuildVerificationError<Code.BUILD_ARTIFACT_SNAPSHOT_FAILED> {
  /** Creates an artifact snapshot error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.BUILD_ARTIFACT_SNAPSHOT_FAILED,
      source: "@colibri/build-verification/artifacts/collect",
      message: "Failed to snapshot preexisting build artifacts",
      details: "Existing candidate files could not be inventoried.",
      data: { path },
      cause,
    });
  }
}

/** Raised when a candidate exceeds the configured artifact byte limit. */
export class ArtifactLimitExceededError
  extends BuildVerificationError<Code.ARTIFACT_LIMIT_EXCEEDED> {
  /** Creates an artifact size-limit error. */
  constructor(path: string, actual: number, maximum: number) {
    super({
      code: Code.ARTIFACT_LIMIT_EXCEEDED,
      source: "@colibri/build-verification/artifacts/collect",
      message: "Build artifact limit exceeded",
      details:
        "A Wasm candidate exceeds the configured in-memory artifact limit.",
      data: { path, actual, maximum },
    });
  }
}

/** Raised when a candidate path is outside the supported release layout. */
export class UnsafeArtifactPathError
  extends BuildVerificationError<Code.UNSAFE_ARTIFACT_PATH> {
  /** Creates an unsafe artifact-path error. */
  constructor(path: string) {
    super({
      code: Code.UNSAFE_ARTIFACT_PATH,
      source: "@colibri/build-verification/artifacts/collect",
      message: "Unsafe build artifact path",
      details:
        "A candidate path escapes or violates the expected release layout.",
      data: { path },
    });
  }
}

/** Raised when candidate traversal fails before cleanup. */
export class ArtifactCollectionFailedError
  extends BuildVerificationError<Code.ARTIFACT_COLLECTION_FAILED> {
  /** Creates an artifact-collection traversal error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.ARTIFACT_COLLECTION_FAILED,
      source: "@colibri/build-verification/artifacts/collect",
      message: "Failed to collect build artifacts",
      details: "The candidate output tree could not be traversed safely.",
      data: { path },
      cause,
    });
  }
}
