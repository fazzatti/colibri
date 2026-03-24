import type Dockerode from "dockerode";
import type { Container } from "dockerode";
import type { LoggerLike, LogLevelDesc } from "@/quickstart/logging.ts";

export { LogLevel } from "@/quickstart/logging.ts";
export type { LoggerLike, LogLevelDesc } from "@/quickstart/logging.ts";
export type { Container };

/**
 * Connection details for a running quickstart ledger.
 */
export interface NetworkDetails {
  /** Stellar standalone network passphrase exposed by quickstart. */
  readonly networkPassphrase: string;
  /** Soroban RPC endpoint. */
  readonly rpcUrl: string;
  /** Horizon endpoint. */
  readonly horizonUrl: string;
  /** Friendbot endpoint. */
  readonly friendbotUrl: string;
  /** Quickstart exposes plain HTTP endpoints locally. */
  readonly allowHttp: true;
}

/**
 * Common interface exposed by quickstart-backed ledgers.
 */
export interface IStellarTestLedger {
  /**
   * Resolves the network details for the running quickstart instance.
   *
   * @returns The plain connection payload for the running ledger.
   */
  getNetworkDetails(): Promise<NetworkDetails>;

  /**
   * Resolves the network details for the running quickstart instance.
   *
   * @deprecated Use `getNetworkDetails()` instead.
   */
  getNetworkConfiguration(): Promise<NetworkDetails>;

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
export interface TestLedgerOptions {
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
   * Only `NetworkEnv.LOCAL` is currently supported.
   */
  readonly network?: NetworkEnv;

  /**
   * Soroban resource limits profile to apply.
   *
   * Only `ResourceLimits.TESTNET` is currently supported.
   */
  readonly limits?: ResourceLimits;

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
   * Supported tags are listed in `SupportedImageVersions`.
   */
  readonly containerImageVersion?: SupportedImageVersions;

  /**
   * Custom Docker image tag to use instead of a supported preset.
   *
   * Mutually exclusive with `containerImageVersion`.
   */
  readonly customContainerImageVersion?: string;

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

/**
 * Quickstart image tags known to be supported by this package.
 */
export enum SupportedImageVersions {
  /** Tracks the latest published quickstart image. */
  LATEST = "latest",
  /** Tracks the latest `v425` quickstart build. */
  V425_LATEST = "v425-latest",
  /** Tracks the latest `pr757` quickstart build. */
  PR757_LATEST = "pr757-latest",
}
