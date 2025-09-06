import { Networks } from "stellar-sdk";

export type NetworkConfig = {
  type: NetworkType;
  networkPassphrase: string;
  rpcUrl?: string;
  horizonUrl?: string;
  friendbotUrl?: string;
  allowHttp?: boolean;
};

export enum NetworkType {
  TESTNET = "testnet",
  FUTURENET = "futurenet",
  MAINNET = "mainnet",
  CUSTOM = "custom",
}

export const TestNet = (): NetworkConfig => {
  return {
    type: NetworkType.TESTNET,
    networkPassphrase: Networks.TESTNET,
    rpcUrl: "https://soroban-testnet.stellar.org:443",
    friendbotUrl: "https://friendbot.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    allowHttp: false,
  };
};

export const FutureNet = (): NetworkConfig => {
  return {
    type: NetworkType.FUTURENET,
    networkPassphrase: Networks.FUTURENET,
    rpcUrl: "https://rpc-futurenet.stellar.org:443",
    friendbotUrl: "https://friendbot-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    allowHttp: false,
  };
};

export const MainNet = (): NetworkConfig => {
  return {
    type: NetworkType.MAINNET,
    networkPassphrase: Networks.PUBLIC,
    rpcUrl: "",
    horizonUrl: "https://horizon.stellar.org",
    allowHttp: false,
  };
};

export type CustomNetworkPayload = {
  networkPassphrase: string;
  type?: NetworkType;
  rpcUrl?: string;
  horizonUrl?: string;
  friendbotUrl?: string;
  allowHttp?: boolean;
};

export const CustomNet = (payload: CustomNetworkPayload): NetworkConfig => {
  return {
    ...payload,
    type: payload.type || NetworkType.CUSTOM,
  };
};
