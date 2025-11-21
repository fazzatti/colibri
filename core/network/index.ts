// export const TestNet = (): TestNetConfig => {
//   return {
//     type: NetworkType.TESTNET,
//     networkPassphrase: NetworkPassphrase.TESTNET,
//     rpcUrl: "https://soroban-testnet.stellar.org:443",
//     friendbotUrl: "https://friendbot.stellar.org",
//     horizonUrl: "https://horizon-testnet.stellar.org",
//     allowHttp: false,
//   };
// };

import { NetworkType, NetworkPassphrase } from "./types.ts";

import type {
  TestNetConfig,
  CustomNetworkConfig,
  MainNetConfig,
  FutureNetConfig,
  INetworkConfig,
} from "./types.ts";

// export const FutureNet = (): FutureNetConfig => {
//   return {
//     type: NetworkType.FUTURENET,
//     networkPassphrase: NetworkPassphrase.FUTURENET,
//     rpcUrl: "https://rpc-futurenet.stellar.org:443",
//     friendbotUrl: "https://friendbot-futurenet.stellar.org",
//     horizonUrl: "https://horizon-futurenet.stellar.org",
//     allowHttp: false,
//   };
// };

// export const MainNet = (): MainNetConfig => {
//   return {
//     type: NetworkType.MAINNET,
//     networkPassphrase: NetworkPassphrase.MAINNET,
//     rpcUrl: "https://mainnet.sorobanrpc.com",
//     horizonUrl: "https://horizon.stellar.org",
//     allowHttp: false,
//   };
// };

// export const CustomNet = (payload: CustomNetworkPayload): NetworkConfig => {
//   return {
//     ...payload,
//     type: payload.type || NetworkType.CUSTOM,
//   };
// };

// type RPCConfig = {
//   rpcUrl: string;
//   allowHttp?: boolean;
// };

// type HorizonConfig = {
//   horizonUrl: string;
//   allowHttp?: boolean;
// };

// export const isNetworkConfig = (obj: unknown): obj is NetworkConfig => {
//   return (
//     typeof obj === "object" &&
//     obj !== null &&
//     "type" in obj &&
//     Object.values(NetworkType).includes((obj as NetworkConfig).type) &&
//     "networkPassphrase" in obj
//   );
// };

// export const isTestNet = (config: NetworkConfig): config is TestNetConfig =>
//   isNetworkConfig(config) &&
//   config.type === NetworkType.TESTNET &&
//   config.networkPassphrase === NetworkPassphrase.TESTNET;

// export const isFutureNet = (config: NetworkConfig): config is FutureNetConfig =>
//   isNetworkConfig(config) &&
//   config.type === NetworkType.FUTURENET &&
//   config.networkPassphrase === NetworkPassphrase.FUTURENET;

// export const isMainNet = (config: NetworkConfig): config is MainNetConfig =>
//   isNetworkConfig(config) &&
//   config.type === NetworkType.MAINNET &&
//   config.networkPassphrase === NetworkPassphrase.MAINNET;

export class NetworkConfig implements INetworkConfig {
  private _type: NetworkType;
  private _networkPassphrase: string;
  private _rpcUrl?: string;
  private _horizonUrl?: string;
  private _friendbotUrl?: string;
  private _allowHttp?: boolean;

  private constructor({
    type,
    networkPassphrase,
  }: {
    type: NetworkType;
    networkPassphrase: string;
  }) {
    this._type = type;
    this._networkPassphrase = networkPassphrase;
  }

  static TestNet(): NetworkConfig & TestNetConfig {
    const config = new NetworkConfig({
      type: NetworkType.TESTNET,
      networkPassphrase: NetworkPassphrase.TESTNET,
    });

    config._rpcUrl = "https://soroban-testnet.stellar.org:443";
    config._friendbotUrl = "https://friendbot.stellar.org";
    config._horizonUrl = "https://horizon-testnet.stellar.org";
    config._allowHttp = false;

    return config as NetworkConfig & TestNetConfig;
  }

  static FutureNet(): NetworkConfig & FutureNetConfig {
    const config = new NetworkConfig({
      type: NetworkType.FUTURENET,
      networkPassphrase: NetworkPassphrase.FUTURENET,
    });

    config._rpcUrl = "https://rpc-futurenet.stellar.org:443";
    config._friendbotUrl = "https://friendbot-futurenet.stellar.org";
    config._horizonUrl = "https://horizon-futurenet.stellar.org";
    config._allowHttp = false;

    return config as NetworkConfig & FutureNetConfig;
  }

  static MainNet(): NetworkConfig & MainNetConfig {
    const config = new NetworkConfig({
      type: NetworkType.MAINNET,
      networkPassphrase: NetworkPassphrase.MAINNET,
    });

    config._rpcUrl = "https://mainnet.sorobanrpc.com";
    config._horizonUrl = "https://horizon.stellar.org";
    config._allowHttp = false;

    return config as NetworkConfig & MainNetConfig;
  }

  static CustomNet(payload: {
    networkPassphrase: string;
    type?: NetworkType;
    rpcUrl?: string;
    horizonUrl?: string;
    friendbotUrl?: string;
    allowHttp?: boolean;
  }): NetworkConfig & CustomNetworkConfig {
    const config = new NetworkConfig({
      type: payload.type || NetworkType.CUSTOM,
      networkPassphrase: payload.networkPassphrase,
    });

    if (payload.rpcUrl !== undefined) config._rpcUrl = payload.rpcUrl;
    if (payload.horizonUrl !== undefined)
      config._horizonUrl = payload.horizonUrl;
    if (payload.friendbotUrl !== undefined)
      config._friendbotUrl = payload.friendbotUrl;
    if (payload.allowHttp !== undefined) config._allowHttp = payload.allowHttp;

    return config as NetworkConfig & CustomNetworkConfig;
  }

  //==========================================
  // Meta Requirement Methods
  //==========================================
  //
  //

  /**
   * Internal helper method to safely retrieve required properties.
   * Uses method overloading to provide type-safe access to private fields.
   *
   * @param arg - The name of the property to retrieve
   * @returns The value of the requested property
   * @throws {Error} If the requested property is not set
   * @private
   */
  private require(arg: "_type"): NetworkType;
  private require(arg: "_networkPassphrase"): string;
  private require(arg: "_rpcUrl"): string;
  private require(arg: "_horizonUrl"): string;
  private require(arg: "_friendbotUrl"): string;
  private require(arg: "_allowHttp"): boolean;
  private require(
    arg:
      | "_type"
      | "_networkPassphrase"
      | "_rpcUrl"
      | "_horizonUrl"
      | "_friendbotUrl"
      | "_allowHttp"
  ): NetworkType | string | boolean {
    if (this[arg]) return this[arg];
    throw new Error(
      `Property ${arg} is not set in the Network Config instance`
    );
  }

  private requireNo(
    arg:
      | "_type"
      | "_networkPassphrase"
      | "_rpcUrl"
      | "_horizonUrl"
      | "_friendbotUrl"
      | "_allowHttp"
  ): void {
    // assert(!this[arg], new E.PROPERTY_ALREADY_SET(arg));
    if (this[arg] !== undefined) {
      throw new Error(
        `Property ${arg} is already set in the Network Config instance`
      );
    }
  }

  // private requireNoContractId(): void {
  //   this.requireNo("contractId");
  // }

  // private requireNoSpec(): void {
  //   this.requireNo("spec");
  // }

  //==========================================
  // Getter and Setter Methods
  //==========================================
  //
  //

  get type(): NetworkType {
    return this.require("_type");
  }

  set type(value: NetworkType) {
    this.requireNo("_type");
    this._type = value;
  }

  get networkPassphrase(): string {
    return this.require("_networkPassphrase");
  }

  set networkPassphrase(value: string) {
    this.requireNo("_networkPassphrase");
    this._networkPassphrase = value;
  }

  get rpcUrl(): string | undefined {
    return this._rpcUrl;
  }

  set rpcUrl(value: string) {
    this.requireNo("_rpcUrl");
    this._rpcUrl = value;
  }

  get horizonUrl(): string | undefined {
    return this._horizonUrl;
  }
  set horizonUrl(value: string) {
    this.requireNo("_horizonUrl");
    this._horizonUrl = value;
  }

  get friendbotUrl(): string | undefined {
    return this._friendbotUrl;
  }
  set friendbotUrl(value: string) {
    this.requireNo("_friendbotUrl");
    this._friendbotUrl = value;
  }

  get allowHttp(): boolean | undefined {
    return this._allowHttp;
  }
  set allowHttp(value: boolean) {
    this.requireNo("_allowHttp");
    this._allowHttp = value;
  }

  //==========================================
  // Checkers Methods
  //==========================================
  //
  //
  isTestNet(): this is TestNetConfig {
    return (
      this.type === NetworkType.TESTNET &&
      this.networkPassphrase === NetworkPassphrase.TESTNET
    );
  }

  isFutureNet(): this is FutureNetConfig {
    return (
      this.type === NetworkType.FUTURENET &&
      this.networkPassphrase === NetworkPassphrase.FUTURENET
    );
  }

  isMainNet(): this is MainNetConfig {
    return (
      this.type === NetworkType.MAINNET &&
      this.networkPassphrase === NetworkPassphrase.MAINNET
    );
  }

  isCustomNet(): this is CustomNetworkConfig {
    if (this.type === NetworkType.CUSTOM) return true;
    return !this.isTestNet() && !this.isFutureNet() && !this.isMainNet();
  }
}

export const isNetworkConfig = (obj: unknown): obj is NetworkConfig => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    Object.values(NetworkType).includes((obj as NetworkConfig).type) &&
    "networkPassphrase" in obj
  );
};

// export const isTestNet = (config: NetworkConfig): config is TestNetConfig =>
//   isNetworkConfig(config) &&
//   config.type === NetworkType.TESTNET &&
//   config.networkPassphrase === NetworkPassphrase.TESTNET;

// export const isFutureNet = (config: NetworkConfig): config is FutureNetConfig =>
//   isNetworkConfig(config) &&
//   config.type === NetworkType.FUTURENET &&
//   config.networkPassphrase === NetworkPassphrase.FUTURENET;

// export const isMainNet = (config: NetworkConfig): config is MainNetConfig =>
//   isNetworkConfig(config) &&
//   config.type === NetworkType.MAINNET &&
//   config.networkPassphrase === NetworkPassphrase.MAINNET;
