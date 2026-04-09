import { NetworkType, NetworkPassphrase } from "@/network/types.ts";
import type {
  TestNetConfig,
  CustomNetworkConfig,
  MainNetConfig,
  FutureNetConfig,
  INetworkConfig,
  MainNetCustomConfig,
  FutureNetCustomConfig,
  TestNetNetCustomConfig,
} from "@/network/types.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";
import * as E from "@/network/error.ts";

/** Preset provider helpers for commonly used public Stellar RPC networks. */
export * as NetworkProviders from "@/network/providers/index.ts";

/**
 * Mutable network configuration implementation with preset constructors for
 * Stellar Mainnet, Testnet, Futurenet, and custom networks.
 */
export class NetworkConfig implements INetworkConfig {
  private _type: NetworkType;
  private _networkPassphrase: string;
  private _rpcUrl?: string;
  private _archiveRpcUrl?: string;
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

  /**
   * Creates a Testnet configuration.
   *
   * @param args - Optional endpoint overrides.
   * @returns A fully resolved Testnet configuration.
   */
  static TestNet(args?: TestNetNetCustomConfig): NetworkConfig & TestNetConfig {
    const { rpcUrl, archiveRpcUrl, horizonUrl, friendbotUrl, allowHttp } =
      args || {};

    const config = new NetworkConfig({
      type: NetworkType.TESTNET,
      networkPassphrase: NetworkPassphrase.TESTNET,
    });

    config._rpcUrl = isDefined(rpcUrl)
      ? rpcUrl
      : "https://soroban-testnet.stellar.org:443";
    config._friendbotUrl = isDefined(friendbotUrl)
      ? friendbotUrl
      : "https://friendbot.stellar.org";
    config._horizonUrl = isDefined(horizonUrl)
      ? horizonUrl
      : "https://horizon-testnet.stellar.org";
    config._allowHttp = isDefined(allowHttp) ? allowHttp : false;
    config._archiveRpcUrl = archiveRpcUrl;

    return config as NetworkConfig & TestNetConfig;
  }

  /**
   * Creates a Futurenet configuration.
   *
   * @param args - Optional endpoint overrides.
   * @returns A fully resolved Futurenet configuration.
   */
  static FutureNet(
    args?: FutureNetCustomConfig
  ): NetworkConfig & FutureNetConfig {
    const { rpcUrl, archiveRpcUrl, horizonUrl, friendbotUrl, allowHttp } =
      args || {};

    const config = new NetworkConfig({
      type: NetworkType.FUTURENET,
      networkPassphrase: NetworkPassphrase.FUTURENET,
    });

    config._rpcUrl = isDefined(rpcUrl)
      ? rpcUrl
      : "https://rpc-futurenet.stellar.org:443";
    config._friendbotUrl = isDefined(friendbotUrl)
      ? friendbotUrl
      : "https://friendbot-futurenet.stellar.org";
    config._horizonUrl = isDefined(horizonUrl)
      ? horizonUrl
      : "https://horizon-futurenet.stellar.org";
    config._allowHttp = isDefined(allowHttp) ? allowHttp : false;
    config._archiveRpcUrl = archiveRpcUrl;

    return config as NetworkConfig & FutureNetConfig;
  }

  /**
   * Creates a Mainnet configuration.
   *
   * @param args - Optional endpoint overrides.
   * @returns A fully resolved Mainnet configuration.
   */
  static MainNet(args?: MainNetCustomConfig): NetworkConfig & MainNetConfig {
    const { rpcUrl, archiveRpcUrl, horizonUrl, allowHttp } = args || {};

    const config = new NetworkConfig({
      type: NetworkType.MAINNET,
      networkPassphrase: NetworkPassphrase.MAINNET,
    });

    config._rpcUrl = isDefined(rpcUrl)
      ? rpcUrl
      : "https://mainnet.sorobanrpc.com";
    config._horizonUrl = isDefined(horizonUrl)
      ? horizonUrl
      : "https://horizon.stellar.org";
    config._allowHttp = isDefined(allowHttp) ? allowHttp : false;
    config._archiveRpcUrl = archiveRpcUrl;

    return config as NetworkConfig & MainNetConfig;
  }

  /**
   * Creates a custom network configuration.
   *
   * @param payload - Required passphrase and optional endpoint overrides.
   * @returns A fully resolved custom network configuration.
   */
  static CustomNet(payload: {
    networkPassphrase: string;
    type?: NetworkType;
    rpcUrl?: string;
    archiveRpcUrl?: string;
    horizonUrl?: string;
    friendbotUrl?: string;
    allowHttp?: boolean;
  }): NetworkConfig & CustomNetworkConfig {
    const config = new NetworkConfig({
      type: payload.type || NetworkType.CUSTOM,
      networkPassphrase: payload.networkPassphrase,
    });

    if (isDefined(payload.rpcUrl)) config._rpcUrl = payload.rpcUrl;
    if (isDefined(payload.horizonUrl)) config._horizonUrl = payload.horizonUrl;
    if (isDefined(payload.friendbotUrl))
      config._friendbotUrl = payload.friendbotUrl;
    if (isDefined(payload.allowHttp)) config._allowHttp = payload.allowHttp;
    if (isDefined(payload.archiveRpcUrl))
      config._archiveRpcUrl = payload.archiveRpcUrl;

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
  /** @internal */
  private require(arg: "_type"): NetworkType;
  /** @internal */
  private require(arg: "_networkPassphrase"): string;
  /** @internal */
  private require(arg: "_rpcUrl"): string;
  /** @internal */
  private require(arg: "_archiveRpcUrl"): string;
  /** @internal */
  private require(arg: "_horizonUrl"): string;
  /** @internal */
  private require(arg: "_friendbotUrl"): string;
  /** @internal */
  private require(arg: "_allowHttp"): boolean;
  /** @internal */
  private require(
    arg:
      | "_type"
      | "_networkPassphrase"
      | "_rpcUrl"
      | "_archiveRpcUrl"
      | "_horizonUrl"
      | "_friendbotUrl"
      | "_allowHttp"
  ): NetworkType | string | boolean {
    if (isDefined(this[arg])) return this[arg];
    throw new E.PROPERTY_NOT_SET(arg);
  }

  /** @internal */
  private requireNo(
    arg:
      | "_type"
      | "_networkPassphrase"
      | "_rpcUrl"
      | "_archiveRpcUrl"
      | "_horizonUrl"
      | "_friendbotUrl"
      | "_allowHttp"
  ): void {
    if (isDefined(this[arg])) {
      throw new E.PROPERTY_ALREADY_SET(arg);
    }
  }

  //==========================================
  // Getter and Setter Methods
  //==========================================
  //
  //

  /** Returns the configured network kind. */
  get type(): NetworkType {
    return this.require("_type");
  }

  /** Sets the network kind once for a newly constructed custom config. */
  set type(value: NetworkType) {
    this.requireNo("_type");
    this._type = value;
  }

  /** Returns the configured Stellar network passphrase. */
  get networkPassphrase(): string {
    return this.require("_networkPassphrase");
  }

  /** Sets the network passphrase once for a newly constructed custom config. */
  set networkPassphrase(value: string) {
    this.requireNo("_networkPassphrase");
    this._networkPassphrase = value;
  }

  /** Returns the configured Soroban RPC endpoint, when available. */
  get rpcUrl(): string | undefined {
    return this._rpcUrl;
  }

  /** Sets the Soroban RPC endpoint when one was not already configured. */
  set rpcUrl(value: string) {
    this.requireNo("_rpcUrl");
    this._rpcUrl = value;
  }

  /** Returns the configured archive RPC endpoint, when available. */
  get archiveRpcUrl(): string | undefined {
    return this._archiveRpcUrl;
  }
  /** Sets the archive RPC endpoint when one was not already configured. */
  set archiveRpcUrl(value: string) {
    this.requireNo("_archiveRpcUrl");
    this._archiveRpcUrl = value;
  }

  /** Returns the configured Horizon endpoint, when available. */
  get horizonUrl(): string | undefined {
    return this._horizonUrl;
  }
  /** Sets the Horizon endpoint when one was not already configured. */
  set horizonUrl(value: string) {
    this.requireNo("_horizonUrl");
    this._horizonUrl = value;
  }

  /** Returns the configured Friendbot endpoint, when available. */
  get friendbotUrl(): string | undefined {
    return this._friendbotUrl;
  }
  /** Sets the Friendbot endpoint when one was not already configured. */
  set friendbotUrl(value: string) {
    this.requireNo("_friendbotUrl");
    this._friendbotUrl = value;
  }

  /** Returns whether HTTP URLs are allowed for this network. */
  get allowHttp(): boolean | undefined {
    return this._allowHttp;
  }
  /** Sets the HTTP allowance flag when one was not already configured. */
  set allowHttp(value: boolean) {
    this.requireNo("_allowHttp");
    this._allowHttp = value;
  }

  //==========================================
  // Checkers Methods
  //==========================================
  //
  //
  /** Returns `true` when this configuration matches the built-in Testnet preset. */
  isTestNet(): this is TestNetConfig {
    return (
      this.type === NetworkType.TESTNET &&
      this.networkPassphrase === NetworkPassphrase.TESTNET
    );
  }

  /** Returns `true` when this configuration matches the built-in Futurenet preset. */
  isFutureNet(): this is FutureNetConfig {
    return (
      this.type === NetworkType.FUTURENET &&
      this.networkPassphrase === NetworkPassphrase.FUTURENET
    );
  }

  /** Returns `true` when this configuration matches the built-in Mainnet preset. */
  isMainNet(): this is MainNetConfig {
    return (
      this.type === NetworkType.MAINNET &&
      this.networkPassphrase === NetworkPassphrase.MAINNET
    );
  }

  /** Returns `true` when this configuration does not match a built-in preset. */
  isCustomNet(): this is CustomNetworkConfig {
    if (this.type === NetworkType.CUSTOM) return true;
    return !this.isTestNet() && !this.isFutureNet() && !this.isMainNet();
  }
}

/**
 * Returns `true` when a value looks like a {@link NetworkConfig} instance.
 *
 * @param obj - Candidate value.
 * @returns Whether the candidate exposes the required network fields.
 */
export const isNetworkConfig = (obj: unknown): obj is NetworkConfig => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    Object.values(NetworkType).includes((obj as NetworkConfig).type) &&
    "networkPassphrase" in obj
  );
};
