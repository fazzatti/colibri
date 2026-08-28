import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import type Dockerode from "dockerode";
import type { DockerConnectionConfig } from "../types.ts";
import { DockerConfigurationFailedError } from "./error.ts";

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

/** Detects one unambiguous Docker socket from candidate paths. */
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

/** Resolves explicit Docker settings, `DOCKER_HOST`, or one local socket. */
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
