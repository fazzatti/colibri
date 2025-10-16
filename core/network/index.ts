import { Networks } from "stellar-sdk";

export type NetworkConfig = {
  type: NetworkType;
  networkPassphrase: string;
  rpcUrl?: string;
  horizonUrl?: string;
  friendbotUrl?: string;
  allowHttp?: boolean;
};

export type MainNetConfig = {
  type: NetworkType.MAINNET;
  networkPassphrase: Networks.PUBLIC;
} & (RPCConfig | HorizonConfig);

export type TestNetConfig = NetworkConfig & {
  type: NetworkType.TESTNET;
  networkPassphrase: Networks.TESTNET;
  friendbotUrl: string;
} & (RPCConfig | HorizonConfig);

export type FutureNetConfig = NetworkConfig & {
  type: NetworkType.FUTURENET;
  networkPassphrase: Networks.FUTURENET;
  friendbotUrl: string;
} & (RPCConfig | HorizonConfig);

export type CustomNetworkPayload = {
  networkPassphrase: string;
  type?: NetworkType;
  friendbotUrl?: string;
} & (RPCConfig | HorizonConfig);

export enum NetworkType {
  TESTNET = "testnet",
  FUTURENET = "futurenet",
  MAINNET = "mainnet",
  CUSTOM = "custom",
}

export const TestNet = (): TestNetConfig => {
  return {
    type: NetworkType.TESTNET,
    networkPassphrase: Networks.TESTNET,
    rpcUrl: "https://soroban-testnet.stellar.org:443",
    friendbotUrl: "https://friendbot.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    allowHttp: false,
  };
};

export const FutureNet = (): FutureNetConfig => {
  return {
    type: NetworkType.FUTURENET,
    networkPassphrase: Networks.FUTURENET,
    rpcUrl: "https://rpc-futurenet.stellar.org:443",
    friendbotUrl: "https://friendbot-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    allowHttp: false,
  };
};

export const MainNet = (): MainNetConfig => {
  return {
    type: NetworkType.MAINNET,
    networkPassphrase: Networks.PUBLIC,
    rpcUrl: "",
    horizonUrl: "https://horizon.stellar.org",
    allowHttp: false,
  };
};

export const CustomNet = (payload: CustomNetworkPayload): NetworkConfig => {
  return {
    ...payload,
    type: payload.type || NetworkType.CUSTOM,
  };
};

type RPCConfig = {
  rpcUrl: string;
  allowHttp?: boolean;
};

type HorizonConfig = {
  horizonUrl: string;
  allowHttp?: boolean;
};

export const isTestNet = (config: NetworkConfig): config is TestNetConfig =>
  config.type === NetworkType.TESTNET &&
  config.networkPassphrase === Networks.TESTNET;

export const isFutureNet = (config: NetworkConfig): config is FutureNetConfig =>
  config.type === NetworkType.FUTURENET &&
  config.networkPassphrase === Networks.FUTURENET;

export const isMainNet = (config: NetworkConfig): config is MainNetConfig =>
  config.type === NetworkType.MAINNET &&
  config.networkPassphrase === Networks.PUBLIC;
