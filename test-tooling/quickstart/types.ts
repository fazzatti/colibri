import type Dockerode from "dockerode";
import type { Container } from "dockerode";
import type { LoggerLike, LogLevelDesc } from "@/quickstart/logging.ts";

export { LogLevel } from "@/quickstart/logging.ts";
export type { LoggerLike, LogLevelDesc } from "@/quickstart/logging.ts";
export type { Container };

/**
 * Common moving quickstart tags worth surfacing in IntelliSense.
 *
 * Quickstart also publishes immutable build tags and may introduce new aliases
 * over time, so `containerImageVersion` intentionally remains a free-form
 * string instead of an allow-listed union.
 */
export const QuickstartImageTags = {
  /** Stable software compatible with Mainnet. */
  LATEST: "latest",
  /** Release candidates and stable software compatible with Mainnet and Testnet. */
  TESTING: "testing",
  /** Unstable software generally compatible with Futurenet. */
  FUTURENET: "futurenet",
  /** Unstable software tracking main development branches. */
  NIGHTLY: "nightly",
  /** Unstable software tracking the next protocol branch. */
  NIGHTLY_NEXT: "nightly-next",
} as const;

/**
 * Quickstart image tags accepted by `StellarTestLedger`.
 *
 * Use `QuickstartImageTags` for the common moving tags, or pass any other
 * Docker tag string such as an immutable Quickstart build tag.
 */
export type QuickstartKnownImageTag =
  (typeof QuickstartImageTags)[keyof typeof QuickstartImageTags];

/**
 * Literal-union-plus-string keeps editor suggestions for known tags while
 * still allowing any arbitrary Docker tag string.
 */
export type QuickstartImageVersion =
  | QuickstartKnownImageTag
  | (string & Record<never, never>);

/**
 * Services that can be explicitly enabled through Quickstart's `--enable`
 * option.
 */
export const QuickstartServices = {
  /** Runs Stellar Core. */
  CORE: "core",
  /** Runs Horizon. */
  HORIZON: "horizon",
  /** Runs Soroban RPC. */
  RPC: "rpc",
  /** Serves Stellar Lab and the embedded transaction explorer. */
  LAB: "lab",
  /** Exposes ledger meta for local mode. */
  GALEXIE: "galexie",
} as const;

/**
 * Service names accepted by `enabledServices`.
 */
export type QuickstartService =
  (typeof QuickstartServices)[keyof typeof QuickstartServices];

/**
 * Default services enabled by `StellarTestLedger`.
 *
 * The defaults match the common local development surface: Horizon and RPC,
 * plus the Core dependency they require.
 */
export const DEFAULT_ENABLED_SERVICES = [
  QuickstartServices.CORE,
  QuickstartServices.HORIZON,
  QuickstartServices.RPC,
] as const;

type DefaultEnabledServices = typeof DEFAULT_ENABLED_SERVICES;

/**
 * Storage modes supported by Quickstart containers.
 */
export const QuickstartStorageModes = {
  /** Start Quickstart without a mounted volume. */
  EPHEMERAL: "ephemeral",
  /** Mount a host directory at `/opt/stellar` for persistence. */
  PERSISTENT: "persistent",
} as const;

/**
 * Named storage mode values accepted by `storage.mode`.
 */
export type QuickstartStorageMode =
  (typeof QuickstartStorageModes)[keyof typeof QuickstartStorageModes];

/**
 * Ephemeral mode starts a fresh container without mounting a host volume.
 */
export type EphemeralStorage = {
  readonly mode?: typeof QuickstartStorageModes.EPHEMERAL;
};

/**
 * Persistent mode mounts a host directory into `/opt/stellar`.
 *
 * Quickstart's mounted volume layout can change between image releases, so use
 * persistent mode carefully and prefer pinned image tags when reproducibility
 * matters.
 */
export type PersistentStorage = {
  readonly mode: typeof QuickstartStorageModes.PERSISTENT;
  readonly hostPath: string;
};

/**
 * Storage configuration accepted by `StellarTestLedger`.
 */
export type QuickstartStorage = EphemeralStorage | PersistentStorage;

type IncludesAny<
  Items extends readonly QuickstartService[],
  Candidate extends QuickstartService,
> = [Extract<Candidate, Items[number]>] extends [never] ? false : true;

type HasRpc<Services extends readonly QuickstartService[]> = IncludesAny<
  Services,
  typeof QuickstartServices.RPC
>;

type HasExplicitHorizon<Services extends readonly QuickstartService[]> =
  IncludesAny<Services, typeof QuickstartServices.HORIZON>;

type HasHorizon<
  Network extends NetworkEnv,
  Services extends readonly QuickstartService[],
> = HasExplicitHorizon<Services> extends true ? true
  : Network extends NetworkEnv.LOCAL ? HasRpc<Services>
  : false;

type HasLab<Services extends readonly QuickstartService[]> = IncludesAny<
  Services,
  typeof QuickstartServices.LAB
>;

type HasFriendbot<
  Network extends NetworkEnv,
  Services extends readonly QuickstartService[],
> = Network extends NetworkEnv.LOCAL ? HasHorizon<Network, Services>
  : IncludesAny<
    Services,
    | typeof QuickstartServices.HORIZON
    | typeof QuickstartServices.RPC
    | typeof QuickstartServices.LAB
  >;

type HasLedgerMeta<
  Network extends NetworkEnv,
  Services extends readonly QuickstartService[],
> = Network extends NetworkEnv.LOCAL ? IncludesAny<
    Services,
    typeof QuickstartServices.GALEXIE
  >
  : false;

/**
 * Connection details for a running Quickstart ledger.
 *
 * The returned shape is driven by the selected network and enabled services.
 * To preserve the most specific TypeScript inference, prefer passing
 * `enabledServices` as a `const` tuple.
 */
export type NetworkDetails<
  Network extends NetworkEnv = NetworkEnv.LOCAL,
  Services extends readonly QuickstartService[] = DefaultEnabledServices,
> =
  & {
    /** Stellar network passphrase exposed by the selected Quickstart network. */
    readonly networkPassphrase: string;
    /** Quickstart exposes plain HTTP endpoints locally. */
    readonly allowHttp: true;
  }
  & (HasRpc<Services> extends true ? {
      /** Soroban RPC endpoint. */
      readonly rpcUrl: string;
    }
    : {})
  & (HasHorizon<Network, Services> extends true ? {
      /** Horizon endpoint. */
      readonly horizonUrl: string;
    }
    : {})
  & (HasFriendbot<Network, Services> extends true ? {
      /** Friendbot endpoint. */
      readonly friendbotUrl: string;
    }
    : {})
  & (HasLab<Services> extends true ? {
      /** Stellar Lab endpoint. */
      readonly labUrl: string;
      /** Embedded Lab transaction explorer endpoint. */
      readonly transactionsExplorerUrl: string;
    }
    : {})
  & (HasLedgerMeta<Network, Services> extends true ? {
      /** Local ledger meta endpoint exposed by Galexie. */
      readonly ledgerMetaUrl: string;
    }
    : {});

/**
 * Common interface exposed by quickstart-backed ledgers.
 */
export interface IStellarTestLedger<
  Network extends NetworkEnv = NetworkEnv.LOCAL,
  Services extends readonly QuickstartService[] = DefaultEnabledServices,
> {
  /**
   * Resolves the service details for the running quickstart instance.
   *
   * The returned shape follows the selected network and enabled service tuple.
   */
  getNetworkDetails(): Promise<NetworkDetails<Network, Services>>;

  /**
   * Resolves the service details for the running quickstart instance.
   */
  getNetworkConfiguration(): Promise<NetworkDetails<Network, Services>>;

  /**
   * Returns the tracked Docker container instance.
   *
   * @returns The running Docker container.
   */
  getContainer(): Container;

  /**
   * Returns the container IP address from Docker network inspection data.
   *
   * @returns The first IP address reported by Docker for the container.
   */
  getContainerIpAddress(): Promise<string>;
}

/**
 * Configuration for `StellarTestLedger`.
 */
export interface TestLedgerOptions<
  Network extends NetworkEnv = NetworkEnv.LOCAL,
  Services extends readonly QuickstartService[] = DefaultEnabledServices,
> {
  /**
   * Explicit Dockerode connection options.
   *
   * Common fields:
   * - `socketPath`: Unix socket path such as `/var/run/docker.sock`
   * - `host` / `port` / `protocol`: TCP Docker endpoint settings
   */
  readonly dockerOptions?: Dockerode.DockerOptions;

  /**
   * Explicit Unix socket path to the Docker daemon.
   *
   * When provided, this takes precedence over auto-detected local sockets.
   */
  readonly dockerSocketPath?: string;

  /**
   * Ledger network profile to start.
   *
   * `LOCAL` is fastest and best suited to deterministic tests. `TESTNET` and
   * `FUTURENET` are also supported, but startup can take significantly longer
   * because Quickstart must sync external network state before the exposed
   * services become ready.
   */
  readonly network?: Network;

  /**
   * Soroban resource limits profile to apply for local standalone ledgers.
   *
   * This option is only valid with `NetworkEnv.LOCAL`.
   */
  readonly limits?: ResourceLimits;

  /**
   * Quickstart services to enable explicitly.
   *
   * Use a `const` tuple for the most precise `getNetworkDetails()` return type.
   * Defaults to `DEFAULT_ENABLED_SERVICES`.
   */
  readonly enabledServices?: Services;

  /**
   * Volume mode used by the underlying Quickstart container.
   *
   * Persistent mode mounts `storage.hostPath` to `/opt/stellar`. Quickstart's
   * on-disk layout may change across image releases, so prefer pinned image
   * tags when using persistent mode for anything long-lived.
   */
  readonly storage?: QuickstartStorage;

  /**
   * Reuse an already-running named ledger instead of creating a new container.
   */
  readonly useRunningLedger?: boolean;

  /**
   * Custom logger implementation used for lifecycle diagnostics.
   */
  readonly logger?: LoggerLike;

  /**
   * Minimum level for the built-in fallback logger.
   *
   * Ignored when `logger` is provided.
   */
  readonly logLevel?: LogLevelDesc;

  /**
   * Docker container name to create or reuse.
   *
   * Defaults to `colibri-stellar-test-ledger`.
   */
  readonly containerName?: string;

  /**
   * Docker image repository name.
   *
   * Defaults to `stellar/quickstart`.
   */
  readonly containerImageName?: string;

  /**
   * Docker image tag to use.
   *
   * Use `QuickstartImageTags` for common moving tags such as `latest` or
   * `nightly-next`, or provide any other Docker tag string such as a pinned
   * Quickstart build tag.
   */
  readonly containerImageVersion?: QuickstartImageVersion;

  /**
   * Stream container stdout/stderr into the configured logger.
   */
  readonly emitContainerLogs?: boolean;
}

/**
 * Soroban resource profiles accepted by Stellar Quickstart.
 */
export enum ResourceLimits {
  /** Matches the resource profile used by Stellar Testnet. */
  TESTNET = "testnet",
  /** Leaves Stellar Core's default local limits in place. */
  DEFAULT = "default",
  /** Sets the highest available limits for local experimentation. */
  UNLIMITED = "unlimited",
}

/**
 * Network modes supported by Stellar Quickstart.
 */
export enum NetworkEnv {
  /** Starts a fresh local standalone ledger. */
  LOCAL = "local",
  /** Connects Quickstart to Futurenet. */
  FUTURENET = "futurenet",
  /** Connects Quickstart to Testnet. */
  TESTNET = "testnet",
}
