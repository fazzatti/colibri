import Dockerode from "dockerode";
import type {
  ContractBuildPlan,
  ContractBuildRunner,
  ContractBuildRunnerOutput,
  DockerBuildRunnerConfig,
} from "@/runners/types.ts";
import { BuildVerificationError } from "@/error/base.ts";
import { attachBuildVerificationErrorContext } from "@/error/base.ts";
import { resolveDockerOptions } from "@/runners/docker/connection.ts";
import { buildDockerCommand } from "@/runners/docker/command.ts";
import { collectBoundedDockerLogStream } from "@/runners/docker/logs.ts";
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
  DockerContainerNamePrefixInvalidError,
  DockerUnavailableError,
  ImageInspectionFailedError,
  ImagePullFailedError,
  ImagePullProgressFailedError,
  ImagePullStreamMissingError,
  ImageRuntimeMismatchError,
  RuntimeImageDigestMismatchError,
  SourceBuildAccessPreparationFailedError,
} from "@/runners/docker/error.ts";

const DEFAULT_CONTAINER_NAME_PREFIX = "colibri-build-verification";
const CONTAINER_NAME_PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const normalizeContainerNamePrefix = (prefix: unknown): string => {
  if (prefix === undefined) return DEFAULT_CONTAINER_NAME_PREFIX;
  if (typeof prefix !== "string") {
    throw new DockerContainerNamePrefixInvalidError(prefix);
  }
  const normalized = prefix.trim();
  if (!normalized || !CONTAINER_NAME_PREFIX_PATTERN.test(normalized)) {
    throw new DockerContainerNamePrefixInvalidError(prefix);
  }
  return normalized;
};

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

/** Resolves the non-root Docker user that owns one prepared source workspace. */
export const getDockerUserFromSourceOwner = (
  owner: Pick<Deno.FileInfo, "uid" | "gid">,
): string | undefined =>
  owner.uid === null || owner.gid === null
    ? undefined
    : `${owner.uid}:${owner.gid}`;

const prepareDockerExecution = async (
  docker: Dockerode,
  input: ContractBuildPlan,
): Promise<{ command: string[]; user?: string; approvedDigest: string }> => {
  const command = buildDockerCommand(input);
  let sourceOwner: Deno.FileInfo;
  try {
    sourceOwner = await Deno.stat(input.sourceDirectory);
  } catch (cause) {
    throw new SourceBuildAccessPreparationFailedError(
      input.sourceDirectory,
      cause,
    );
  }
  try {
    await docker.ping();
  } catch (cause) {
    throw new DockerUnavailableError(cause);
  }
  await pullImage(docker, input.image.reference);

  let imageInfo: Dockerode.ImageInspectInfo;
  try {
    imageInfo = await docker.getImage(input.image.reference).inspect();
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
  const repoDigests: string[] = imageInfo.RepoDigests ?? [];
  const approvedDigest = input.image.manifestDigest;
  if (!repoDigests.some((value) => value.endsWith(`@${approvedDigest}`))) {
    throw new RuntimeImageDigestMismatchError(approvedDigest, repoDigests);
  }
  return {
    command,
    user: getDockerUserFromSourceOwner(sourceOwner),
    approvedDigest,
  };
};

const attachContainerLogs = async (
  container: Dockerode.Container,
  maximum: number,
): Promise<{
  collection: Promise<{ stdout: string; stderr: string }>;
}> => {
  try {
    const stream = await container.attach({
      stream: true,
      stdin: false,
      stdout: true,
      stderr: true,
    });
    const logs = collectBoundedDockerLogStream(stream, maximum);
    logs.catch(() => {});
    return { collection: logs };
  } catch (cause) {
    throw new ContainerLogsFailedError(cause);
  }
};

const startBuildContainer = async (
  container: Dockerode.Container,
): Promise<void> => {
  try {
    await container.start();
  } catch (cause) {
    throw new ContainerStartFailedError(cause);
  }
};

const waitForBuildContainer = async (
  container: Dockerode.Container,
  timeoutMs: number,
): Promise<{ statusCode: number; timedOut: boolean }> => {
  let timeout = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new BuildTimedOutError(timeoutMs, "", "")),
      timeoutMs,
    );
  });
  try {
    const wait = await Promise.race([container.wait(), timeoutPromise]);
    clearTimeout(timeout);
    return { statusCode: wait.StatusCode, timedOut: false };
  } catch (cause) {
    clearTimeout(timeout);
    if (!(cause instanceof BuildTimedOutError)) {
      throw new ContainerWaitFailedError(cause);
    }
    try {
      await container.kill();
    } catch (killCause) {
      throw new ContainerKillFailedError(killCause);
    }
    return { statusCode: -1, timedOut: true };
  }
};

const assertSuccessfulBuild = (
  statusCode: number,
  timedOut: boolean,
  timeoutMs: number,
  logs: { stdout: string; stderr: string },
): void => {
  if (timedOut) {
    throw new BuildTimedOutError(timeoutMs, logs.stdout, logs.stderr);
  }
  if (statusCode !== 0) {
    throw new BuildCommandFailedError(statusCode, logs.stdout, logs.stderr);
  }
};

/** Docker-backed, resource-bounded execution-only contract build runner. */
export class DockerBuildRunner implements ContractBuildRunner {
  readonly #docker: Dockerode;
  readonly #containerNamePrefix: string;

  /** Creates a runner from explicit Docker settings or local discovery. */
  constructor(config?: DockerBuildRunnerConfig);
  /** @internal Creates a runner around a controlled Docker client. */
  constructor(config: DockerBuildRunnerConfig, docker: Dockerode);
  constructor(config: DockerBuildRunnerConfig = {}, docker?: Dockerode) {
    this.#containerNamePrefix = normalizeContainerNamePrefix(
      config.containerNamePrefix,
    );
    this.#docker = docker ?? new Dockerode(resolveDockerOptions(config));
  }

  /** Creates a runner around a controlled client for boundary tests. */
  static fromDockerClient(
    docker: Dockerode,
    config: DockerBuildRunnerConfig = {},
  ): DockerBuildRunner {
    return new DockerBuildRunner(config, docker);
  }

  async #createContainer(
    input: ContractBuildPlan,
    command: string[],
    user?: string,
  ): Promise<Dockerode.Container> {
    try {
      return await this.#docker.createContainer({
        name: `${this.#containerNamePrefix}-${crypto.randomUUID()}`,
        Image: input.image.reference,
        Cmd: command,
        Env: [
          `RUSTUP_TOOLCHAIN=${input.rustupToolchain}`,
          "CARGO_HOME=/cargo",
          "HOME=/tmp",
        ],
        User: user,
        Labels: { "dev.colibri.build-verification.runner": "1" },
        WorkingDir: "/source",
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
        platform: input.image.os && input.image.architecture
          ? `${input.image.os}/${input.image.architecture}`
          : undefined,
        HostConfig: {
          Binds: [`${input.sourceDirectory}:/source:rw`],
          LogConfig: { Type: "none", Config: {} },
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
            "/cargo": "rw,nosuid,nodev,size=1610612736,mode=1777",
          },
        },
      });
    } catch (cause) {
      throw new ContainerCreationFailedError(cause);
    }
  }

  async #executeBuild(
    container: Dockerode.Container,
    input: ContractBuildPlan,
    started: number,
    approvedDigest: string,
  ): Promise<ContractBuildRunnerOutput> {
    const { collection: logCollection } = await attachContainerLogs(
      container,
      input.limits.maxLogBytes,
    );
    await startBuildContainer(container);
    const { statusCode, timedOut } = await waitForBuildContainer(
      container,
      input.limits.timeoutMs,
    );
    const logs = await logCollection;
    assertSuccessfulBuild(
      statusCode,
      timedOut,
      input.limits.timeoutMs,
      logs,
    );
    return {
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
  }

  /** Executes a validated plan without collecting or selecting Wasm artifacts. */
  async run(input: ContractBuildPlan): Promise<ContractBuildRunnerOutput> {
    validatePlan(input);
    const { command, user, approvedDigest } = await prepareDockerExecution(
      this.#docker,
      input,
    );
    const started = performance.now();
    const container = await this.#createContainer(input, command, user);

    let primaryError: unknown;
    let output: ContractBuildRunnerOutput | undefined;
    try {
      output = await this.#executeBuild(
        container,
        input,
        started,
        approvedDigest,
      );
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
