import { Networks } from "stellar-sdk";

export enum NetworkPassphrase {
  MAINNET = Networks.PUBLIC,
  TESTNET = Networks.TESTNET,
  FUTURENET = Networks.FUTURENET,
}

export interface INetworkConfig {
  type: NetworkType;
  networkPassphrase: string;
  rpcUrl?: string;
  archiveRpcUrl?: string;
  horizonUrl?: string;
  friendbotUrl?: string;
  allowHttp?: boolean;

  isTestNet(): this is TestNetConfig;
  isFutureNet(): this is FutureNetConfig;
  isMainNet(): this is MainNetConfig;
  isCustomNet(): this is CustomNetworkConfig;
}

export type MainNetCustomConfig = Partial<
  Pick<INetworkConfig, "rpcUrl" | "allowHttp" | "horizonUrl" | "archiveRpcUrl">
>;

export type TestNetNetCustomConfig = Partial<
  Pick<
    INetworkConfig,
    "rpcUrl" | "allowHttp" | "horizonUrl" | "friendbotUrl" | "archiveRpcUrl"
  >
>;

export type FutureNetCustomConfig = Partial<
  Pick<
    INetworkConfig,
    "rpcUrl" | "allowHttp" | "horizonUrl" | "friendbotUrl" | "archiveRpcUrl"
  >
>;

export type MainNetConfig = Omit<INetworkConfig, "friendbotUrl"> & {
  type: NetworkType.MAINNET;
  networkPassphrase: NetworkPassphrase.MAINNET;
  horizonUrl: string;
  rpcUrl: string;
  allowHttp: false;
  friendbotUrl?: never;
} & (RPCConfig | HorizonConfig);

export type TestNetConfig = INetworkConfig & {
  type: NetworkType.TESTNET;
  networkPassphrase: NetworkPassphrase.TESTNET;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  allowHttp: false;
} & (RPCConfig | HorizonConfig);

export type FutureNetConfig = INetworkConfig & {
  type: NetworkType.FUTURENET;
  networkPassphrase: NetworkPassphrase.FUTURENET;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  allowHttp: false;
} & (RPCConfig | HorizonConfig);

export type CustomNetworkConfig = INetworkConfig & {
  networkPassphrase: string;
  type: NetworkType;
} & (RPCConfig | HorizonConfig);

export enum NetworkType {
  TESTNET = "testnet",
  FUTURENET = "futurenet",
  MAINNET = "mainnet",
  CUSTOM = "custom",
}

type RPCConfig = {
  rpcUrl: string;
  allowHttp?: boolean;
};

type HorizonConfig = {
  horizonUrl: string;
  allowHttp?: boolean;
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
