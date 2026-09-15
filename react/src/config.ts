import { NetworkConfig } from "@colibri/core/network";
import type { MessageSigner, Signer } from "@colibri/core/signers";
import { ColibriReactError, ReactCode } from "@/error.ts";
/** A connection reports its actual network and independently configured signer capabilities. */
export interface WalletConnection {
  /** Active G, M or C account identity. */
  address: string;
  /** Network reported by the wallet, not inferred from its address. */
  networkPassphrase: string;
  /** Explicit envelope and/or authorization-entry signers. */
  signers: readonly Signer[];
  /** Optional SEP-53 message signer. */
  messageSigner?: MessageSigner;
}
/** Framework-independent wallet integration. SDK imports and permission prompts are caller-controlled. */
export interface WalletConnector {
  /** Stable connector identifier. */
  id: string;
  /** Connect through an explicit user action. */
  connect(): Promise<WalletConnection>;
  /** Restore only an already-authorized connection; never prompt. */
  reconnect?(): Promise<WalletConnection | null>;
  /** Release the wallet session when supported. */
  disconnect?(): Promise<void>;
  /** Subscribe to account/network changes; null means disconnected. */
  subscribe?(
    listener: (connection: WalletConnection | null) => void,
  ): () => void;
}
/** Immutable observable connection snapshot. */
export interface ConnectionState {
  /** Current lifecycle state. */
  status: "disconnected" | "connecting" | "connected";
  /** Current connector identifier. */
  connectorId?: string;
  /** Connection or network-change failure, when present. */
  error?: unknown;
  /** Wallet-reported account and capabilities. */
  connection?: WalletConnection;
}
/** Provider configuration; create once per application or server request. */
export interface ColibriConfigOptions {
  /** Authoritative application network. */
  network: NetworkConfig;
  /** Explicitly available connectors. */
  connectors?: readonly WalletConnector[];
  /** Optional cache namespace for different data providers or app environments. */
  scope?: string;
}
const disconnected: ConnectionState = Object.freeze({ status: "disconnected" });
/** Owns connection state outside React. No browser globals or network I/O at construction. */
export class ColibriConfig {
  /** Immutable network snapshot. */
  readonly network: NetworkConfig;
  /** Configured wallet integrations. */
  readonly connectors: readonly WalletConnector[];
  /** Cache and mutation namespace. */
  readonly scope: string;
  private state: ConnectionState = disconnected;
  private listeners = new Set<() => void>();
  private revision = 0;
  private cleanup?: () => void;
  private activeConnectorId?: string;
  /** Validate and snapshot application configuration. */
  constructor(options: ColibriConfigOptions) {
    if (!options.network.networkPassphrase) {
      throw new ColibriReactError(
        ReactCode.INVALID_CONFIG,
        "A network passphrase is required",
      );
    }
    const network = options.network;
    this.network = NetworkConfig.CustomNet({
      type: network.type,
      networkPassphrase: network.networkPassphrase,
      rpcUrl: network.rpcUrl,
      archiveRpcUrl: network.archiveRpcUrl,
      horizonUrl: network.horizonUrl,
      friendbotUrl: network.friendbotUrl,
      allowHttp: network.allowHttp,
    });
    Object.freeze(this.network);
    this.connectors = Object.freeze([...(options.connectors ?? [])]);
    if (
      new Set(this.connectors.map((c) => c.id)).size !== this.connectors.length
    ) {
      throw new ColibriReactError(
        ReactCode.INVALID_CONFIG,
        "Connector IDs must be unique",
      );
    }
    this.scope = options.scope ?? options.network.rpcUrl ?? "default";
  }
  /** Stable external-store snapshot. */
  getSnapshot = (): ConnectionState => this.state;
  /** SSR always starts disconnected; no wallet credentials are serialized. */
  getServerSnapshot = (): ConnectionState => disconnected;
  /** Subscribe to connection changes. */
  subscribe = (listener: () => void): () => void => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** @internal */
  private set(state: ConnectionState): void {
    this.state = Object.freeze(state);
    this.listeners.forEach((fn) => fn());
  }
  /** @internal */
  private connector(id: string): WalletConnector {
    const connector = this.connectors.find((c) => c.id === id);
    if (!connector) {
      throw new ColibriReactError(
        ReactCode.INVALID_CONFIG,
        `Unknown connector: ${id}`,
      );
    }
    return connector;
  }
  /** @internal */
  private accept(connection: WalletConnection): WalletConnection {
    if (connection.networkPassphrase !== this.network.networkPassphrase) {
      throw new ColibriReactError(
        ReactCode.NETWORK_MISMATCH,
        "Wallet and application networks differ",
      );
    }
    return Object.freeze({
      ...connection,
      signers: Object.freeze([...connection.signers]),
    });
  }
  /** Connect or restore an explicit connector. A later disconnect/connect invalidates an in-flight result. */
  async connect(
    id: string,
    reconnect = false,
  ): Promise<WalletConnection | null> {
    const connector = this.connector(id);
    const revision = ++this.revision;
    this.activeConnectorId = id;
    this.cleanup?.();
    this.cleanup = undefined;
    this.set({ status: "connecting", connectorId: id });
    try {
      const value = reconnect
        ? await (connector.reconnect?.() ?? null)
        : await connector.connect();
      if (revision !== this.revision) {
        throw new ColibriReactError(
          ReactCode.CONNECTION_CHANGED,
          "Connection changed while connecting",
        );
      }
      if (!value) {
        this.set(disconnected);
        return null;
      }
      const connection = this.accept(value);
      this.set({ status: "connected", connectorId: id, connection });
      this.cleanup = connector.subscribe?.((next) => {
        if (revision !== this.revision) return;
        try {
          this.set(
            next
              ? {
                status: "connected",
                connectorId: id,
                connection: this.accept(next),
              }
              : disconnected,
          );
        } catch (error) {
          this.set({ status: "disconnected", error });
        }
      });
      return connection;
    } catch (error) {
      if (revision === this.revision) {
        this.set({ status: "disconnected", error });
      }
      throw error;
    }
  }
  /** Clear local authority immediately, even if wallet-side disconnect fails. */
  async disconnect(): Promise<void> {
    const id = this.activeConnectorId;
    this.activeConnectorId = undefined;
    ++this.revision;
    this.cleanup?.();
    this.cleanup = undefined;
    this.set(disconnected);
    if (id) await this.connector(id).disconnect?.();
  }
  /** Release listeners without prompting or disconnecting an external wallet. */
  destroy(): void {
    this.activeConnectorId = undefined;
    ++this.revision;
    this.cleanup?.();
    this.cleanup = undefined;
    this.set(disconnected);
    this.listeners.clear();
  }
}
/** Create request-scoped configuration. */
export function createColibriConfig(
  options: ColibriConfigOptions,
): ColibriConfig {
  return new ColibriConfig(options);
}
