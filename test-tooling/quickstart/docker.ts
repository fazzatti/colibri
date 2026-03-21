import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import process from "node:process";
import Dockerode from "dockerode";
import { DOCKER_CONFIGURATION_ERROR } from "@/quickstart/error.ts";

/**
 * Docker connection settings accepted by quickstart helpers.
 */
export type DockerConnectionConfig = {
  /** Explicit Dockerode options such as `socketPath`, `host`, or `port`. */
  readonly dockerOptions?: Dockerode.DockerOptions;
  /** Explicit Unix socket path to the Docker daemon. */
  readonly dockerSocketPath?: string;
};

type ResolveDockerOptionsDependencies = {
  readonly dockerHost?: string;
  readonly autoDetectDockerOptions?: () => Dockerode.DockerOptions | undefined;
};

const COMMON_DOCKER_SOCKET_PATHS = [
  "/var/run/docker.sock",
  `${homedir()}/.docker/run/docker.sock`,
  `${homedir()}/.orbstack/run/docker.sock`,
  `${homedir()}/.colima/default/docker.sock`,
];

const DEFAULT_PUBLISHED_PORT_HOST = "127.0.0.1";

/**
 * Parses a `DOCKER_HOST` value into Dockerode options.
 */
export const parseDockerHost = (
  dockerHost: string,
): Dockerode.DockerOptions => {
  const value = dockerHost.trim();

  if (value.length === 0) {
    throw new DOCKER_CONFIGURATION_ERROR({
      message: "DOCKER_HOST was set but empty.",
      details:
        "Set DOCKER_HOST to a supported Docker endpoint or unset it to allow local socket auto-detection.",
      data: { dockerHost },
    });
  }

  if (value.startsWith("unix://")) {
    const url = new URL(value);
    return { socketPath: url.pathname };
  }

  if (value.startsWith("npipe://")) {
    return { socketPath: value.slice("npipe://".length) };
  }

  if (value.startsWith("/")) {
    return { socketPath: value };
  }

  const normalized = value.startsWith("tcp://")
    ? value.replace("tcp://", "http://")
    : value;
  const url = new URL(normalized);
  const protocol = url.protocol.replace(":", "");

  if (protocol !== "http" && protocol !== "https") {
    throw new DOCKER_CONFIGURATION_ERROR({
      message: `Unsupported DOCKER_HOST protocol "${url.protocol}".`,
      details:
        "Only unix, npipe, tcp/http, and https Docker endpoints are supported.",
      data: {
        dockerHost,
        protocol: url.protocol,
      },
    });
  }

  return {
    protocol,
    host: url.hostname,
    port: Number(url.port || (protocol === "https" ? 2376 : 2375)),
  };
};

/**
 * Resolves the set of existing local Docker socket paths, deduplicated by real path.
 */
export const resolveSocketCandidatePaths = (
  paths = COMMON_DOCKER_SOCKET_PATHS,
): string[] => {
  const byRealPath = new Map<string, string>();

  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }

    const realPath = realpathSync(path);
    if (!byRealPath.has(realPath)) {
      byRealPath.set(realPath, path);
    }
  }

  return [...byRealPath.keys()];
};

/**
 * Auto-detects a single local Docker socket.
 */
export const autoDetectDockerOptions = (
  paths = COMMON_DOCKER_SOCKET_PATHS,
): Dockerode.DockerOptions | undefined => {
  const socketPaths = resolveSocketCandidatePaths(paths);

  if (socketPaths.length === 1) {
    return { socketPath: socketPaths[0] };
  }

  if (socketPaths.length > 1) {
    throw new DOCKER_CONFIGURATION_ERROR({
      message: `Multiple Docker sockets detected (${socketPaths.join(", ")}).`,
      details:
        'Set "dockerSocketPath", "dockerOptions", or DOCKER_HOST explicitly to select the correct daemon.',
      data: { socketPaths },
    });
  }

  return undefined;
};

/**
 * Resolves the Dockerode options used by quickstart.
 *
 * Resolution order:
 * 1. Explicit `dockerOptions`
 * 2. Explicit `dockerSocketPath`
 * 3. `DOCKER_HOST`
 * 4. Local socket auto-detection
 *
 * @param config - Optional explicit Docker connection settings.
 *   - `dockerOptions`: Full Dockerode connection options.
 *   - `dockerSocketPath`: Explicit Unix socket path.
 * @param dependencies - Internal overrides used by tests.
 *   - `dockerHost`: Stubbed `DOCKER_HOST` value.
 *   - `autoDetectDockerOptions`: Stubbed auto-detection function.
 * @returns Dockerode connection options ready to pass into `new Dockerode(...)`.
 *
 * @example
 * ```ts
 * const dockerOptions = resolveDockerOptions({
 *   dockerSocketPath: "/var/run/docker.sock",
 * });
 * ```
 */
export const resolveDockerOptions = (
  config?: DockerConnectionConfig,
  dependencies?: ResolveDockerOptionsDependencies,
): Dockerode.DockerOptions => {
  const dockerSocketPath = config?.dockerSocketPath?.trim();
  const dockerOptions = config?.dockerOptions;

  if (
    dockerSocketPath &&
    dockerOptions?.socketPath &&
    dockerOptions.socketPath !== dockerSocketPath
  ) {
    throw new DOCKER_CONFIGURATION_ERROR({
      message:
        "Conflicting Docker socket configuration: dockerOptions.socketPath and dockerSocketPath differ.",
      details:
        "Provide one explicit socket path or ensure both configuration entries point to the same Docker socket.",
      data: {
        dockerSocketPath,
        dockerOptionsSocketPath: dockerOptions.socketPath,
      },
    });
  }

  if (dockerOptions && Object.keys(dockerOptions).length > 0) {
    return dockerSocketPath
      ? { ...dockerOptions, socketPath: dockerSocketPath }
      : dockerOptions;
  }

  if (dockerSocketPath) {
    return { socketPath: dockerSocketPath };
  }

  const dockerHost = dependencies?.dockerHost ?? process.env.DOCKER_HOST;
  if (dockerHost) {
    return parseDockerHost(dockerHost);
  }

  return (dependencies?.autoDetectDockerOptions || autoDetectDockerOptions)() ||
    {};
};

/**
 * Resolves the host clients should use to reach ports published by the Docker daemon.
 *
 * Local socket and wildcard-host configurations are normalized to loopback.
 */
export const resolvePublishedPortHost = (
  config?: DockerConnectionConfig,
): string => {
  const dockerSocketPath = config?.dockerSocketPath?.trim();
  const dockerOptions = config?.dockerOptions;

  if (dockerSocketPath || dockerOptions?.socketPath?.trim()) {
    return DEFAULT_PUBLISHED_PORT_HOST;
  }

  let host = dockerOptions?.host?.trim();
  if (!host) {
    const dockerHost = process.env.DOCKER_HOST?.trim();
    if (dockerHost) {
      const parsed = parseDockerHost(dockerHost);
      if (parsed.socketPath) {
        return DEFAULT_PUBLISHED_PORT_HOST;
      }

      host = parsed.host?.trim();
    }
  }

  if (!host) {
    return DEFAULT_PUBLISHED_PORT_HOST;
  }

  if (host === "0.0.0.0" || host === "::") {
    return DEFAULT_PUBLISHED_PORT_HOST;
  }

  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
};

/**
 * Creates the Dockerode client used by quickstart operations.
 *
 * @param config - Optional Docker connection settings.
 * @returns A configured Dockerode client instance.
 */
export const createDockerClient = (
  config?: DockerConnectionConfig,
): Dockerode => {
  return new Dockerode(resolveDockerOptions(config));
};
