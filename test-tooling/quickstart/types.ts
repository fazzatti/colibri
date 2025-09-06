import { NetworkConfig } from "@colibri/core";
import type { Container } from "dockerode";
import { LogLevelDesc } from "../logger/types.ts";

export type { Container };

export interface IStellarTestLedger {
  getNetworkConfiguration(): Promise<NetworkConfig>;
  getContainer(): Container;
  getContainerIpAddress(): Promise<string>;
}

export interface TestLedgerOptions {
  // Defines which type of network will the image will be configured to run.
  network?: NetworkEnv;

  // Defines the resource limits for soroban transactions. A valid transaction and only be included in a ledger
  // block if enough resources are available for that operation.
  limits?: ResourceLimits;

  // For test development, attach to ledger that is already running, don't spin up new one
  useRunningLedger?: boolean;

  readonly logLevel?: LogLevelDesc;
  readonly containerImageName?: string;
  readonly containerImageVersion?: SupportedImageVersions | string;
  readonly emitContainerLogs?: boolean;
}

// Define the resource limits set to Soroban transactions
// when pulling up a local network. This defines how smart contract
// transactions are limited in terms of resources during execution.
//
// Transactions that exceed these limits will be rejected.
//
export enum ResourceLimits {
  TESTNET = "testnet", // (Default) sets the limits to match those used on testnet.
  DEFAULT = "default", // leaves resource limits set extremely low as per Stellar's core default configuration
  UNLIMITED = "unlimited", // set limits to maximum resources that can be configured
}

//
// List of supported networks to connect
// when the test ledger image is pulled up.
//
export enum NetworkEnv {
  LOCAL = "local", // (Default) pull up a new pristine network image locally.
  FUTURENET = "futurenet", // pull up an image to connect to futurenet. Can take several minutes to sync the ledger state.
  TESTNET = "testnet", // pull up an image to connect to testnet  Can take several minutes to sync the ledger state.
}

// For now, only the latest version of the image is supported.
// This enum can be expanded to support more versions in the future.
export enum SupportedImageVersions {
  LASTEST = "latest",
  V425_LATEST = "v425-latest",
  PR757_LATEST = "pr757-latest",
}
