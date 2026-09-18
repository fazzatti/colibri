import type {
  WebAuthAuthenticationOptions,
  WebAuthClient,
  WebAuthToken,
} from "@colibri/webauth";
import type { ColibriConfig } from "@/context/config.ts";
import {
  ReactConnectionChangedError,
  ReactInvalidConfigError,
  ReactInvalidSessionError,
  ReactNetworkMismatchError,
} from "@/errors/index.ts";
/** Shared in-memory session state. Tokens never enter TanStack Query or browser storage. */
export interface SessionState {
  /** Current authentication state. */
  status: "anonymous" | "authenticating" | "authenticated";
  /** Token returned by the completed, context-validated exchange. */
  token?: WebAuthToken;
}
const anonymous: SessionState = Object.freeze({ status: "anonymous" });
/** Request-scoped WebAuth session; construct once and dispose with its application scope. */
export class WebAuthSession {
  private state: SessionState = anonymous;
  private listeners = new Set<() => void>();
  private revision = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: () => void;
  private disposed = false;
  private authentication: AbortController | undefined;
  /** Bind authentication to a provider and an existing unified SEP-10/45 client. */
  constructor(readonly config: ColibriConfig, readonly client: WebAuthClient) {
    if (client.network.networkPassphrase !== config.network.networkPassphrase) {
      throw new ReactNetworkMismatchError(
        "WebAuth and provider networks differ",
      );
    }
    this.unsubscribe = config.subscribe(() => this.logout());
  }
  /** Stable snapshot; expires locally at the token deadline. */
  getSnapshot = (): SessionState => this.state;
  /** Server rendering exposes no token. */
  getServerSnapshot = (): SessionState => anonymous;
  /** Subscribe to changes; subscriptions share this session. */
  subscribe = (listener: () => void): () => void => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** @internal */
  private set(state: SessionState): void {
    this.state = Object.freeze(state);
    this.listeners.forEach((fn) => fn());
  }
  /** @internal */
  private expire(token: WebAuthToken): void {
    const remaining = token.expiresAt!.getTime() - Date.now();
    if (remaining <= 0) {
      this.logout();
      return;
    }
    this.timer = setTimeout(
      () => this.expire(token),
      Math.min(remaining, 2147483647),
    );
  }
  /** Authenticate with explicit protocol-specific signer/authorization options. No implicit wallet adaptation. */
  async authenticate(
    options: WebAuthAuthenticationOptions,
  ): Promise<WebAuthToken> {
    if (this.disposed) {
      throw new ReactInvalidConfigError("The WebAuth session was disposed");
    }
    const connection = this.config.getSnapshot().connection;
    if (connection && connection.address !== options.account) {
      throw new ReactConnectionChangedError(
        "Authentication account differs from the active connection",
      );
    }
    this.logout();
    const revision = this.revision;
    const authentication = this.authentication = new AbortController();
    this.set({ status: "authenticating" });
    try {
      const token = await this.client.authenticate(
        "signer" in options
          ? {
            ...options,
            signal: options.signal
              ? AbortSignal.any([options.signal, authentication.signal])
              : authentication.signal,
          }
          : options,
      );
      if (revision !== this.revision) {
        throw new ReactConnectionChangedError(
          "The session changed during authentication",
        );
      }
      if (
        token.account !== options.account ||
        token.homeDomain !== this.client.homeDomain || !token.protocol ||
        !token.expiresAt || token.expiresAt.getTime() <= Date.now()
      ) {
        throw new ReactInvalidSessionError(
          "WebAuth did not return a current token bound to this exchange",
        );
      }
      this.set({ status: "authenticated", token });
      this.expire(token);
      return token;
    } catch (error) {
      if (revision === this.revision) this.logout();
      throw error;
    }
  }
  /** Forget local credentials and invalidate outstanding authentication. Does not revoke server-side sessions. */
  logout = (): void => {
    ++this.revision;
    this.authentication?.abort(
      new ReactConnectionChangedError(
        "The session changed during authentication",
      ),
    );
    this.authentication = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.set(anonymous);
  };
  /** Release timers, connection subscription and listeners. */
  destroy(): void {
    this.disposed = true;
    this.unsubscribe();
    this.logout();
    this.listeners.clear();
  }
}
/** Create a shared session outside rendering, scoped to one application or server request. */
export function createWebAuthSession(
  config: ColibriConfig,
  client: WebAuthClient,
): WebAuthSession {
  return new WebAuthSession(config, client);
}
