import Docker, {
  type Container,
  type ContainerCreateOptions,
  type ContainerInfo,
} from "dockerode";

import { Containers } from "./containers/index.ts";
import type EventEmitter from "node:events";

import {
  type IStellarTestLedger,
  NetworkEnv,
  ResourceLimits,
  SupportedImageVersions,
  type TestLedgerOptions,
} from "./types.ts";

import { type NetworkConfig, CustomNet, helpers } from "@colibri/core";
import type { LogLevelDesc } from "../logger/types.ts";
import { Logger } from "../logger/index.ts";
const { isBooleanStrict } = helpers.boolean;

const DEFAULTS = Object.freeze({
  imageName: "stellar/quickstart",
  imageVersion: SupportedImageVersions.LASTEST,
  network: NetworkEnv.LOCAL,
  limits: ResourceLimits.TESTNET,
  useRunningLedger: false,
  logLevel: "info" as LogLevelDesc,
  emitContainerLogs: false,
});

/**
 * This class provides the functionality to start and stop a test stellar ledger.
 * The ledger is started as a docker container and can be configured to run on different networks.
 *
 * @param {IStellarTestLedgerOptions} options - Options for the test stellar ledger.
 * @param {Network} options.network - Defines which type of network will the image will be configured to run.
 * @param {ResourceLimits} options.limits - Defines the resource limits for soroban transactions.
 * @param {boolean} options.useRunningLedger - For test development, attach to ledger that is already running, don't spin up new one.
 * @param {LogLevelDesc} options.logLevel - The log level for the test stellar ledger.
 * @param {string} options.containerImageName - The name of the container image to use for the test stellar ledger.
 * @param {SupportedImageVersions | string} options.containerImageVersion - The version of the container image to use for the test stellar ledger.
 * @param {boolean} options.emitContainerLogs - If true, the container logs will be emitted.
 *
 */
export class StellarTestLedger implements IStellarTestLedger {
  public readonly containerImageName: string;
  public readonly containerImageVersion: SupportedImageVersions | string;

  private readonly network: string;
  private readonly limits: string;
  private readonly useRunningLedger: boolean;

  private readonly emitContainerLogs: boolean;
  private readonly log: Logger;
  private readonly logLevel: LogLevelDesc;
  public container: Container | undefined;
  public containerId: string | undefined;

  constructor(options?: TestLedgerOptions) {
    this.network = options?.network || DEFAULTS.network;
    this.limits = options?.limits || DEFAULTS.limits;

    if (this.network != NetworkEnv.LOCAL) {
      throw new Error(
        `StellarTestLedger#constructor() network ${this.network} not supported yet.`
      );
    }
    if (this.limits != ResourceLimits.TESTNET) {
      throw new Error(
        `StellarTestLedger#constructor() limits ${this.limits} not supported yet.`
      );
    }

    this.containerImageVersion =
      options?.containerImageVersion || DEFAULTS.imageVersion;

    // if image name is not a supported version
    if (
      !Object.values(SupportedImageVersions).includes(
        this.containerImageVersion as SupportedImageVersions
      )
    ) {
      throw new Error(
        `StellarTestLedger#constructor() containerImageVersion ${options?.containerImageVersion} not supported.`
      );
    }

    this.containerImageName = options?.containerImageName || DEFAULTS.imageName;

    this.useRunningLedger = isBooleanStrict(options?.useRunningLedger)
      ? (options?.useRunningLedger as boolean)
      : DEFAULTS.useRunningLedger;

    this.logLevel = options?.logLevel || DEFAULTS.logLevel;
    this.emitContainerLogs = isBooleanStrict(options?.emitContainerLogs)
      ? (options?.emitContainerLogs as boolean)
      : DEFAULTS.emitContainerLogs;

    this.log = new Logger({
      level: this.logLevel,
      label: "StellarTestLedger",
    });

    this.log.debug("Initialized");
  }

  /**
   * Get the full container image name.
   *
   * @returns {string} Full container image name
   */
  public get fullContainerImageName(): string {
    return [this.containerImageName, this.containerImageVersion].join(":");
  }

  public getContainer(): Container {
    if (!this.container) {
      throw new Error(
        `StellarTestLedger#getContainer() Container not started yet by this instance.`
      );
    } else {
      return this.container;
    }
  }

  /**
   *
   * Get the container information for the test stellar ledger.
   *
   * @returns {ContainerInfo} Container information
   */
  protected async getContainerInfo(): Promise<ContainerInfo> {
    const fnTag = "StellarTestLedger#getContainerInfo()";
    const docker = new Docker();
    const image = this.containerImageName;
    const containerInfos = await docker.listContainers({});

    let aContainerInfo;
    if (this.containerId !== undefined) {
      aContainerInfo = containerInfos.find(
        (ci: { Id: string | undefined }) => ci.Id === this.containerId
      );
    }

    if (aContainerInfo) {
      return aContainerInfo;
    } else {
      throw new Error(`${fnTag} no image "${image}"`);
    }
  }

  /**
   *
   * Get the IP address of the container.
   *
   * @returns {string} IP address of the container
   */
  public async getContainerIpAddress(): Promise<string> {
    const fnTag = "StellarTestLedger#getContainerIpAddress()";
    const aContainerInfo = await this.getContainerInfo();

    if (aContainerInfo) {
      const { NetworkSettings } = aContainerInfo;
      const networkNames: string[] = Object.keys(NetworkSettings.Networks);
      if (networkNames.length < 1) {
        throw new Error(`${fnTag} container not connected to any networks`);
      } else {
        // return IP address of container on the first network that we found
        return NetworkSettings.Networks[networkNames[0]].IPAddress;
      }
    } else {
      throw new Error(`${fnTag} cannot find image: ${this.containerImageName}`);
    }
  }

  /**
   *
   * Get the commands to pass to the docker container.
   *
   * @returns {string[]} Array of commands to pass to the docker container
   */
  private getImageCommands(): string[] {
    const cmds = [];

    switch (this.network) {
      case NetworkEnv.FUTURENET:
        cmds.push("--futurenet");
        break;
      case NetworkEnv.TESTNET:
        cmds.push("--testnet");
        break;
      case NetworkEnv.LOCAL:
      default:
        cmds.push("--local");
        break;
    }

    switch (this.limits) {
      case ResourceLimits.DEFAULT:
        cmds.push("--limits", "default");
        break;
      case ResourceLimits.UNLIMITED:
        cmds.push("--limits", "unlimited");
        break;
      case ResourceLimits.TESTNET:
      default:
        cmds.push("--limits", "testnet");
        break;
    }

    return cmds;
  }

  /**
   *
   * Get the network configuration data for the test stellar ledger.
   * This includes the network passphrase, rpcUrl, horizonUrl,
   * friendbotUrl, and the allowHttp flag.
   *
   * @returns {INetworkConfigData} Network configuration data
   */
  public async getNetworkConfiguration(): Promise<NetworkConfig> {
    if (this.network != "local") {
      throw new Error(
        `StellarTestLedger#getNetworkConfiguration() network ${this.network} not supported yet.`
      );
    }
    const cInfo = await this.getContainerInfo();
    const publicPort = await Containers.getPublicPort(8000, cInfo);

    // Default docker internal domain. Redirects to the local host where docker is running.
    const domain = "127.0.0.1";

    return Promise.resolve(
      CustomNet({
        networkPassphrase: "Standalone Network ; February 2017",
        rpcUrl: `http://${domain}:${publicPort}/rpc`,
        horizonUrl: `http://${domain}:${publicPort}`,
        friendbotUrl: `http://${domain}:${publicPort}/friendbot`,
        allowHttp: true,
      })
    );
  }

  /**
   *  Start a test stellar ledger.
   *
   * @param {boolean} omitPull - If true, the image will not be pulled from the registry.
   * @returns {Container} The container object.
   */
  public async start(omitPull = false): Promise<Container> {
    if (this.useRunningLedger) {
      this.log.info(
        "Search for already running Stellar Test Ledger because 'useRunningLedger' flag is enabled."
      );
      this.log.info(
        "Search criteria - image name: ",
        this.fullContainerImageName,
        ", state: running"
      );
      const containerInfo = await Containers.getByPredicate(
        (ci: { Image: string; State: string }) =>
          ci.Image === this.fullContainerImageName && ci.State === "running"
      );
      const docker = new Docker();
      this.containerId = containerInfo.Id;
      this.container = docker.getContainer(this.containerId);
      return this.container;
    }

    if (this.container) {
      await this.container.stop();
      await this.container.remove();
      this.container = undefined;
      this.containerId = undefined;
    }

    this.log.info("Pulling image...");
    if (!omitPull) {
      await Containers.pullImage(
        this.fullContainerImageName,
        {},
        this.logLevel
      );
    }
    this.log.info("Creating container...");
    const createOptions: ContainerCreateOptions = {
      ExposedPorts: {
        "8000/tcp": {}, // Stellar services will use this port (Horizon, RPC and Friendbot)
      },
      HostConfig: {
        PublishAllPorts: true,
        Privileged: true,
      },
    };

    const Healthcheck = {
      Test: [
        "CMD-SHELL",
        "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000 | grep -q '200' && curl -s -X POST -H 'Content-Type: application/json' -d '{\"jsonrpc\": \"2.0\", \"id\": 8675309, \"method\": \"getHealth\"}' http://localhost:8000/rpc | grep -q 'healthy' && curl -s http://localhost:8000/friendbot | grep -q '\"status\": 400' || exit 1",
      ],
      Interval: 1000000000, // 1 second
      Timeout: 3000000000, // 3 seconds
      Retries: 120, // 120 retries over 2 min should be enough for a big variety of systems
      StartPeriod: 1000000000, // 1 second
    };

    return new Promise<Container>((resolve, reject) => {
      const docker = new Docker();
      this.log.info("About to run docker.run()...");

      const eventEmitter: EventEmitter = docker.run(
        this.fullContainerImageName,
        [...this.getImageCommands()],
        [],
        { ...createOptions, Healthcheck: Healthcheck },
        {},
        (err: unknown) => {
          this.log.error("docker.run() error:", err);
          if (err) {
            reject(err);
          }
        }
      );

      this.log.info("docker.run() called, waiting for start event...");
      eventEmitter.once("start", async (container: Container) => {
        this.container = container;
        this.containerId = container.id;

        if (this.emitContainerLogs) {
          const fnTag = `[${this.fullContainerImageName}]`;
          await Containers.streamLogs({
            container: this.container,
            tag: fnTag,
            log: this.log,
          });
        }

        try {
          this.log.debug("Waiting for services to fully start.");
          await Containers.waitForHealthCheck(this.containerId!);
          this.log.debug("Stellar Test Ledger is ready.");
          resolve(container);
        } catch (ex) {
          this.log.error(ex);
          reject(ex);
        }
      });
    });
  }

  /**
   * Stop the test stellar ledger.
   *
   * @returns {Promise<unknown>} A promise that resolves when the ledger is stopped.
   */
  public async stop(): Promise<unknown> {
    if (this.useRunningLedger) {
      this.log.info("Ignore stop request because useRunningLedger is enabled.");
      return Promise.resolve();
    } else {
      return await Containers.stop(this.getContainer());
    }
  }

  /**
   * Destroy the test stellar ledger.
   *
   * @returns {Promise<unknown>} A promise that resolves when the ledger is destroyed.
   */
  public async destroy(): Promise<unknown> {
    if (this.useRunningLedger) {
      this.log.info(
        "Ignore destroy request because useRunningLedger is enabled."
      );
      return Promise.resolve();
    } else if (this.container) {
      const docker = new Docker();
      const containerInfo = await this.container.inspect();
      const volumes = containerInfo.Mounts;
      await this.container.remove();
      volumes.forEach(async (volume: { Name: unknown }) => {
        this.log.info(`Removing volume ${volume}`);
        if (volume.Name) {
          const volumeToDelete = docker.getVolume(volume.Name);
          await volumeToDelete.remove();
        } else {
          this.log.warn(`Volume ${volume} could not be removed!`);
        }
      });
      return Promise.resolve();
    } else {
      return Promise.reject(
        new Error(
          `StellarTestLedger#destroy() Container was never created, nothing to destroy.`
        )
      );
    }
  }
}
