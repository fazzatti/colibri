import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when Docker connection settings are invalid or ambiguous. */
export class DockerConfigurationFailedError
  extends BuildVerificationError<Code.DOCKER_CONFIGURATION_FAILED> {
  /** Creates a Docker configuration error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.DOCKER_CONFIGURATION_FAILED,
      source: "@colibri/build-verification/runners/docker/connection",
      message: "Invalid Docker configuration",
      details,
      data,
    });
  }
}

/** Raised when the configured Docker daemon cannot be reached. */
export class DockerUnavailableError
  extends BuildVerificationError<Code.DOCKER_UNAVAILABLE> {
  /** Creates a Docker-unavailable error. */
  constructor(cause: unknown) {
    super({
      code: Code.DOCKER_UNAVAILABLE,
      source: "@colibri/build-verification/runners/docker",
      message: "Docker is unavailable",
      details: "The build runner could not communicate with the Docker daemon.",
      cause,
    });
  }
}

/** Raised when Docker cannot pull the exact pinned image. */
export class ImagePullFailedError
  extends BuildVerificationError<Code.IMAGE_PULL_FAILED> {
  /** Creates an image-pull error. */
  constructor(reference: string, cause: unknown) {
    super({
      code: Code.IMAGE_PULL_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to pull build image",
      details: "Docker could not pull the exact digest-pinned image.",
      data: { reference },
      cause,
    });
  }
}

/** Raised when Docker returns no pull progress stream. */
export class ImagePullStreamMissingError
  extends BuildVerificationError<Code.IMAGE_PULL_STREAM_MISSING> {
  /** Creates a missing pull-stream error. */
  constructor(reference: string) {
    super({
      code: Code.IMAGE_PULL_STREAM_MISSING,
      source: "@colibri/build-verification/runners/docker",
      message: "Build image pull stream is missing",
      details: "Docker accepted the pull but returned no completion stream.",
      data: { reference },
    });
  }
}

/** Raised when Docker reports a pull-progress failure. */
export class ImagePullProgressFailedError
  extends BuildVerificationError<Code.IMAGE_PULL_PROGRESS_FAILED> {
  /** Creates an image pull-progress error. */
  constructor(reference: string, cause: unknown) {
    super({
      code: Code.IMAGE_PULL_PROGRESS_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Build image pull did not complete",
      details: "Docker reported an error while consuming pull progress.",
      data: { reference },
      cause,
    });
  }
}

/** Raised when a pulled image cannot be inspected. */
export class ImageInspectionFailedError
  extends BuildVerificationError<Code.IMAGE_INSPECTION_FAILED> {
  /** Creates an image-inspection error. */
  constructor(reference: string, cause: unknown) {
    super({
      code: Code.IMAGE_INSPECTION_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to inspect build image",
      details:
        "Docker could not return the selected image runtime configuration.",
      data: { reference },
      cause,
    });
  }
}

/** Raised when image entrypoint or work directory violates the build contract. */
export class ImageRuntimeMismatchError
  extends BuildVerificationError<Code.IMAGE_RUNTIME_MISMATCH> {
  /** Creates an image runtime-contract error. */
  constructor(
    reference: string,
    entrypoint: readonly string[] | string | null | undefined,
    workingDir: string | null,
  ) {
    super({
      code: Code.IMAGE_RUNTIME_MISMATCH,
      source: "@colibri/build-verification/runners/docker",
      message: "Build image runtime does not match SEP-58",
      details:
        "The image must enter through `stellar` with `/source` as workdir.",
      data: { reference, entrypoint, workingDir },
    });
  }
}

/** Raised when the pulled runtime digest differs from the approved manifest. */
export class RuntimeImageDigestMismatchError
  extends BuildVerificationError<Code.RUNTIME_IMAGE_DIGEST_MISMATCH> {
  /** Creates a runtime image digest-mismatch error. */
  constructor(expected: string, observed: readonly string[]) {
    super({
      code: Code.RUNTIME_IMAGE_DIGEST_MISMATCH,
      source: "@colibri/build-verification/runners/docker",
      message: "Docker runtime image digest mismatch",
      details: "The pulled runtime image does not expose the approved digest.",
      data: { expected, observed },
    });
  }
}

/** Raised when a contract build exceeds its wall-clock limit. */
export class BuildTimedOutError
  extends BuildVerificationError<Code.BUILD_TIMED_OUT> {
  /** Creates a build timeout error with bounded logs. */
  constructor(timeoutMs: number, stdout: string, stderr: string) {
    super({
      code: Code.BUILD_TIMED_OUT,
      source: "@colibri/build-verification/runners/docker",
      message: "Contract build timed out",
      details: "The isolated build exceeded its timeout and was terminated.",
      data: { timeoutMs, stdout, stderr },
    });
  }
}

/** Raised when the build command exits unsuccessfully. */
export class BuildCommandFailedError
  extends BuildVerificationError<Code.BUILD_COMMAND_FAILED> {
  /** Creates a non-zero build exit error with bounded logs. */
  constructor(exitCode: number, stdout: string, stderr: string) {
    super({
      code: Code.BUILD_COMMAND_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Contract build failed",
      details: "The pinned build image completed with a non-zero exit code.",
      data: { exitCode, stdout, stderr },
    });
  }
}

/** Raised when the runner cannot decode bounded container output. */
export class BuildLogCollectionFailedError
  extends BuildVerificationError<Code.BUILD_LOG_COLLECTION_FAILED> {
  /** Creates a Docker log-decoding error. */
  constructor(cause: unknown) {
    super({
      code: Code.BUILD_LOG_COLLECTION_FAILED,
      source: "@colibri/build-verification/runners/docker/logs",
      message: "Failed to collect build logs",
      details: "Docker output could not be decoded and bounded.",
      cause,
    });
  }
}

/** Raised when Docker cannot create the isolated build container. */
export class ContainerCreationFailedError
  extends BuildVerificationError<Code.CONTAINER_CREATION_FAILED> {
  /** Creates a container-creation error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_CREATION_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to create build container",
      details: "Docker rejected or could not materialize the isolated build.",
      cause,
    });
  }
}

/** Raised when a created container cannot be started. */
export class ContainerStartFailedError
  extends BuildVerificationError<Code.CONTAINER_START_FAILED> {
  /** Creates a container-start error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_START_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to start build container",
      details: "Docker created the build container but could not start it.",
      cause,
    });
  }
}

/** Raised when Docker cannot report a running container's terminal status. */
export class ContainerWaitFailedError
  extends BuildVerificationError<Code.CONTAINER_WAIT_FAILED> {
  /** Creates a container-wait error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_WAIT_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed while waiting for build container",
      details: "Docker could not report the build's terminal status.",
      cause,
    });
  }
}

/** Raised when a timed-out build container cannot be terminated. */
export class ContainerKillFailedError
  extends BuildVerificationError<Code.CONTAINER_KILL_FAILED> {
  /** Creates a container-kill error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_KILL_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to terminate timed-out build container",
      details: "Docker did not terminate the container after its timeout.",
      cause,
    });
  }
}

/** Raised when Docker cannot return completed build logs. */
export class ContainerLogsFailedError
  extends BuildVerificationError<Code.CONTAINER_LOGS_FAILED> {
  /** Creates a container-log retrieval error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_LOGS_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to read build container logs",
      details: "Docker could not return completed build output.",
      cause,
    });
  }
}

/** Raised when a completed build container cannot be removed. */
export class ContainerCleanupFailedError
  extends BuildVerificationError<Code.CONTAINER_CLEANUP_FAILED> {
  /** Creates a container cleanup error. */
  constructor(cause: unknown) {
    super({
      code: Code.CONTAINER_CLEANUP_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to remove build container",
      details: "Docker could not remove the disposable build container.",
      cause,
    });
  }
}

/** Raised when an execution plan omits or conflicts with required fields. */
export class BuildPlanInvalidError
  extends BuildVerificationError<Code.BUILD_PLAN_INVALID> {
  /** Creates an invalid build-plan error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.BUILD_PLAN_INVALID,
      source: "@colibri/build-verification/runners",
      message: "Invalid contract build plan",
      details,
      data,
    });
  }
}

/** Raised when the Docker runner encounters an unclassified failure. */
export class BuildRunnerUnexpectedError
  extends BuildVerificationError<Code.BUILD_RUNNER_UNEXPECTED> {
  /** Creates an unexpected build-runner error. */
  constructor(cause: unknown) {
    super({
      code: Code.BUILD_RUNNER_UNEXPECTED,
      source: "@colibri/build-verification/runners/docker",
      message: "Unexpected Docker build runner failure",
      details: "The Docker runner failed outside a classified execution path.",
      cause,
    });
  }
}

/** Raised when the Docker runner cannot align build output with the source owner. */
export class SourceBuildAccessPreparationFailedError
  extends BuildVerificationError<Code.SOURCE_BUILD_ACCESS_PREPARATION_FAILED> {
  /** Creates a source-owner discovery error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.SOURCE_BUILD_ACCESS_PREPARATION_FAILED,
      source: "@colibri/build-verification/runners/docker",
      message: "Failed to prepare source build access",
      details:
        "The Docker runner could not identify the disposable source workspace owner.",
      data: { path },
      cause,
    });
  }
}
