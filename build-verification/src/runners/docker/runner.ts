import type { Buffer } from "node:buffer";
import Dockerode from "dockerode";
import type {
  ContractBuildPlan,
  ContractBuildRunner,
  ContractBuildRunnerOutput,
  DockerConnectionConfig,
} from "../types.ts";
import { BuildVerificationError } from "../../error/base.ts";
import { attachBuildVerificationErrorContext } from "../../error/base.ts";
import { resolveDockerOptions } from "./connection.ts";
import { buildDockerCommand } from "./command.ts";
import { demultiplexDockerLogs } from "./logs.ts";
import {
  BuildCommandFailedError,
  BuildPlanInvalidError,
  BuildRunnerUnexpectedError,
  BuildTimedOutError,
  ContainerCleanupFailedError,
  ContainerCreationFailedError,
  ContainerKillFailedError,
  ContainerLogsFailedError,
  ContainerStartFailedError,
  ContainerWaitFailedError,
  DockerUnavailableError,
  ImageInspectionFailedError,
  ImagePullFailedError,
  ImagePullProgressFailedError,
  ImagePullStreamMissingError,
  ImageRuntimeMismatchError,
  RuntimeImageDigestMismatchError,
} from "./error.ts";

const pullImage = async (docker: Dockerode, image: string): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      docker.pull(
        image,
        {},
        (pullError: unknown, stream?: NodeJS.ReadableStream) => {
          if (pullError) {
            reject(new ImagePullFailedError(image, pullError));
            return;
          }
          if (!stream) {
            reject(new ImagePullStreamMissingError(image));
            return;
          }
          docker.modem.followProgress(stream, (progressError: unknown) => {
            if (progressError) {
              reject(new ImagePullProgressFailedError(image, progressError));
            } else resolve();
          });
        },
      );
    });
  } catch (cause) {
    if (cause instanceof BuildVerificationError) throw cause;
    throw new ImagePullFailedError(image, cause);
  }
};

const validatePlan = (input: ContractBuildPlan): void => {
  if (!input.sourceDirectory || !input.rustupToolchain) {
    throw new BuildPlanInvalidError(
      "The plan requires a source directory and image-pinned RUSTUP_TOOLCHAIN.",
    );
  }
  if (
    input.image.reference !==
      `${input.image.registry}/${input.image.repository}@${input.image.manifestDigest}`
  ) {
    throw new BuildPlanInvalidError(
      "The approved image reference must equal its resolved manifest digest.",
      {
        reference: input.image.reference,
        manifestDigest: input.image.manifestDigest,
      },
    );
  }
};

/** Normalizes an unexpected primary failure and attaches cleanup diagnostics. */
export const attachDockerCleanupFailure = (
  primary: unknown,
  cleanup: ContainerCleanupFailedError,
): BuildVerificationError =>
  attachBuildVerificationErrorContext(
    primary instanceof BuildVerificationError
      ? primary
      : new BuildRunnerUnexpectedError(primary),
    { input: { cleanupFailure: cleanup.toJSON() } },
  );

const normalizeDockerRunnerFailure = (
  cause: unknown,
): BuildVerificationError =>
  cause instanceof BuildVerificationError
    ? cause
    : new BuildRunnerUnexpectedError(cause);

/** Docker-backed, resource-bounded execution-only contract build runner. */
export class DockerBuildRunner implements ContractBuildRunner {
  readonly #docker: Dockerode;

  /** Creates a runner from explicit Docker settings or local discovery. */
  constructor(config?: DockerConnectionConfig);
  /** @internal Creates a runner around a controlled Docker client. */
  constructor(config: DockerConnectionConfig, docker: Dockerode);
  constructor(config: DockerConnectionConfig = {}, docker?: Dockerode) {
    this.#docker = docker ?? new Dockerode(resolveDockerOptions(config));
  }

  /** Creates a runner around a controlled client for boundary tests. */
  static fromDockerClient(docker: Dockerode): DockerBuildRunner {
    return new DockerBuildRunner({}, docker);
  }

  /** Executes a validated plan without collecting or selecting Wasm artifacts. */
  async run(input: ContractBuildPlan): Promise<ContractBuildRunnerOutput> {
    validatePlan(input);
    const command = buildDockerCommand(input);
    try {
      await this.#docker.ping();
    } catch (cause) {
      throw new DockerUnavailableError(cause);
    }
    await pullImage(this.#docker, input.image.reference);

    let imageInfo: Dockerode.ImageInspectInfo;
    try {
      imageInfo = await this.#docker.getImage(input.image.reference).inspect();
    } catch (cause) {
      throw new ImageInspectionFailedError(input.image.reference, cause);
    }
    const entrypoint = imageInfo.Config.Entrypoint;
    const workingDir = imageInfo.Config.WorkingDir;
    if (
      !entrypoint || entrypoint.length !== 1 || entrypoint[0] !== "stellar" ||
      workingDir !== "/source"
    ) {
      throw new ImageRuntimeMismatchError(
        input.image.reference,
        entrypoint,
        workingDir,
      );
    }
    const repoDigests = imageInfo.RepoDigests ?? [];
    const approvedDigest = input.image.manifestDigest;
    if (!repoDigests.some((value) => value.endsWith(`@${approvedDigest}`))) {
      throw new RuntimeImageDigestMismatchError(approvedDigest, repoDigests);
    }

    const started = performance.now();
    let container: Dockerode.Container;
    try {
      container = await this.#docker.createContainer({
        Image: input.image.reference,
        Cmd: command,
        Env: [`RUSTUP_TOOLCHAIN=${input.rustupToolchain}`],
        Labels: { "dev.colibri.build-verification.runner": "1" },
        WorkingDir: "/source",
        AttachStdout: false,
        AttachStderr: false,
        platform: input.image.os && input.image.architecture
          ? `${input.image.os}/${input.image.architecture}`
          : undefined,
        HostConfig: {
          Binds: [`${input.sourceDirectory}:/source:rw`],
          NetworkMode: input.allowNetwork ? "bridge" : "none",
          ReadonlyRootfs: true,
          Privileged: false,
          CapDrop: ["ALL"],
          SecurityOpt: ["no-new-privileges"],
          Memory: input.limits.memoryBytes,
          NanoCpus: Math.round(input.limits.cpus * 1_000_000_000),
          PidsLimit: input.limits.pids,
          Tmpfs: {
            "/tmp": "rw,nosuid,nodev,size=268435456,mode=1777",
            "/stellar/.cargo/registry":
              "rw,nosuid,nodev,size=1073741824,mode=1777",
            "/stellar/.cargo/git": "rw,nosuid,nodev,size=536870912,mode=1777",
          },
        },
      });
    } catch (cause) {
      throw new ContainerCreationFailedError(cause);
    }

    let primaryError: unknown;
    let output: ContractBuildRunnerOutput | undefined;
    let timedOut = false;
    let statusCode = -1;
    try {
      try {
        await container.start();
      } catch (cause) {
        throw new ContainerStartFailedError(cause);
      }
      let timeout: number | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new BuildTimedOutError(input.limits.timeoutMs, "", "")),
          input.limits.timeoutMs,
        );
      });
      try {
        const wait = await Promise.race([container.wait(), timeoutPromise]);
        statusCode = wait.StatusCode;
      } catch (cause) {
        if (cause instanceof BuildTimedOutError) {
          timedOut = true;
          try {
            await container.kill();
          } catch (killCause) {
            throw new ContainerKillFailedError(killCause);
          }
        } else {
          throw new ContainerWaitFailedError(cause);
        }
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }

      let rawLogs: Buffer | string;
      try {
        rawLogs = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: false,
        });
      } catch (cause) {
        throw new ContainerLogsFailedError(cause);
      }
      const logs = demultiplexDockerLogs(rawLogs, input.limits.maxLogBytes);
      if (timedOut) {
        throw new BuildTimedOutError(
          input.limits.timeoutMs,
          logs.stdout,
          logs.stderr,
        );
      }
      if (statusCode !== 0) {
        throw new BuildCommandFailedError(statusCode, logs.stdout, logs.stderr);
      }
      output = {
        exitCode: 0,
        stdout: logs.stdout,
        stderr: logs.stderr,
        durationMs: Math.round(performance.now() - started),
        runtimeImageDigest: approvedDigest,
        runner: { name: "colibri-docker", version: "1" },
        capabilities: {
          networkIsolation: true,
          readOnlyRootFilesystem: true,
          cpuLimit: true,
          memoryLimit: true,
          pidLimit: true,
          timeout: true,
          hardDiskLimit: false,
        },
      };
    } catch (cause) {
      primaryError = cause;
    }
    try {
      await container.remove({ force: true });
    } catch (cause) {
      const cleanup = new ContainerCleanupFailedError(cause);
      primaryError = primaryError
        ? attachDockerCleanupFailure(primaryError, cleanup)
        : cleanup;
    }
    if (primaryError) throw normalizeDockerRunnerFailure(primaryError);
    return output!;
  }
}
