import type { Container, ContainerCreateOptions, ContainerInfo } from "dockerode";
import {
  createDockerClient,
  resolveDockerOptions,
  type DockerConnectionConfig,
} from "@/quickstart/docker.ts";
import {
  CONTAINER_ERROR,
  INVALID_CONFIGURATION,
  QuickstartError,
} from "@/quickstart/error.ts";
import {
  findContainerByName,
  getContainerIpAddress,
  getPublicPort,
  pullImage,
  removeContainerAndVolumes,
  streamContainerLogs,
  stopContainer,
  type ContainerInspectInfo,
  waitForLedgerReady,
} from "@/quickstart/runtime.ts";
import {
  type IStellarTestLedger,
  NetworkEnv,
  ResourceLimits,
  SupportedImageVersions,
  type TestLedgerOptions,
} from "@/quickstart/types.ts";
import {
  type NetworkConfig,
  NetworkConfig as ColibriNetworkConfig,
  isBooleanStrict,
} from "@colibri/core";
import {
  createLogger,
  type LogLevelDesc,
  type LoggerLike,
} from "@/quickstart/logging.ts";

const DEFAULTS = Object.freeze({
  containerName: "colibri-stellar-test-ledger",
  imageName: "stellar/quickstart",
  imageVersion: SupportedImageVersions.LASTEST,
  network: NetworkEnv.LOCAL,
  limits: ResourceLimits.TESTNET,
  useRunningLedger: false,
  logLevel: "info" as LogLevelDesc,
  emitContainerLogs: false,
});

const QUICKSTART_CMD = ["--local", "--limits", "testnet"] as const;

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
 * Manages a Docker-backed Stellar Quickstart instance for tests.
 *
 * The class can either start a new container or attach to an already-running
 * named container. Once started, it exposes a ready-to-use Colibri
 * `NetworkConfig` for the embedded Horizon and Soroban RPC endpoints.
 *
 * @example
 * ```ts
 * import { StellarTestLedger } from "jsr:@colibri/test-tooling";
 *
 * const ledger = new StellarTestLedger({
 *   containerName: "my-test-ledger",
 *   emitContainerLogs: true,
 * });
 *
 * await ledger.start();
 * const network = await ledger.getNetworkConfiguration();
 *
 * console.log(network.rpcUrl);
 *
 * await ledger.stop();
 * await ledger.destroy();
 * ```
 */
export class StellarTestLedger implements IStellarTestLedger {
  /** The Docker container name managed by this ledger instance. */
  public readonly containerName: string;

  /** The Docker image repository used to start the ledger. */
  public readonly containerImageName: string;

  /** The Docker image tag used to start the ledger. */
  public readonly containerImageVersion: SupportedImageVersions | string;

  private readonly useRunningLedger: boolean;
  private readonly emitContainerLogs: boolean;
  private readonly log: LoggerLike;
  private readonly logLevel: LogLevelDesc;
  private readonly dockerConnection: DockerConnectionConfig;

  /** The currently tracked Docker container, if one has been started or attached. */
  public container: Container | undefined;

  /** The Docker container ID for the tracked container, if available. */
  public containerId: string | undefined;

  /**
   * Creates a new quickstart ledger manager.
   *
   * @param options - Ledger startup options.
   *   - `containerName`: Optional Docker container name.
   *   - `containerImageName`: Optional Docker image repository, defaults to `stellar/quickstart`.
   *   - `containerImageVersion`: Optional Docker image tag, defaults to `latest`.
   *   - `dockerOptions` / `dockerSocketPath`: Optional explicit Docker connection settings.
   *   - `useRunningLedger`: Reuse an existing named container instead of creating one.
   *   - `emitContainerLogs`: Forward container logs to the configured logger.
   *   - `logger` / `logLevel`: Logging configuration for lifecycle diagnostics.
   * @returns A configured `StellarTestLedger` instance.
   * @throws {INVALID_CONFIGURATION} If an unsupported network, limit profile, or image tag is provided.
   *
   * @example
   * ```ts
   * const ledger = new StellarTestLedger({
   *   containerName: "integration-ledger",
   *   dockerSocketPath: "/var/run/docker.sock",
   *   logLevel: "debug",
   * });
   * ```
   */
  constructor(options?: TestLedgerOptions) {
    const network = options?.network || DEFAULTS.network;
    const limits = options?.limits || DEFAULTS.limits;

    if (network !== NetworkEnv.LOCAL) {
      throw new INVALID_CONFIGURATION({
        option: "network",
        value: network,
        supportedValues: [NetworkEnv.LOCAL],
        message: `StellarTestLedger#constructor() network ${network} not supported.`,
        details:
          "The quickstart harness currently supports only the local standalone network profile.",
      });
    }

    if (limits !== ResourceLimits.TESTNET) {
      throw new INVALID_CONFIGURATION({
        option: "limits",
        value: limits,
        supportedValues: [ResourceLimits.TESTNET],
        message: `StellarTestLedger#constructor() limits ${limits} not supported.`,
        details:
          "The quickstart harness currently supports only the testnet resource limits profile.",
      });
    }

    this.containerImageVersion =
      options?.containerImageVersion || DEFAULTS.imageVersion;

    if (
      !Object.values(SupportedImageVersions).includes(
        this.containerImageVersion as SupportedImageVersions,
      )
    ) {
      throw new INVALID_CONFIGURATION({
        option: "containerImageVersion",
        value: options?.containerImageVersion,
        supportedValues: Object.values(SupportedImageVersions),
        message:
          `StellarTestLedger#constructor() containerImageVersion ${options?.containerImageVersion} not supported.`,
        details:
          "The requested quickstart image tag is not in the supported image version allow-list.",
      });
    }

    this.containerName = options?.containerName || DEFAULTS.containerName;
    this.containerImageName = options?.containerImageName || DEFAULTS.imageName;
    this.useRunningLedger = isBooleanStrict(options?.useRunningLedger)
      ? (options?.useRunningLedger as boolean)
      : DEFAULTS.useRunningLedger;
    this.logLevel = options?.logLevel || DEFAULTS.logLevel;
    this.emitContainerLogs = isBooleanStrict(options?.emitContainerLogs)
      ? (options?.emitContainerLogs as boolean)
      : DEFAULTS.emitContainerLogs;
    this.dockerConnection = {
      dockerOptions: resolveDockerOptions({
        dockerOptions: options?.dockerOptions,
        dockerSocketPath: options?.dockerSocketPath,
      }),
    };
    this.log = createLogger({
      level: this.logLevel,
      label: "StellarTestLedger",
      logger: options?.logger,
    });

    this.log.debug("Initialized");
  }

  /**
   * Returns the fully qualified Docker image reference for the current ledger.
   */
  public get fullContainerImageName(): string {
    return [this.containerImageName, this.containerImageVersion].join(":");
  }

  /**
   * Creates the Docker client used by this instance.
   */
  protected getDockerClient() {
    return createDockerClient(this.dockerConnection);
  }

  /**
   * Looks up an existing container with the configured name.
   */
  protected async findNamedContainer(): Promise<ContainerInfo | undefined> {
    return await findContainerByName(this.containerName, {
      ...this.dockerConnection,
      dockerClient: this.getDockerClient() as never,
    });
  }

  /**
   * Ensures a named container is using the expected quickstart image.
   */
  protected ensureExpectedNamedContainer(containerInfo: ContainerInfo): void {
    if (containerInfo.Image !== this.fullContainerImageName) {
      throw new CONTAINER_ERROR({
        message:
          `StellarTestLedger found container "${this.containerName}" with image "${containerInfo.Image}", expected "${this.fullContainerImageName}".`,
        details:
          "A container with the requested name already exists, but it was created from a different Docker image.",
        data: {
          containerName: this.containerName,
          expectedImage: this.fullContainerImageName,
          actualImage: containerInfo.Image,
        },
      });
    }
  }

  /**
   * Removes a container by ID along with its attached named volumes.
   */
  protected async removeContainerById(containerId: string): Promise<void> {
    await removeContainerAndVolumes(containerId, {
      ...this.dockerConnection,
      dockerClient: this.getDockerClient() as never,
      logger: this.log,
      logLevel: this.logLevel,
    });
  }

  /**
   * Pulls the configured quickstart image.
   */
  protected async pullContainerImage(): Promise<void> {
    await pullImage(this.fullContainerImageName, {
      ...this.dockerConnection,
      dockerClient: this.getDockerClient() as never,
      logger: this.log,
      logLevel: this.logLevel,
    });
  }

  /**
   * Waits until the underlying quickstart services are ready.
   */
  protected async waitUntilReady(containerId: string): Promise<void> {
    await waitForLedgerReady({
      containerId,
      ...this.dockerConnection,
      dockerClient: this.getDockerClient() as never,
    });
  }

  /**
   * Creates the Docker container definition for the quickstart image.
   */
  protected async createContainer(): Promise<Container> {
    const createOptions: ContainerCreateOptions = {
      name: this.containerName,
      Image: this.fullContainerImageName,
      Cmd: [...QUICKSTART_CMD],
      ExposedPorts: {
        "8000/tcp": {},
      },
      HostConfig: {
        PublishAllPorts: true,
        Privileged: true,
      },
    };

    return await this.getDockerClient().createContainer(createOptions);
  }

  /**
   * Attaches container stdout and stderr to the configured logger.
   */
  protected async streamContainerLogs(container: Container): Promise<void> {
    await streamContainerLogs({
      container,
      tag: `[${this.fullContainerImageName}]`,
      logger: this.log,
    });
  }

  /**
   * Loads the latest Docker inspect data for the tracked container.
   */
  protected async getContainerInfo(): Promise<ContainerInspectInfo> {
    return (await this.getContainer().inspect()) as ContainerInspectInfo;
  }

  /**
   * Returns the tracked Docker container.
   *
   * @returns The currently tracked Docker container instance.
   * @throws {CONTAINER_ERROR} If this ledger instance has not started or attached to a container yet.
   */
  public getContainer(): Container {
    if (!this.container) {
      throw new CONTAINER_ERROR({
        message:
          "StellarTestLedger#getContainer() Container not started yet by this instance.",
        details:
          "Call start() or attach to an existing ledger before requesting the container instance.",
      });
    }

    return this.container;
  }

  /**
   * Returns the container IP address from Docker inspection data.
   *
   * @returns The first Docker network IP address assigned to the container.
   * @throws {CONTAINER_ERROR} If the ledger has not started or Docker inspection fails.
   *
   * @example
   * ```ts
   * const ledger = new StellarTestLedger();
   * await ledger.start();
   *
   * console.log(await ledger.getContainerIpAddress());
   * ```
   */
  public async getContainerIpAddress(): Promise<string> {
    try {
      return getContainerIpAddress(await this.getContainerInfo());
    } catch (error) {
      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to resolve the container IP address.",
          details:
            "Quickstart could not read the Docker network information for the tracked container.",
          data: { containerId: this.containerId },
          cause: error,
        }),
      );
    }
  }

  /**
   * Builds a Colibri `NetworkConfig` for the running quickstart services.
   *
   * @returns A `NetworkConfig` pointing at Horizon, Soroban RPC, and Friendbot.
   * @throws {CONTAINER_ERROR} If the ledger has not started or the published port is unavailable.
   *
   * @example
   * ```ts
   * const ledger = new StellarTestLedger();
   * await ledger.start();
   *
   * const network = await ledger.getNetworkConfiguration();
   * console.log(network.horizonUrl);
   * ```
   */
  public async getNetworkConfiguration(): Promise<NetworkConfig> {
    try {
      const containerInfo = await this.getContainerInfo();
      const publicPort = getPublicPort(8000, containerInfo);
      const domain = "127.0.0.1";

      return ColibriNetworkConfig.CustomNet({
        networkPassphrase: "Standalone Network ; February 2017",
        rpcUrl: `http://${domain}:${publicPort}/rpc`,
        horizonUrl: `http://${domain}:${publicPort}`,
        friendbotUrl: `http://${domain}:${publicPort}/friendbot`,
        allowHttp: true,
      });
    } catch (error) {
      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to build network configuration for the test ledger.",
          details:
            "Quickstart could not resolve the container port mapping needed to build a Colibri NetworkConfig.",
          data: {
            containerId: this.containerId,
            containerName: this.containerName,
          },
          cause: error,
        }),
      );
    }
  }

  /**
   * Starts the quickstart ledger or attaches to an existing named container.
   *
   * @param omitPull - Skip the Docker image pull step when `true`.
   * @returns The running Docker container instance.
   * @throws {CONTAINER_ERROR} If the named container state is invalid or container lifecycle operations fail.
   * @throws {IMAGE_ERROR} If the quickstart image cannot be pulled.
   *
   * @example
   * ```ts
   * const ledger = new StellarTestLedger({
   *   emitContainerLogs: true,
   * });
   *
   * await ledger.start();
   * ```
   */
  public async start(omitPull = false): Promise<Container> {
    try {
      if (this.useRunningLedger) {
        const containerInfo = await this.findNamedContainer();

        if (!containerInfo) {
          throw new CONTAINER_ERROR({
            message:
              `StellarTestLedger could not find a container named "${this.containerName}".`,
            details:
              "A running container was requested via useRunningLedger, but Docker could not find one with the configured name.",
            data: { containerName: this.containerName },
          });
        }

        this.ensureExpectedNamedContainer(containerInfo);

        if (containerInfo.State !== "running") {
          throw new CONTAINER_ERROR({
            message:
              `StellarTestLedger found "${this.containerName}" but it is not running.`,
            details:
              "A named container exists, but Docker reports that it is not in the running state.",
            data: {
              containerName: this.containerName,
              containerId: containerInfo.Id,
              state: containerInfo.State,
            },
          });
        }

        this.containerId = containerInfo.Id;
        this.container = this.getDockerClient().getContainer(containerInfo.Id);
        return this.container;
      }

      if (this.container) {
        await stopContainer(this.container);
        await this.container.remove({ force: true });
        this.container = undefined;
        this.containerId = undefined;
      }

      const existingNamedContainer = await this.findNamedContainer();
      if (existingNamedContainer) {
        this.ensureExpectedNamedContainer(existingNamedContainer);
        await this.removeContainerById(existingNamedContainer.Id);
      }

      if (!omitPull) {
        await this.pullContainerImage();
      }

      const container = await this.createContainer();
      await container.start();

      this.container = container;
      this.containerId = container.id;

      if (this.emitContainerLogs) {
        await this.streamContainerLogs(container);
      }

      await this.waitUntilReady(container.id);
      return container;
    } catch (error) {
      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to start the Stellar test ledger.",
          details:
            "Quickstart could not finish creating, starting, or preparing the requested test ledger container.",
          data: {
            containerName: this.containerName,
            imageName: this.fullContainerImageName,
            omitPull,
          },
          cause: error,
        }),
      );
    }
  }

  /**
   * Stops the tracked quickstart container without removing it.
   *
   * @returns A promise that resolves after the stop request completes.
   * @throws {CONTAINER_ERROR} If Docker rejects the stop request.
   */
  public async stop(): Promise<void> {
    if (this.useRunningLedger || !this.container) {
      return;
    }

    try {
      await stopContainer(this.container);
    } catch (error) {
      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to stop the Stellar test ledger.",
          details:
            "Docker rejected the stop request for the tracked quickstart container.",
          data: {
            containerName: this.containerName,
            containerId: this.containerId,
          },
          cause: error,
        }),
      );
    }
  }

  /**
   * Removes the tracked quickstart container and any attached named volumes.
   *
   * @returns A promise that resolves after cleanup completes.
   * @throws {CONTAINER_ERROR} If Docker rejects the remove request.
   */
  public async destroy(): Promise<void> {
    if (this.useRunningLedger || !this.containerId) {
      return;
    }

    try {
      await this.removeContainerById(this.containerId);
      this.container = undefined;
      this.containerId = undefined;
    } catch (error) {
      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to destroy the Stellar test ledger.",
          details:
            "Docker rejected the request to remove the tracked quickstart container.",
          data: {
            containerName: this.containerName,
            containerId: this.containerId,
          },
          cause: error,
        }),
      );
    }
  }
}
