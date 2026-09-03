# build-verification/runners/docker

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                                 | Source                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BLDV_020` | `DOCKER_CONFIGURATION_FAILED` — Raised when Docker connection settings are invalid or ambiguous.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L30)  |
| `BLDV_021` | `DOCKER_UNAVAILABLE` — Raised when the configured Docker daemon cannot be reached.                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L31)  |
| `BLDV_022` | `IMAGE_PULL_FAILED` — Raised when Docker cannot pull the exact pinned image.                                              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L32)  |
| `BLDV_023` | `IMAGE_RUNTIME_MISMATCH` — Raised when image entrypoint or work directory violates the build contract.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L33)  |
| `BLDV_024` | `BUILD_TIMED_OUT` — Raised when a contract build exceeds its wall-clock limit.                                            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L34)  |
| `BLDV_025` | `BUILD_COMMAND_FAILED` — Raised when the build command exits unsuccessfully.                                              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L35)  |
| `BLDV_026` | `BUILD_LOG_COLLECTION_FAILED` — Raised when the runner cannot decode bounded container output.                            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L36)  |
| `BLDV_032` | `IMAGE_PULL_STREAM_MISSING` — Raised when Docker returns no pull progress stream.                                         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L41)  |
| `BLDV_033` | `IMAGE_PULL_PROGRESS_FAILED` — Raised when Docker reports a pull-progress failure.                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L42)  |
| `BLDV_034` | `IMAGE_INSPECTION_FAILED` — Raised when a pulled image cannot be inspected.                                               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L43)  |
| `BLDV_036` | `CONTAINER_CREATION_FAILED` — Raised when Docker cannot create the isolated build container.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L45)  |
| `BLDV_037` | `CONTAINER_START_FAILED` — Raised when a created container cannot be started.                                             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L46)  |
| `BLDV_038` | `CONTAINER_WAIT_FAILED` — Raised when Docker cannot report a running container's terminal status.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L47)  |
| `BLDV_039` | `CONTAINER_KILL_FAILED` — Raised when a timed-out build container cannot be terminated.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L48)  |
| `BLDV_040` | `CONTAINER_LOGS_FAILED` — Raised when Docker cannot return completed build logs.                                          | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L49)  |
| `BLDV_041` | `CONTAINER_CLEANUP_FAILED` — Raised when a completed build container cannot be removed.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L50)  |
| `BLDV_072` | `RUNTIME_IMAGE_DIGEST_MISMATCH` — Raised when the pulled runtime digest differs from the approved manifest.               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L81)  |
| `BLDV_088` | `BUILD_PLAN_INVALID` — Raised when an execution plan omits or conflicts with required fields.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L97)  |
| `BLDV_095` | `BUILD_RUNNER_UNEXPECTED` — Raised when the Docker runner encounters an unclassified failure.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L104) |
| `BLDV_098` | `SOURCE_BUILD_ACCESS_PREPARATION_FAILED` — Raised when the Docker runner cannot align build output with the source owner. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L107) |
| `BLDV_132` | `DOCKER_CONTAINER_NAME_PREFIX_INVALID` — Raised when a build-container name prefix cannot form a valid Docker name.       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L141) |
