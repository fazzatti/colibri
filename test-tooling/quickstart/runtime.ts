import type { Container, ContainerInfo } from "dockerode";
import {
  createDockerClient,
  type DockerConnectionConfig,
  resolvePublishedPortHost,
} from "@/quickstart/docker.ts";
import {
  CONTAINER_ERROR,
  IMAGE_ERROR,
  QuickstartError,
  READINESS_ERROR,
} from "@/quickstart/error.ts";
import {
  createLogger,
  type LoggerLike,
  type LogLevelDesc,
} from "@/quickstart/logging.ts";

/**
 * Minimal Docker client surface used by the quickstart runtime.
 */
export type DockerClientLike = {
  listContainers(options?: { all?: boolean }): Promise<ContainerInfo[]>;
  getContainer(containerId: string): Container;
  getVolume(volumeName: string): { remove(): Promise<unknown> };
  pull(
    imageName: string,
    options: Record<string, unknown>,
    callback: (error: unknown, stream?: NodeJS.ReadableStream) => void,
  ): void;
  modem: {
    followProgress(
      stream: NodeJS.ReadableStream,
      onFinished: (error: unknown, output: unknown[]) => void,
      onProgress?: (event: { progress?: string; status?: string }) => void,
    ): void;
  };
};

/**
 * Subset of Docker inspect data used by quickstart helpers.
 */
export type ContainerInspectInfo = {
  Id: string;
  State: {
    Running: boolean;
    Status: string;
    ExitCode?: number | null;
  };
  NetworkSettings: {
    Ports?: Record<string, Array<{ HostPort: string; HostIp?: string }> | null>;
    Networks?: Record<string, { IPAddress: string }>;
  };
  Mounts: Array<{
    Type?: string;
    Name?: string;
  }>;
  Config: {
    Env?: string[];
  };
};

type RuntimeConfig = DockerConnectionConfig & {
  dockerClient?: DockerClientLike;
  logger?: LoggerLike;
  logLevel?: LogLevelDesc;
};

type WaitForLedgerReadyOptions = RuntimeConfig & {
  containerId: string;
  timeoutMs?: number;
  host?: string;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
};

const QUICKSTART_PORT = 8000;
const DOCKER_LOG_HEADER_LENGTH = 8;

/**
 * Sleeps for the given number of milliseconds.
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Formats unknown errors into a stable string message.
 */
const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

/**
 * Wraps unknown failures in a quickstart error when needed.
 */
const ensureQuickstartError = <T extends QuickstartError>(
  error: unknown,
  fallback: T,
): T | QuickstartError => {
  if (error instanceof QuickstartError) {
    return error;
  }

  return fallback;
};

/**
 * Returns either the injected Docker client or a real Dockerode instance.
 */
const getDockerClient = (
  config?: RuntimeConfig,
): DockerClientLike => {
  return (
    config?.dockerClient ||
    (createDockerClient(config) as unknown as DockerClientLike)
  );
};

const concatBytes = (
  left: Uint8Array<ArrayBufferLike>,
  right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBufferLike> => {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
};

const createDockerLogDecoder = () => {
  const textDecoder = new TextDecoder();
  let pending: Uint8Array<ArrayBufferLike> = new Uint8Array();

  const decodeChunk = (chunk: Uint8Array | string): string[] => {
    if (typeof chunk === "string") {
      return [chunk];
    }

    pending = concatBytes(pending, chunk);
    const messages: string[] = [];

    while (pending.length > 0) {
      if (pending.length < DOCKER_LOG_HEADER_LENGTH) {
        break;
      }

      const streamType = pending[0];
      const isHeader = (streamType === 1 || streamType === 2) &&
        pending[1] === 0 &&
        pending[2] === 0 &&
        pending[3] === 0;

      if (!isHeader) {
        messages.push(textDecoder.decode(pending));
        pending = new Uint8Array();
        break;
      }

      const payloadLength = ((pending[4] << 24) |
        (pending[5] << 16) |
        (pending[6] << 8) |
        pending[7]) >>> 0;
      const frameLength = DOCKER_LOG_HEADER_LENGTH + payloadLength;

      if (pending.length < frameLength) {
        break;
      }

      messages.push(
        textDecoder.decode(
          pending.subarray(DOCKER_LOG_HEADER_LENGTH, frameLength),
        ),
      );
      pending = pending.subarray(frameLength);
    }

    return messages;
  };

  const flush = (): string | undefined => {
    if (pending.length === 0) {
      return undefined;
    }

    const message = textDecoder.decode(pending);
    pending = new Uint8Array();
    return message;
  };

  return {
    decodeChunk,
    flush,
  };
};

/**
 * Returns `true` when Docker reports the provided container name.
 */
export const hasContainerName = (
  containerInfo: ContainerInfo,
  name: string,
): boolean => {
  return (containerInfo.Names || []).includes(`/${name}`);
};

/**
 * Finds a Docker container by its exact name.
 */
export const findContainerByName = async (
  name: string,
  config?: RuntimeConfig,
): Promise<ContainerInfo | undefined> => {
  const docker = getDockerClient(config);

  try {
    const containerInfos = await docker.listContainers({ all: true });
    return containerInfos.find((info) => hasContainerName(info, name));
  } catch (error) {
    throw ensureQuickstartError(
      error,
      new CONTAINER_ERROR({
        message: "Failed to list Docker containers.",
        details:
          "Quickstart could not inspect the local Docker daemon while looking up a named container.",
        data: { containerName: name },
        cause: error,
      }),
    );
  }
};

/**
 * Stops a Docker container using the callback-based Dockerode API.
 */
export const stopContainer = (container: Container): Promise<void> => {
  const containerId = (container as { id?: string }).id;

  return new Promise((resolve, reject) => {
    container.stop({}, (error: unknown) => {
      if (error) {
        reject(
          ensureQuickstartError(
            error,
            new CONTAINER_ERROR({
              message: formatError(error),
              details: "Docker failed to stop the requested container.",
              data: { containerId },
              cause: error,
            }),
          ),
        );
      } else {
        resolve();
      }
    });
  });
};

/**
 * Removes a container and any attached named volumes.
 */
export const removeContainerAndVolumes = async (
  containerId: string,
  config?: RuntimeConfig,
): Promise<void> => {
  const docker = getDockerClient(config);
  const log = createLogger({
    label: "quickstart#remove-container",
    level: config?.logLevel,
    logger: config?.logger,
  });

  try {
    const container = docker.getContainer(containerId);
    const inspectInfo = (await container.inspect()) as ContainerInspectInfo;

    if (inspectInfo.State.Running) {
      await stopContainer(container);
    }

    await container.remove({ v: true, force: true });

    await Promise.all(
      inspectInfo.Mounts.map(async (mount) => {
        if (mount.Type !== "volume" || !mount.Name) {
          return;
        }

        try {
          await docker.getVolume(mount.Name).remove();
        } catch {
          log.debug(`Ignoring failure while removing volume ${mount.Name}.`);
        }
      }),
    );
  } catch (error) {
    throw ensureQuickstartError(
      error,
      new CONTAINER_ERROR({
        message: "Failed to remove Docker container.",
        details:
          "Quickstart could not remove the requested container and its attached volumes.",
        data: { containerId },
        cause: error,
      }),
    );
  }
};

/**
 * Resolves a published host port for the requested private container port.
 */
export const getPublicPort = (
  privatePort: number,
  containerInfo: ContainerInspectInfo,
): number => {
  const key = `${privatePort}/tcp`;
  const ports = containerInfo.NetworkSettings.Ports || {};
  const mapping = ports[key];

  if (!mapping || mapping.length < 1) {
    throw new CONTAINER_ERROR({
      message: `No public port mapping found for ${key}.`,
      details:
        "The container is running but Docker did not publish the expected host port.",
      data: { containerId: containerInfo.Id, privatePort, portKey: key },
    });
  }

  const publicPort = Number(mapping[0].HostPort);
  if (!Number.isInteger(publicPort)) {
    throw new CONTAINER_ERROR({
      message: `Invalid public port mapping for ${key}.`,
      details:
        "Docker reported a host port mapping, but the value was not a valid integer.",
      data: {
        containerId: containerInfo.Id,
        privatePort,
        portKey: key,
        hostPort: mapping[0].HostPort,
      },
    });
  }

  return publicPort;
};

/**
 * Returns the first IP address reported by Docker for the container.
 */
export const getContainerIpAddress = (
  containerInfo: ContainerInspectInfo,
): string => {
  const networks = containerInfo.NetworkSettings.Networks || {};
  const networkNames = Object.keys(networks);

  if (networkNames.length < 1) {
    throw new CONTAINER_ERROR({
      message: "Container is not connected to any networks.",
      details:
        "Docker inspection did not return any network attachments for the container.",
      data: { containerId: containerInfo.Id },
    });
  }

  return networks[networkNames[0]].IPAddress;
};

/**
 * Pulls an image once and resolves the Docker progress output.
 */
export const pullImageOnce = async (
  imageName: string,
  config?: RuntimeConfig,
): Promise<unknown[]> => {
  const docker = getDockerClient(config);
  const log = createLogger({
    label: "quickstart#pull-image",
    level: config?.logLevel,
    logger: config?.logger,
  });

  return await new Promise((resolve, reject) => {
    docker.pull(
      imageName,
      {},
      (error: unknown, stream?: NodeJS.ReadableStream) => {
        if (error) {
          reject(
            ensureQuickstartError(
              error,
              new IMAGE_ERROR({
                message: formatError(error),
                details: `Docker failed to start pulling image "${imageName}".`,
                data: { imageName },
                cause: error,
              }),
            ),
          );
          return;
        }

        if (!stream) {
          reject(
            new IMAGE_ERROR({
              message: "Docker pull did not return a progress stream.",
              details:
                "Docker acknowledged the pull request but did not provide a progress stream.",
              data: { imageName },
            }),
          );
          return;
        }

        let lastLogAt = 0;
        docker.modem.followProgress(
          stream,
          (progressError: unknown, output: unknown[]) => {
            if (progressError) {
              reject(
                ensureQuickstartError(
                  progressError,
                  new IMAGE_ERROR({
                    message: formatError(progressError),
                    details:
                      "Docker reported an error while streaming image pull progress.",
                    data: { imageName },
                    cause: progressError,
                  }),
                ),
              );
            } else {
              log.debug(`Finished ${imageName} pull completely OK`);
              resolve(output);
            }
          },
          (event: { progress?: string; status?: string }) => {
            const now = Date.now();
            if (now - lastLogAt < 1000) {
              return;
            }

            lastLogAt = now;
            log.debug(
              JSON.stringify(event.progress || event.status || "pulling image"),
            );
          },
        );
      },
    );
  });
};

/**
 * Pulls an image with bounded retries.
 */
export const pullImage = async (
  imageName: string,
  config?: RuntimeConfig & {
    retries?: number;
    sleepFn?: (ms: number) => Promise<void>;
  },
): Promise<unknown[]> => {
  const retries = Math.max(0, config?.retries ?? 2);
  const sleepFn = config?.sleepFn || sleep;
  const log = createLogger({
    label: "quickstart#pull-image",
    level: config?.logLevel,
    logger: config?.logger,
  });

  const attemptPull = async (attempt: number): Promise<unknown[]> => {
    try {
      return await pullImageOnce(imageName, config);
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      log.warn(
        `Pull attempt ${attempt + 1} for ${imageName} failed, retrying.`,
        error,
      );
      await sleepFn(1000 * (attempt + 1));
      return await attemptPull(attempt + 1);
    }
  };

  return await attemptPull(0);
};

/**
 * Starts following container logs and forwards them into the provided logger.
 */
export const streamContainerLogs = async (options: {
  container: Container;
  logger: LoggerLike;
  tag: string;
}): Promise<void> => {
  try {
    const logStream = await options.container.logs({
      follow: true,
      stderr: true,
      stdout: true,
    });
    const ignoredMessages = new Set(["\r\n", "+\r\n", ".\r\n"]);
    const decoder = createDockerLogDecoder();

    logStream.on("data", (chunk: Uint8Array | string) => {
      for (const message of decoder.decodeChunk(chunk)) {
        if (!ignoredMessages.has(message)) {
          options.logger.debug(`${options.tag} ${message}`);
        }
      }
    });

    logStream.on("end", () => {
      const message = decoder.flush();
      if (message && !ignoredMessages.has(message)) {
        options.logger.debug(`${options.tag} ${message}`);
      }
    });
  } catch (error) {
    throw ensureQuickstartError(
      error,
      new CONTAINER_ERROR({
        message: "Failed to stream container logs.",
        details:
          "Docker rejected the request to attach to the container log stream.",
        cause: error,
      }),
    );
  }
};

/**
 * Polls Horizon and Soroban RPC until the quickstart ledger is ready.
 */
export const waitForLedgerReady = async (
  options: WaitForLedgerReadyOptions,
): Promise<void> => {
  const docker = getDockerClient(options);
  const fetchFn = options.fetchFn || fetch;
  const sleepFn = options.sleepFn || sleep;
  const nowFn = options.nowFn || Date.now;
  const timeoutMs = options.timeoutMs ?? 180000;
  const host = options.host || resolvePublishedPortHost(options);
  const deadline = nowFn() + timeoutMs;

  let lastError: unknown;

  while (nowFn() < deadline) {
    try {
      const container = docker.getContainer(options.containerId);
      const inspectInfo = (await container.inspect()) as ContainerInspectInfo;

      if (!inspectInfo.State.Running) {
        throw new READINESS_ERROR({
          message:
            `Container is not running (status: ${inspectInfo.State.Status}).`,
          details:
            "The quickstart container stopped before Horizon and Soroban RPC became ready.",
          data: {
            containerId: options.containerId,
            status: inspectInfo.State.Status,
            exitCode: inspectInfo.State.ExitCode,
          },
        });
      }

      const publicPort = getPublicPort(QUICKSTART_PORT, inspectInfo);
      const baseUrl = `http://${host}:${publicPort}`;

      const horizonResponse = await fetchFn(baseUrl);
      const horizonBody = await horizonResponse.text();

      if (horizonResponse.status !== 200) {
        throw new READINESS_ERROR({
          message:
            `Horizon is not ready yet (status: ${horizonResponse.status}, body: ${horizonBody}).`,
          details:
            "The Horizon endpoint is responding, but it has not reached a ready state yet.",
          data: {
            containerId: options.containerId,
            url: baseUrl,
            status: horizonResponse.status,
            body: horizonBody,
          },
        });
      }

      const rpcResponse = await fetchFn(`${baseUrl}/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 8675309,
          method: "getHealth",
        }),
      });
      const rpcBody = await rpcResponse.text();

      if (!rpcResponse.ok || !rpcBody.includes("healthy")) {
        throw new READINESS_ERROR({
          message:
            `RPC is not ready yet (status: ${rpcResponse.status}, body: ${rpcBody}).`,
          details:
            "Soroban RPC responded, but the health endpoint did not report a healthy state.",
          data: {
            containerId: options.containerId,
            url: `${baseUrl}/rpc`,
            status: rpcResponse.status,
            body: rpcBody,
          },
        });
      }

      return;
    } catch (error) {
      lastError = error;
      await sleepFn(1000);
    }
  }

  throw new READINESS_ERROR({
    message: `waitForLedgerReady timed out after ${timeoutMs}ms: ${
      formatError(lastError)
    }`,
    details:
      "Quickstart did not expose a healthy Horizon and Soroban RPC pair before the timeout elapsed.",
    data: {
      containerId: options.containerId,
      timeoutMs,
      host,
    },
    cause: lastError,
  });
};
