/**
 * Well-known Stellar network passphrases used by Colibri.
 */
export enum NetworkPassphrase {
  MAINNET = "Public Global Stellar Network ; September 2015",
  TESTNET = "Test SDF Network ; September 2015",
  FUTURENET = "Test SDF Future Network ; October 2022",
}

/**
 * Runtime network configuration consumed by Colibri tools and pipelines.
 */
export interface INetworkConfig {
  /** Logical network identifier. */
  type: NetworkType;
  /** Stellar network passphrase. */
  networkPassphrase: string;
  /** Soroban RPC endpoint. */
  rpcUrl?: string;
  /** Archive RPC endpoint, when available. */
  archiveRpcUrl?: string;
  /** Horizon endpoint. */
  horizonUrl?: string;
  /** Friendbot endpoint. */
  friendbotUrl?: string;
  /** Allows HTTP URLs for local or custom networks. */
  allowHttp?: boolean;

  /** Returns `true` when this configuration represents Stellar Testnet. */
  isTestNet(): this is TestNetConfig;
  /** Returns `true` when this configuration represents Stellar Futurenet. */
  isFutureNet(): this is FutureNetConfig;
  /** Returns `true` when this configuration represents Stellar Mainnet. */
  isMainNet(): this is MainNetConfig;
  /** Returns `true` when this configuration is not one of the built-in presets. */
  isCustomNet(): this is CustomNetworkConfig;
}

/**
 * Optional overrides supported by the Mainnet preset factory.
 */
export type MainNetCustomConfig = Partial<
  Pick<INetworkConfig, "rpcUrl" | "allowHttp" | "horizonUrl" | "archiveRpcUrl">
>;

/**
 * Optional overrides supported by the Testnet preset factory.
 */
export type TestNetNetCustomConfig = Partial<
  Pick<
    INetworkConfig,
    "rpcUrl" | "allowHttp" | "horizonUrl" | "friendbotUrl" | "archiveRpcUrl"
  >
>;

/**
 * Optional overrides supported by the Futurenet preset factory.
 */
export type FutureNetCustomConfig = Partial<
  Pick<
    INetworkConfig,
    "rpcUrl" | "allowHttp" | "horizonUrl" | "friendbotUrl" | "archiveRpcUrl"
  >
>;

/**
 * Configuration fragment that guarantees a Soroban RPC endpoint.
 */
export type RPCConfig = {
  /** Soroban RPC endpoint. */
  rpcUrl: string;
  /** Allows HTTP URLs for local or custom networks. */
  allowHttp?: boolean;
};

/**
 * Configuration fragment that guarantees a Horizon endpoint.
 */
export type HorizonConfig = {
  /** Horizon endpoint. */
  horizonUrl: string;
  /** Allows HTTP URLs for local or custom networks. */
  allowHttp?: boolean;
};

/**
 * Fully resolved Mainnet network configuration.
 */
export type MainNetConfig = Omit<INetworkConfig, "friendbotUrl"> & {
  type: NetworkType.MAINNET;
  networkPassphrase: NetworkPassphrase.MAINNET;
  horizonUrl: string;
  rpcUrl: string;
  allowHttp: false;
  friendbotUrl?: never;
} & (RPCConfig | HorizonConfig);

/**
 * Fully resolved Testnet network configuration.
 */
export type TestNetConfig = INetworkConfig & {
  type: NetworkType.TESTNET;
  networkPassphrase: NetworkPassphrase.TESTNET;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  allowHttp: false;
} & (RPCConfig | HorizonConfig);

/**
 * Fully resolved Futurenet network configuration.
 */
export type FutureNetConfig = INetworkConfig & {
  type: NetworkType.FUTURENET;
  networkPassphrase: NetworkPassphrase.FUTURENET;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  allowHttp: false;
} & (RPCConfig | HorizonConfig);

/**
 * Fully resolved custom network configuration.
 */
export type CustomNetworkConfig = INetworkConfig & {
  networkPassphrase: string;
  type: NetworkType;
} & (RPCConfig | HorizonConfig);

/**
 * Supported Stellar network kinds understood by Colibri.
 */
export enum NetworkType {
  TESTNET = "testnet",
  FUTURENET = "futurenet",
  MAINNET = "mainnet",
  CUSTOM = "custom",
}

/**
 * Adds a required archive RPC endpoint to a network configuration.
 *
 * @typeParam T - Base network configuration type.
 */
export type WithArchiveRPC<T> = T & {
  archiveRpcUrl: string;
};

// export const isNetworkConfig = (obj: unknown): obj is NetworkConfig => {
//   return (
//     typeof obj === "object" &&
//     obj !== null &&
//     "type" in obj &&
//     Object.values(NetworkType).includes((obj as NetworkConfig).type) &&
//     "networkPassphrase" in obj
//   );
// };
