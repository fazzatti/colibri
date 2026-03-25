import { isAbsolute } from "node:path";
import type {
  Container,
  ContainerCreateOptions,
  ContainerInfo,
} from "dockerode";
import {
  createDockerClient,
  type DockerConnectionConfig,
  resolveDockerOptions,
  resolvePublishedPortHost,
} from "@/quickstart/docker.ts";
import {
  CONTAINER_ERROR,
  INVALID_CONFIGURATION,
  QuickstartError,
} from "@/quickstart/error.ts";
import {
  type ContainerInspectInfo,
  findContainerByName,
  getContainerIpAddress,
  getPublicPort,
  pullImage,
  removeContainerAndVolumes,
  stopContainer,
  streamContainerLogs,
  waitForLedgerReady,
} from "@/quickstart/runtime.ts";
import {
  DEFAULT_ENABLED_SERVICES,
  type IStellarTestLedger,
  type NetworkDetails,
  NetworkEnv,
  type PersistentStorage,
  QuickstartImageTags,
  type QuickstartImageVersion,
  type QuickstartService,
  QuickstartServices,
  type QuickstartStorage,
  QuickstartStorageModes,
  ResourceLimits,
  type TestLedgerOptions,
} from "@/quickstart/types.ts";
import {
  createLogger,
  type LoggerLike,
  type LogLevelDesc,
} from "@/quickstart/logging.ts";

const DEFAULTS = Object.freeze({
  containerName: "colibri-stellar-test-ledger",
  imageName: "stellar/quickstart",
  imageVersion: QuickstartImageTags.LATEST,
  network: NetworkEnv.LOCAL,
  limits: ResourceLimits.TESTNET,
  useRunningLedger: false,
  logLevel: "info" as LogLevelDesc,
  emitContainerLogs: false,
  storage: {
    mode: QuickstartStorageModes.EPHEMERAL,
  } as const satisfies QuickstartStorage,
});

const NETWORK_FLAGS = Object.freeze(
  {
    [NetworkEnv.LOCAL]: "--local",
    [NetworkEnv.TESTNET]: "--testnet",
    [NetworkEnv.FUTURENET]: "--futurenet",
  } satisfies Record<NetworkEnv, string>,
);

const NETWORK_PASSPHRASES = Object.freeze(
  {
    [NetworkEnv.LOCAL]: "Standalone Network ; February 2017",
    [NetworkEnv.TESTNET]: "Test SDF Network ; September 2015",
    [NetworkEnv.FUTURENET]: "Test SDF Future Network ; October 2022",
  } satisfies Record<NetworkEnv, string>,
);

const VALID_SERVICES = new Set<string>(Object.values(QuickstartServices));
const VALID_NETWORK_FLAGS = new Set<string>(Object.values(NETWORK_FLAGS));
const HTTP_EXPOSED_SERVICES = new Set<string>([
  QuickstartServices.HORIZON,
  QuickstartServices.RPC,
  QuickstartServices.LAB,
  QuickstartServices.GALEXIE,
]);

type ReadinessChecks = {
  readonly horizon: boolean;
  readonly rpc: boolean;
  readonly friendbot: boolean;
  readonly lab: boolean;
  readonly ledgerMeta: boolean;
};

const isBooleanStrict = (value: unknown): value is boolean => {
  return typeof value === "boolean";
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isPersistentStorage = (
  storage: QuickstartStorage,
): storage is PersistentStorage => {
  return storage.mode === QuickstartStorageModes.PERSISTENT;
};

const ensureQuickstartError = <T extends QuickstartError>(
  error: unknown,
  fallback: T,
): T | QuickstartError => {
  if (error instanceof QuickstartError) {
    return error;
  }

  return fallback;
};

const normalizeStringOption = (
  options: Record<string, unknown> | undefined,
  option: "containerName" | "containerImageName",
  fallback: string,
  details: string,
): string => {
  const rawValue = options?.[option];

  if (rawValue === undefined) {
    return fallback;
  }

  if (typeof rawValue !== "string") {
    throw new INVALID_CONFIGURATION({
      option,
      value: rawValue,
      message: `StellarTestLedger#constructor() ${option} must be a string.`,
      details,
    });
  }

  const value = rawValue.trim();
  return value || fallback;
};

const normalizeImageVersion = (options?: Record<string, unknown>): string => {
  if (options && Object.hasOwn(options, "customContainerImageVersion")) {
    throw new INVALID_CONFIGURATION({
      option: "customContainerImageVersion",
      value: options.customContainerImageVersion,
      message:
        "StellarTestLedger#constructor() customContainerImageVersion is no longer supported.",
      details:
        "Pass any quickstart tag string directly through containerImageVersion instead of using a second image-version option.",
    });
  }

  const rawImageVersion = options?.containerImageVersion;
  if (rawImageVersion === undefined) {
    return DEFAULTS.imageVersion;
  }

  if (typeof rawImageVersion !== "string") {
    throw new INVALID_CONFIGURATION({
      option: "containerImageVersion",
      value: rawImageVersion,
      message:
        "StellarTestLedger#constructor() containerImageVersion must be a string.",
      details:
        "Provide a Docker image tag string such as QuickstartImageTags.LATEST or a pinned build tag.",
    });
  }

  const containerImageVersion = rawImageVersion.trim();
  if (!containerImageVersion) {
    throw new INVALID_CONFIGURATION({
      option: "containerImageVersion",
      value: rawImageVersion,
      message:
        "StellarTestLedger#constructor() containerImageVersion must not be empty.",
      details:
        "Provide a non-empty Docker image tag when selecting a quickstart image variant.",
    });
  }

  return containerImageVersion;
};

const normalizeNetwork = (value: unknown): NetworkEnv => {
  const network = value ?? DEFAULTS.network;

  if (
    typeof network !== "string" ||
    !Object.values(NetworkEnv).includes(network as NetworkEnv)
  ) {
    throw new INVALID_CONFIGURATION({
      option: "network",
      value: network,
      supportedValues: Object.values(NetworkEnv),
      message: `StellarTestLedger#constructor() network ${
        String(network)
      } not supported.`,
      details:
        "Use one of the documented Quickstart network environments when constructing a test ledger.",
    });
  }

  return network as NetworkEnv;
};

const normalizeLimits = (
  network: NetworkEnv,
  value: unknown,
): ResourceLimits | undefined => {
  if (network !== NetworkEnv.LOCAL) {
    if (value !== undefined) {
      throw new INVALID_CONFIGURATION({
        option: "limits",
        value,
        message:
          `StellarTestLedger#constructor() limits are only supported for ${NetworkEnv.LOCAL}.`,
        details:
          "Quickstart resource limit profiles only apply to the local standalone network mode.",
      });
    }

    return undefined;
  }

  const limits = value ?? DEFAULTS.limits;
  if (
    typeof limits !== "string" ||
    !Object.values(ResourceLimits).includes(limits as ResourceLimits)
  ) {
    throw new INVALID_CONFIGURATION({
      option: "limits",
      value: limits,
      supportedValues: Object.values(ResourceLimits),
      message: `StellarTestLedger#constructor() limits ${
        String(limits)
      } not supported.`,
      details:
        "Use one of the documented local Soroban resource limit presets when configuring Quickstart.",
    });
  }

  return limits as ResourceLimits;
};

const normalizeEnabledServices = (
  network: NetworkEnv,
  value: unknown,
): QuickstartService[] => {
  const rawServices = value ?? DEFAULT_ENABLED_SERVICES;

  if (!Array.isArray(rawServices)) {
    throw new INVALID_CONFIGURATION({
      option: "enabledServices",
      value: rawServices,
      message:
        "StellarTestLedger#constructor() enabledServices must be an array.",
      details:
        "Provide a list of Quickstart service names such as QuickstartServices.RPC or QuickstartServices.LAB.",
    });
  }

  const enabledServices: QuickstartService[] = [];
  const seen = new Set<string>();

  for (const rawService of rawServices) {
    if (typeof rawService !== "string") {
      throw new INVALID_CONFIGURATION({
        option: "enabledServices",
        value: rawService,
        supportedValues: Object.values(QuickstartServices),
        message:
          "StellarTestLedger#constructor() enabledServices entries must be strings.",
        details:
          "Use Quickstart service names such as QuickstartServices.RPC when selecting services.",
      });
    }

    const service = rawService.trim();
    if (!service || !VALID_SERVICES.has(service)) {
      throw new INVALID_CONFIGURATION({
        option: "enabledServices",
        value: rawService,
        supportedValues: Object.values(QuickstartServices),
        message: `StellarTestLedger#constructor() service ${
          String(rawService)
        } not supported.`,
        details:
          "Use only documented Quickstart service names when selecting enabled services.",
      });
    }

    if (!seen.has(service)) {
      enabledServices.push(service as QuickstartService);
      seen.add(service);
    }
  }

  if (enabledServices.length < 1) {
    throw new INVALID_CONFIGURATION({
      option: "enabledServices",
      value: rawServices,
      supportedValues: Object.values(QuickstartServices),
      message:
        "StellarTestLedger#constructor() enabledServices must not be empty.",
      details:
        "Enable at least one Quickstart service when creating a test ledger.",
    });
  }

  if (
    !enabledServices.some((service) => HTTP_EXPOSED_SERVICES.has(service))
  ) {
    throw new INVALID_CONFIGURATION({
      option: "enabledServices",
      value: enabledServices,
      supportedValues: Object.values(QuickstartServices),
      message:
        "StellarTestLedger#constructor() enabledServices must include at least one HTTP-exposed service.",
      details:
        "This harness builds service details from Quickstart's HTTP surface, so a core-only configuration is not currently supported.",
    });
  }

  if (
    network !== NetworkEnv.LOCAL &&
    enabledServices.includes(QuickstartServices.GALEXIE)
  ) {
    throw new INVALID_CONFIGURATION({
      option: "enabledServices",
      value: enabledServices,
      message:
        "StellarTestLedger#constructor() galexie is only supported on the local network.",
      details:
        "Quickstart only exposes ledger meta exports for local mode, so galexie cannot be enabled on testnet or futurenet.",
    });
  }

  if (
    enabledServices.includes(QuickstartServices.GALEXIE) &&
    !enabledServices.includes(QuickstartServices.RPC)
  ) {
    throw new INVALID_CONFIGURATION({
      option: "enabledServices",
      value: enabledServices,
      message:
        "StellarTestLedger#constructor() galexie requires rpc to be enabled.",
      details:
        "Enable QuickstartServices.RPC alongside QuickstartServices.GALEXIE to expose local ledger meta in a usable setup.",
    });
  }

  return enabledServices;
};

const normalizeStorage = (value: unknown): QuickstartStorage => {
  if (value === undefined) {
    return {
      mode: QuickstartStorageModes.EPHEMERAL,
    };
  }

  if (!isObject(value)) {
    throw new INVALID_CONFIGURATION({
      option: "storage",
      value,
      message: "StellarTestLedger#constructor() storage must be an object.",
      details:
        "Provide a storage configuration object when switching between ephemeral and persistent Quickstart modes.",
    });
  }

  const mode = value.mode ?? QuickstartStorageModes.EPHEMERAL;
  if (
    mode !== QuickstartStorageModes.EPHEMERAL &&
    mode !== QuickstartStorageModes.PERSISTENT
  ) {
    throw new INVALID_CONFIGURATION({
      option: "storage.mode",
      value: mode,
      supportedValues: Object.values(QuickstartStorageModes),
      message: `StellarTestLedger#constructor() storage mode ${
        String(mode)
      } not supported.`,
      details:
        "Use QuickstartStorageModes.EPHEMERAL or QuickstartStorageModes.PERSISTENT when configuring storage.",
    });
  }

  if (mode === QuickstartStorageModes.EPHEMERAL) {
    if (value.hostPath !== undefined) {
      throw new INVALID_CONFIGURATION({
        option: "storage.hostPath",
        value: value.hostPath,
        message:
          "StellarTestLedger#constructor() storage.hostPath is only valid in persistent mode.",
        details:
          "Remove storage.hostPath or switch storage.mode to QuickstartStorageModes.PERSISTENT.",
      });
    }

    return {
      mode: QuickstartStorageModes.EPHEMERAL,
    };
  }

  if (typeof value.hostPath !== "string") {
    throw new INVALID_CONFIGURATION({
      option: "storage.hostPath",
      value: value.hostPath,
      message:
        "StellarTestLedger#constructor() storage.hostPath must be a string in persistent mode.",
      details:
        "Provide an absolute host directory path to mount into /opt/stellar when using persistent mode.",
    });
  }

  const hostPath = value.hostPath.trim();
  if (!hostPath) {
    throw new INVALID_CONFIGURATION({
      option: "storage.hostPath",
      value: value.hostPath,
      message:
        "StellarTestLedger#constructor() storage.hostPath must not be empty in persistent mode.",
      details:
        "Provide a non-empty absolute host directory path when mounting persistent Quickstart state.",
    });
  }

  if (!isAbsolute(hostPath)) {
    throw new INVALID_CONFIGURATION({
      option: "storage.hostPath",
      value: value.hostPath,
      message:
        "StellarTestLedger#constructor() storage.hostPath must be an absolute path.",
      details:
        "Quickstart persistent mode requires an absolute host directory mounted at /opt/stellar.",
    });
  }

  return {
    mode: QuickstartStorageModes.PERSISTENT,
    hostPath,
  };
};

const hasService = (
  services: readonly QuickstartService[],
  service: QuickstartService,
): boolean => {
  return services.includes(service);
};

const resolveReadinessChecks = (
  network: NetworkEnv,
  enabledServices: readonly QuickstartService[],
): ReadinessChecks => {
  const rpc = hasService(enabledServices, QuickstartServices.RPC);
  const horizon = hasService(enabledServices, QuickstartServices.HORIZON) ||
    (network === NetworkEnv.LOCAL && rpc);
  const lab = hasService(enabledServices, QuickstartServices.LAB);
  const ledgerMeta = network === NetworkEnv.LOCAL &&
    hasService(enabledServices, QuickstartServices.GALEXIE);
  const friendbot = network === NetworkEnv.LOCAL
    ? horizon
    : horizon || rpc || lab;

  return {
    horizon,
    rpc,
    friendbot,
    lab,
    ledgerMeta,
  };
};

const buildQuickstartCommand = (
  network: NetworkEnv,
  limits: ResourceLimits | undefined,
  enabledServices: readonly QuickstartService[],
): string[] => {
  const command = [NETWORK_FLAGS[network]];

  if (network === NetworkEnv.LOCAL && limits) {
    command.push("--limits", limits);
  }

  command.push("--enable", enabledServices.join(","));

  return command;
};

type ParsedQuickstartCommand = {
  readonly networkFlag: string;
  readonly limits?: string;
  readonly enabledServices: ReadonlySet<string>;
};

const parseQuickstartCommand = (
  command: readonly string[],
): ParsedQuickstartCommand | null => {
  let networkFlag: string | undefined;
  let limits: string | undefined;
  let enabledServices: ReadonlySet<string> | undefined;

  for (let index = 0; index < command.length;) {
    const token = command[index];

    if (VALID_NETWORK_FLAGS.has(token)) {
      if (networkFlag) {
        return null;
      }

      networkFlag = token;
      index += 1;
      continue;
    }

    if (token === "--limits") {
      if (limits !== undefined || index + 1 >= command.length) {
        return null;
      }

      limits = command[index + 1];
      index += 2;
      continue;
    }

    if (token === "--enable") {
      if (enabledServices !== undefined || index + 1 >= command.length) {
        return null;
      }

      const services = command[index + 1].split(",")
        .map((service) => service.trim())
        .filter(Boolean);

      if (
        services.length === 0 ||
        services.some((service) => !VALID_SERVICES.has(service))
      ) {
        return null;
      }

      enabledServices = new Set(services);
      index += 2;
      continue;
    }

    return null;
  }

  if (!networkFlag || !enabledServices) {
    return null;
  }

  return {
    networkFlag,
    limits,
    enabledServices,
  };
};

const commandsMatch = (
  expected: readonly string[],
  actual: readonly string[],
): boolean => {
  const parsedExpected = parseQuickstartCommand(expected);
  const parsedActual = parseQuickstartCommand(actual);

  return parsedExpected !== null &&
    parsedActual !== null &&
    parsedExpected.networkFlag === parsedActual.networkFlag &&
    parsedExpected.limits === parsedActual.limits &&
    parsedExpected.enabledServices.size === parsedActual.enabledServices.size &&
    [...parsedExpected.enabledServices].every((service) =>
      parsedActual.enabledServices.has(service)
    );
};

/**
 * Manages a Docker-backed Stellar Quickstart instance for tests.
 *
 * The class can either start a new container or attach to an already-running
 * named container. Once started, it exposes the service details for the
 * selected Quickstart network and enabled service set.
 *
 * `LOCAL` is the fastest and most deterministic mode. `TESTNET` and
 * `FUTURENET` are also supported, but startup can take longer because
 * Quickstart must sync the external network before Horizon, RPC, Friendbot, or
 * Lab become ready.
 *
 * @example
 * ```ts
 * import {
 *   QuickstartImageTags,
 *   QuickstartServices,
 *   StellarTestLedger,
 * } from "jsr:@colibri/test-tooling";
 *
 * const ledger = new StellarTestLedger({
 *   containerImageVersion: QuickstartImageTags.TESTING,
 *   enabledServices: [
 *     QuickstartServices.CORE,
 *     QuickstartServices.HORIZON,
 *     QuickstartServices.RPC,
 *     QuickstartServices.LAB,
 *   ] as const,
 * });
 *
 * await ledger.start();
 * const details = await ledger.getNetworkDetails();
 *
 * console.log(details.rpcUrl);
 * console.log(details.labUrl);
 *
 * await ledger.stop();
 * await ledger.destroy();
 * ```
 */
export class StellarTestLedger<
  const Network extends NetworkEnv = typeof DEFAULTS.network,
  const Services extends readonly QuickstartService[] =
    typeof DEFAULT_ENABLED_SERVICES,
> implements IStellarTestLedger<Network, Services> {
  /** The Docker container name managed by this ledger instance. */
  public readonly containerName: string;

  /** The Docker image repository used to start the ledger. */
  public readonly containerImageName: string;

  /** The Docker image tag used to start the ledger. */
  public readonly containerImageVersion: QuickstartImageVersion;

  /** The selected Quickstart network mode. */
  public readonly network: Network;

  /** The selected local resource profile, when applicable. */
  public readonly limits: ResourceLimits | undefined;

  /** The services explicitly enabled for this Quickstart container. */
  public readonly enabledServices: readonly QuickstartService[];

  /** The selected Quickstart storage mode. */
  public readonly storage: QuickstartStorage;

  private readonly useRunningLedger: boolean;
  private readonly emitContainerLogs: boolean;
  private readonly log: LoggerLike;
  private readonly logLevel: LogLevelDesc;
  private readonly dockerConnection: DockerConnectionConfig;
  private readonly quickstartCommand: string[];
  private readonly readinessChecks: ReadinessChecks;
  private dockerClientCache: ReturnType<typeof createDockerClient> | undefined;

  /** The currently tracked Docker container, if one has been started or attached. */
  public container: Container | undefined;

  /** The Docker container ID for the tracked container, if available. */
  public containerId: string | undefined;

  /**
   * Creates a new quickstart ledger manager.
   *
   * @param options - Ledger startup options.
   *   - `containerImageVersion`: Any quickstart Docker tag string. Use
   *     `QuickstartImageTags` for the common moving tags.
   *   - `network`: `LOCAL`, `TESTNET`, or `FUTURENET`.
   *   - `enabledServices`: Explicit `--enable` service list. Use a `const`
   *     tuple for the most precise `getNetworkDetails()` type inference.
   *   - `storage`: Ephemeral or persistent mode configuration.
   *   - `dockerOptions` / `dockerSocketPath`: Explicit Docker connection
   *     settings.
   *   - `useRunningLedger`: Reuse an existing named container instead of
   *     creating one.
   *   - `emitContainerLogs`: Forward container logs to the configured logger.
   *   - `logger` / `logLevel`: Logging configuration for lifecycle diagnostics.
   * @returns A configured `StellarTestLedger` instance.
   * @throws {INVALID_CONFIGURATION} If an unsupported network, service,
   *   storage, or image value is provided.
   */
  constructor(options?: TestLedgerOptions<Network, Services>) {
    const rawOptions = options && isObject(options)
      ? (options as Record<string, unknown>)
      : undefined;

    const network = normalizeNetwork(rawOptions?.network) as Network;
    const limits = normalizeLimits(network, rawOptions?.limits);
    const enabledServices = normalizeEnabledServices(
      network,
      rawOptions?.enabledServices,
    );
    const storage = normalizeStorage(rawOptions?.storage);

    this.network = network;
    this.limits = limits;
    this.enabledServices = enabledServices;
    this.storage = storage;
    this.containerImageVersion = normalizeImageVersion(rawOptions);

    this.containerName = normalizeStringOption(
      rawOptions,
      "containerName",
      DEFAULTS.containerName,
      "Provide a Docker container name string or omit the option to use the default quickstart container name.",
    );
    this.containerImageName = normalizeStringOption(
      rawOptions,
      "containerImageName",
      DEFAULTS.imageName,
      "Provide a Docker image repository string such as stellar/quickstart or omit the option to use the default quickstart image name.",
    );
    this.useRunningLedger = isBooleanStrict(options?.useRunningLedger)
      ? options.useRunningLedger
      : DEFAULTS.useRunningLedger;
    this.logLevel = options?.logLevel ?? DEFAULTS.logLevel;
    this.emitContainerLogs = isBooleanStrict(options?.emitContainerLogs)
      ? options.emitContainerLogs
      : DEFAULTS.emitContainerLogs;
    this.readinessChecks = resolveReadinessChecks(network, enabledServices);
    this.quickstartCommand = buildQuickstartCommand(
      network,
      limits,
      enabledServices,
    );
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
  protected getDockerClient(): ReturnType<typeof createDockerClient> {
    return this.dockerClientCache ??= createDockerClient(this.dockerConnection);
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
   * Ensures a reused named container was started with the expected quickstart flags.
   */
  protected ensureExpectedNamedContainerConfig(
    inspectInfo: ContainerInspectInfo,
  ): void {
    const actualCommand = inspectInfo.Config.Cmd;

    if (!Array.isArray(actualCommand)) {
      throw new CONTAINER_ERROR({
        message:
          `StellarTestLedger could not validate the quickstart command for "${this.containerName}".`,
        details:
          "Docker inspection did not expose the container command needed to verify the reused quickstart configuration.",
        data: {
          containerName: this.containerName,
          containerId: inspectInfo.Id,
          expectedCommand: this.quickstartCommand,
        },
      });
    }

    if (!commandsMatch(this.quickstartCommand, actualCommand)) {
      throw new CONTAINER_ERROR({
        message:
          `StellarTestLedger found "${this.containerName}" with a different quickstart configuration.`,
        details:
          "A running container matched the requested name and image, but it was started with different quickstart flags than this ledger instance expects.",
        data: {
          containerName: this.containerName,
          containerId: inspectInfo.Id,
          expectedCommand: this.quickstartCommand,
          actualCommand,
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
   * Waits until the requested quickstart services are ready.
   */
  protected async waitUntilReady(containerId: string): Promise<void> {
    await waitForLedgerReady({
      containerId,
      readiness: this.readinessChecks,
      ...this.dockerConnection,
      dockerClient: this.getDockerClient() as never,
    });
  }

  /**
   * Creates the Docker container definition for the quickstart image.
   */
  protected async createContainer(): Promise<Container> {
    const hostConfig: NonNullable<ContainerCreateOptions["HostConfig"]> = {
      PublishAllPorts: true,
    };

    if (isPersistentStorage(this.storage)) {
      hostConfig.Binds = [`${this.storage.hostPath}:/opt/stellar`];
    }

    const createOptions: ContainerCreateOptions = {
      name: this.containerName,
      Image: this.fullContainerImageName,
      Cmd: [...this.quickstartCommand],
      ExposedPorts: {
        "8000/tcp": {},
      },
      HostConfig: hostConfig,
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
   * @throws {CONTAINER_ERROR} If this ledger instance has not started or
   *   attached to a container yet.
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
   * @throws {CONTAINER_ERROR} If the ledger has not started or Docker
   *   inspection fails.
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
   * Builds the service details for the running quickstart services.
   *
   * The returned object is shaped by the configured network and enabled
   * service tuple. Use `enabledServices` with `as const` when you want the
   * resulting type to include only the URLs guaranteed by that selection.
   *
   * @returns The plain connection payload for the running ledger.
   * @throws {CONTAINER_ERROR} If the ledger has not started or the published
   *   port is unavailable.
   */
  public async getNetworkDetails(): Promise<NetworkDetails<Network, Services>> {
    try {
      const containerInfo = await this.getContainerInfo();
      const publicPort = getPublicPort(8000, containerInfo);
      const domain = resolvePublishedPortHost(this.dockerConnection);
      const baseUrl = `http://${domain}:${publicPort}`;
      const details: Record<string, unknown> = {
        networkPassphrase: NETWORK_PASSPHRASES[this.network],
        allowHttp: true,
      };

      if (this.readinessChecks.horizon) {
        details.horizonUrl = baseUrl;
      }

      if (this.readinessChecks.rpc) {
        details.rpcUrl = `${baseUrl}/rpc`;
      }

      if (this.readinessChecks.friendbot) {
        details.friendbotUrl = `${baseUrl}/friendbot`;
      }

      if (this.readinessChecks.lab) {
        details.labUrl = `${baseUrl}/lab`;
        details.transactionsExplorerUrl =
          `${baseUrl}/lab/transactions-explorer`;
      }

      if (this.readinessChecks.ledgerMeta) {
        details.ledgerMetaUrl = `${baseUrl}/ledger-meta`;
      }

      return details as NetworkDetails<Network, Services>;
    } catch (error) {
      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to build network details for the test ledger.",
          details:
            "Quickstart could not resolve the container port mapping needed to build the network details payload.",
          data: {
            containerId: this.containerId,
            containerName: this.containerName,
            network: this.network,
            enabledServices: this.enabledServices,
          },
          cause: error,
        }),
      );
    }
  }

  /**
   * Resolves the service details for the running quickstart services.
   */
  public async getNetworkConfiguration(): Promise<
    NetworkDetails<Network, Services>
  > {
    return await this.getNetworkDetails();
  }

  /**
   * Starts the quickstart ledger or attaches to an existing named container.
   *
   * @param omitPull - Skip the Docker image pull step when `true`.
   * @returns The running Docker container instance.
   * @throws {CONTAINER_ERROR} If the named container state is invalid or
   *   container lifecycle operations fail.
   */
  public async start(omitPull = false): Promise<Container> {
    let createdContainer: Container | undefined;

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

        const reusedContainer = this.getDockerClient().getContainer(
          containerInfo.Id,
        );
        const inspectInfo = await reusedContainer.inspect() as ContainerInspectInfo;
        this.ensureExpectedNamedContainerConfig(inspectInfo);
        const publishedPorts = inspectInfo.NetworkSettings.Ports?.["8000/tcp"];

        this.containerId = containerInfo.Id;
        this.container = reusedContainer;

        // Reused ledgers may be reachable only through Docker/container
        // networking. Only run HTTP readiness checks when Docker published the
        // quickstart port for the named container.
        if (publishedPorts && publishedPorts.length > 0) {
          await this.waitUntilReady(containerInfo.Id);
        }

        return this.container;
      }

      if (this.container) {
        const trackedContainerId = this.containerId ||
          (this.container as { id?: string }).id;

        if (trackedContainerId) {
          await this.removeContainerById(trackedContainerId);
        } else {
          await stopContainer(this.container);
          await this.container.remove({ v: true, force: true });
        }

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
      createdContainer = container;
      this.container = container;
      this.containerId = container.id;

      await container.start();

      if (this.emitContainerLogs) {
        await this.streamContainerLogs(container);
      }

      await this.waitUntilReady(container.id);
      return container;
    } catch (error) {
      if (createdContainer) {
        try {
          if (createdContainer.id) {
            await this.removeContainerById(createdContainer.id);
          } else {
            await createdContainer.remove({ v: true, force: true });
          }
        } catch {
          // Startup cleanup is best-effort; preserve the original startup error.
        } finally {
          if (this.container === createdContainer) {
            this.container = undefined;
          }
          if (this.containerId === createdContainer.id) {
            this.containerId = undefined;
          }
        }
      }

      throw ensureQuickstartError(
        error,
        new CONTAINER_ERROR({
          message: "Failed to start the Stellar test ledger.",
          details:
            "Quickstart could not finish creating, starting, or preparing the requested test ledger container.",
          data: {
            containerName: this.containerName,
            imageName: this.fullContainerImageName,
            network: this.network,
            enabledServices: this.enabledServices,
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
    if (this.useRunningLedger || (!this.containerId && !this.container)) {
      return;
    }

    try {
      if (this.containerId) {
        await this.removeContainerById(this.containerId);
      } else if (this.container) {
        await this.container.remove({ v: true, force: true });
      }

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
