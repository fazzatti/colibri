import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import type { Buffer } from "node:buffer";
import Dockerode from "dockerode";
import {
  BuildCommandFailedError,
  BuildLogCollectionFailedError,
  BuildTimedOutError,
  BuildVerificationError,
  ContainerCleanupFailedError,
  ContainerCreationFailedError,
  ContainerKillFailedError,
  ContainerLogsFailedError,
  ContainerStartFailedError,
  ContainerWaitFailedError,
  DockerConfigurationFailedError,
  DockerUnavailableError,
  ImageInspectionFailedError,
  ImagePullFailedError,
  ImagePullProgressFailedError,
  ImagePullStreamMissingError,
  ImageRuntimeMismatchError,
} from "@/error.ts";
import { selectBuildArtifact, snapshotBuildArtifacts } from "@/artifact.ts";
import type {
  ContractBuildRunner,
  ContractBuildRunnerInput,
  ContractBuildRunnerOutput,
  DockerConnectionConfig,
} from "@/types.ts";

const SOCKET_PATHS = [
  "/var/run/docker.sock",
  `${homedir()}/.docker/run/docker.sock`,
  `${homedir()}/.orbstack/run/docker.sock`,
  `${homedir()}/.colima/default/docker.sock`,
];

const parseDockerHost = (dockerHost: string): Dockerode.DockerOptions => {
  const value = dockerHost.trim();
  if (!value) {
    throw new DockerConfigurationFailedError("DOCKER_HOST is set but empty.", {
      dockerHost,
    });
  }
  if (value.startsWith("unix://")) {
    return { socketPath: new URL(value).pathname };
  }
  if (value.startsWith("npipe://")) {
    return { socketPath: value.slice("npipe://".length) };
  }
  if (value.startsWith("/")) return { socketPath: value };
  let url: URL;
  try {
    url = new URL(
      value.startsWith("tcp://") ? value.replace(/^tcp:/, "http:") : value,
    );
  } catch (cause) {
    throw new DockerConfigurationFailedError(
      "DOCKER_HOST is not a valid Docker endpoint.",
      { dockerHost, cause: String(cause) },
    );
  }
  const protocol = url.protocol.slice(0, -1);
  if (protocol !== "http" && protocol !== "https") {
    throw new DockerConfigurationFailedError(
      "DOCKER_HOST must use unix, npipe, tcp/http, or https.",
      { dockerHost, protocol },
    );
  }
  return {
    protocol,
    host: url.hostname,
    port: Number(url.port || (protocol === "https" ? 2376 : 2375)),
  };
};

/** @internal Detects one unambiguous Docker socket from candidate paths. */
export const detectDockerOptions = (
  candidates: readonly string[] = SOCKET_PATHS,
): Dockerode.DockerOptions => {
  const unique = new Map<string, string>();
  for (const path of candidates) {
    if (existsSync(path)) unique.set(realpathSync(path), path);
  }
  const paths = [...unique.keys()];
  if (paths.length > 1) {
    throw new DockerConfigurationFailedError(
      "Multiple Docker sockets were detected. Select one explicitly.",
      { paths },
    );
  }
  return paths.length === 1 ? { socketPath: paths[0] } : {};
};

/** Resolves Docker connection options without relying on test-tooling internals. */
export const resolveDockerOptions = (
  config: DockerConnectionConfig = {},
  dockerHost: string | undefined = Deno.env.get("DOCKER_HOST"),
): Dockerode.DockerOptions => {
  const socketPath = config.dockerSocketPath?.trim();
  if (config.dockerSocketPath !== undefined && !socketPath) {
    throw new DockerConfigurationFailedError(
      "dockerSocketPath cannot be empty.",
    );
  }
  if (
    socketPath && config.dockerOptions?.socketPath &&
    socketPath !== config.dockerOptions.socketPath
  ) {
    throw new DockerConfigurationFailedError(
      "dockerSocketPath conflicts with dockerOptions.socketPath.",
      {
        dockerSocketPath: socketPath,
        dockerOptionsSocketPath: config.dockerOptions.socketPath,
      },
    );
  }
  if (config.dockerOptions && Object.keys(config.dockerOptions).length > 0) {
    if (!socketPath) return config.dockerOptions;
    const {
      host: _host,
      port: _port,
      protocol: _protocol,
      socketPath: _configuredSocket,
      ...remaining
    } = config.dockerOptions;
    return { ...remaining, socketPath };
  }
  if (socketPath) return { socketPath };
  if (dockerHost !== undefined) return parseDockerHost(dockerHost);
  return detectDockerOptions();
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

const boundedText = (bytes: Uint8Array, maximum: number): string => {
  const truncated = bytes.length > maximum;
  const selected = truncated ? bytes.subarray(0, maximum) : bytes;
  return new TextDecoder().decode(selected) +
    (truncated ? "\n[logs truncated by Colibri]" : "");
};

/** @internal Decodes and bounds Docker's multiplexed log representation. */
export const demultiplexDockerLogs = (
  value: Buffer | string,
  maximum: number,
): { stdout: string; stderr: string } => {
  try {
    const bytes = typeof value === "string"
      ? new TextEncoder().encode(value)
      : new Uint8Array(value);
    const stdout: number[] = [];
    const stderr: number[] = [];
    let offset = 0;
    let multiplexed = bytes.length >= 8 && (bytes[0] === 1 || bytes[0] === 2) &&
      bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0;
    if (!multiplexed) {
      return { stdout: boundedText(bytes, maximum), stderr: "" };
    }
    while (offset + 8 <= bytes.length) {
      const stream = bytes[offset];
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4)
        .getUint32(0);
      const end = offset + 8 + size;
      if ((stream !== 1 && stream !== 2) || end > bytes.length) {
        multiplexed = false;
        break;
      }
      const destination = stream === 2 ? stderr : stdout;
      for (const byte of bytes.subarray(offset + 8, end)) {
        destination.push(byte);
      }
      offset = end;
    }
    if (!multiplexed || offset !== bytes.length) {
      throw new RangeError("Malformed Docker multiplexed log stream");
    }
    return {
      stdout: boundedText(new Uint8Array(stdout), maximum),
      stderr: boundedText(new Uint8Array(stderr), maximum),
    };
  } catch (cause) {
    throw new BuildLogCollectionFailedError(cause);
  }
};

/** @internal Constructs the exact structured Stellar CLI argument vector. */
export const buildDockerCommand = (
  input: ContractBuildRunnerInput,
): string[] => {
  const command = [...input.recipe.arguments];
  command.push(
    ...input.recipe.options.filter((option) => !option.startsWith("--meta=")),
  );
  for (const entry of input.recipe.metadata) {
    command.push("--meta", `${entry.key}=${entry.value}`);
  }
  return command;
};

/** Docker-backed, resource-bounded SEP-58 contract build runner. */
export class DockerBuildRunner implements ContractBuildRunner {
  readonly #docker: Dockerode;

  /** Creates a runner using explicit Docker settings, `DOCKER_HOST`, or one detected local socket. */
  constructor(config?: DockerConnectionConfig);
  /** @internal */
  constructor(config: DockerConnectionConfig, docker: Dockerode);
  constructor(config: DockerConnectionConfig = {}, docker?: Dockerode) {
    this.#docker = docker ?? new Dockerode(resolveDockerOptions(config));
  }

  /** @internal Creates a runner around a controlled Docker client for boundary testing. */
  static fromDockerClient(docker: Dockerode): DockerBuildRunner {
    return new DockerBuildRunner({}, docker);
  }

  /** Pulls the pinned image, executes the build, and selects one exact wasm. */
  async run(
    input: ContractBuildRunnerInput,
  ): Promise<ContractBuildRunnerOutput> {
    try {
      await this.#docker.ping();
    } catch (cause) {
      throw new DockerUnavailableError(cause);
    }
    await pullImage(this.#docker, input.recipe.image);

    let imageInfo: Dockerode.ImageInspectInfo;
    try {
      imageInfo = await this.#docker.getImage(input.recipe.image).inspect();
    } catch (cause) {
      throw new ImageInspectionFailedError(input.recipe.image, cause);
    }
    const entrypoint = imageInfo.Config.Entrypoint;
    const workingDir = imageInfo.Config.WorkingDir;
    if (
      !entrypoint || entrypoint.length !== 1 || entrypoint[0] !== "stellar" ||
      workingDir !== "/source"
    ) {
      throw new ImageRuntimeMismatchError(
        input.recipe.image,
        entrypoint,
        workingDir,
      );
    }

    const before = await snapshotBuildArtifacts(input.sourceDirectory);
    const started = performance.now();
    let container: Dockerode.Container;
    try {
      container = await this.#docker.createContainer({
        Image: input.recipe.image,
        Cmd: buildDockerCommand(input),
        WorkingDir: "/source",
        AttachStdout: false,
        AttachStderr: false,
        HostConfig: {
          Binds: [`${input.sourceDirectory}:/source:rw`],
          NetworkMode: input.allowNetwork ? "bridge" : "none",
          ReadonlyRootfs: true,
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

    let timedOut = false;
    let statusCode = -1;
    let primaryError: unknown;
    let output: ContractBuildRunnerOutput | undefined;
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
        const waitResult = await Promise.race([
          container.wait(),
          timeoutPromise,
        ]);
        statusCode = waitResult.StatusCode;
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
      const artifact = await selectBuildArtifact(
        input.sourceDirectory,
        before,
        input.recipe.options,
      );
      output = {
        wasm: artifact.wasm,
        artifactPath: artifact.path,
        stdout: logs.stdout,
        stderr: logs.stderr,
        durationMs: Math.round(performance.now() - started),
      };
    } catch (cause) {
      primaryError = cause;
    }
    try {
      await container.remove({ force: true });
    } catch (cause) {
      if (!primaryError) primaryError = new ContainerCleanupFailedError(cause);
    }
    if (primaryError) throw primaryError;
    return output!;
  }
}
