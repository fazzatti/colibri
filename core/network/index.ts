import { Networks } from "stellar-sdk";

export enum NetworkPassphrase {
  MAINNET = Networks.PUBLIC,
  TESTNET = Networks.TESTNET,
  FUTURENET = Networks.FUTURENET,
}

export type NetworkConfig = {
  type: NetworkType;
  networkPassphrase: string;
  rpcUrl?: string;
  horizonUrl?: string;
  friendbotUrl?: string;
  allowHttp?: boolean;
};

export type MainNetConfig = Omit<NetworkConfig, "friendbotUrl"> & {
  type: NetworkType.MAINNET;
  networkPassphrase: NetworkPassphrase.MAINNET;
  horizonUrl: string;
  rpcUrl: string;
  allowHttp: false;
} & (RPCConfig | HorizonConfig);

export type TestNetConfig = NetworkConfig & {
  type: NetworkType.TESTNET;
  networkPassphrase: NetworkPassphrase.TESTNET;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  allowHttp: false;
} & (RPCConfig | HorizonConfig);

export type FutureNetConfig = NetworkConfig & {
  type: NetworkType.FUTURENET;
  networkPassphrase: NetworkPassphrase.FUTURENET;
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  allowHttp: false;
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
    networkPassphrase: NetworkPassphrase.TESTNET,
    rpcUrl: "https://soroban-testnet.stellar.org:443",
    friendbotUrl: "https://friendbot.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    allowHttp: false,
  };
};

export const FutureNet = (): FutureNetConfig => {
  return {
    type: NetworkType.FUTURENET,
    networkPassphrase: NetworkPassphrase.FUTURENET,
    rpcUrl: "https://rpc-futurenet.stellar.org:443",
    friendbotUrl: "https://friendbot-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    allowHttp: false,
  };
};

export const MainNet = (): MainNetConfig => {
  return {
    type: NetworkType.MAINNET,
    networkPassphrase: NetworkPassphrase.MAINNET,
    rpcUrl: "https://mainnet.sorobanrpc.com",
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

export const isNetworkConfig = (obj: unknown): obj is NetworkConfig => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    Object.values(NetworkType).includes((obj as NetworkConfig).type) &&
    "networkPassphrase" in obj
  );
};

export const isTestNet = (config: NetworkConfig): config is TestNetConfig =>
  isNetworkConfig(config) &&
  config.type === NetworkType.TESTNET &&
  config.networkPassphrase === NetworkPassphrase.TESTNET;

export const isFutureNet = (config: NetworkConfig): config is FutureNetConfig =>
  isNetworkConfig(config) &&
  config.type === NetworkType.FUTURENET &&
  config.networkPassphrase === NetworkPassphrase.FUTURENET;

export const isMainNet = (config: NetworkConfig): config is MainNetConfig =>
  isNetworkConfig(config) &&
  config.type === NetworkType.MAINNET &&
  config.networkPassphrase === NetworkPassphrase.MAINNET;
