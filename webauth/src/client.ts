import {
  type StellarToml,
  StellarToml as StellarTomlFacade,
} from "@colibri/core";
import { rpc, StrKey } from "stellar-sdk";
import { WebAuthCode, WebAuthError } from "@/error.ts";
import { protocolForAccount } from "@/routing.ts";
import { Sep10Client } from "@/sep10/client.ts";
import { Sep45Client } from "@/sep45/client.ts";
import type {
  Sep10AuthenticationOptions,
  Sep45AuthenticationOptions,
  WebAuthAuthenticationOptions,
  WebAuthClientConfig,
  WebAuthConstructionOptions,
  WebAuthCoreNetworkConfig,
  WebAuthProtocol,
} from "@/types.ts";
import type { WebAuthToken } from "@/token.ts";

function validateEndpoint(
  endpoint: string,
  allowHttp: boolean,
  protocol: WebAuthProtocol,
): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (cause) {
    throw new WebAuthError({
      code: WebAuthCode.INCOMPLETE_CONFIGURATION,
      message: `Invalid ${protocol.toUpperCase()} endpoint`,
      protocol,
      cause,
    });
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new WebAuthError({
      code: WebAuthCode.INCOMPLETE_CONFIGURATION,
      message: `${protocol.toUpperCase()} endpoint must use HTTPS`,
      protocol,
      data: { protocol: url.protocol },
    });
  }
  return url;
}

function hasOwn(value: object, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

/** Unified SEP-10 and SEP-45 WebAuth client with explicit routing. */
export class WebAuthClient {
  readonly #homeDomain: string;
  readonly #network: WebAuthCoreNetworkConfig;
  readonly #sep10?: Sep10Client;
  readonly #sep45?: Sep45Client;

  /** Creates a client from direct, complete protocol configuration. */
  constructor(config: WebAuthClientConfig) {
    if (
      !config.homeDomain || !StrKey.isValidEd25519PublicKey(config.signingKey)
    ) {
      throw new WebAuthError({
        code: WebAuthCode.INCOMPLETE_CONFIGURATION,
        message: "WebAuth requires a home domain and valid server signing key",
      });
    }
    if (!config.sep10 && !config.sep45) {
      throw new WebAuthError({
        code: WebAuthCode.INCOMPLETE_CONFIGURATION,
        message: "WebAuth requires at least one advertised protocol",
      });
    }
    this.#homeDomain = config.homeDomain.replace(/\/+$/, "");
    this.#network = config.network;
    const allowHttp = config.allowHttp ?? config.network.allowHttp ?? false;
    if (config.sep10) {
      const endpoint = validateEndpoint(
        config.sep10.endpoint,
        allowHttp,
        "sep10",
      );
      this.#sep10 = new Sep10Client({
        endpoint: endpoint.toString(),
        serverAccount: config.signingKey,
        homeDomain: this.#homeDomain,
        webAuthDomain: endpoint.host,
        networkPassphrase: config.network.networkPassphrase,
        fetch: config.fetch,
        timeout: config.timeout,
        allowHttp,
        submissionFormat: config.submissionFormat,
      });
    }
    if (config.sep45) {
      const endpoint = validateEndpoint(
        config.sep45.endpoint,
        allowHttp,
        "sep45",
      );
      if (!StrKey.isValidContract(config.sep45.contractId)) {
        throw new WebAuthError({
          code: WebAuthCode.INCOMPLETE_CONFIGURATION,
          message: "SEP-45 requires a valid WEB_AUTH_CONTRACT_ID",
          protocol: "sep45",
        });
      }
      if (!config.network.rpcUrl) {
        throw new WebAuthError({
          code: WebAuthCode.MISSING_RPC,
          message: "SEP-45 requires a Stellar RPC endpoint",
          protocol: "sep45",
        });
      }
      this.#sep45 = new Sep45Client({
        endpoint: endpoint.toString(),
        serverAccount: config.signingKey,
        homeDomain: this.#homeDomain,
        webAuthDomain: endpoint.host,
        webAuthContractId: config.sep45.contractId,
        networkPassphrase: config.network.networkPassphrase,
        rpc: new rpc.Server(config.network.rpcUrl, { allowHttp }),
        fetch: config.fetch,
        timeout: config.timeout,
        allowHttp,
        submissionFormat: config.submissionFormat,
      });
    }
  }

  /** Discovers WebAuth configuration from a home-domain stellar.toml. */
  static async fromDomain(
    domain: string,
    options: WebAuthConstructionOptions,
  ): Promise<WebAuthClient> {
    const allowHttp = options.allowHttp ?? options.network.allowHttp ?? false;
    const toml = await StellarTomlFacade.fromDomain(domain, {
      fetchFn: options.fetch,
      timeout: options.timeout,
      allowHttp,
    });
    return WebAuthClient.fromToml(toml, options);
  }

  /** Creates a client from an existing Colibri StellarToml facade. */
  static fromToml(
    toml: StellarToml,
    options: WebAuthConstructionOptions,
  ): WebAuthClient {
    const discovery = toml.webAuthConfig;
    if (!discovery) {
      throw new WebAuthError({
        code: WebAuthCode.INCOMPLETE_CONFIGURATION,
        message: "stellar.toml has no complete WebAuth configuration",
      });
    }
    if (
      discovery.networkPassphrase !== undefined &&
      discovery.networkPassphrase !== options.network.networkPassphrase
    ) {
      throw new WebAuthError({
        code: WebAuthCode.NETWORK_MISMATCH,
        message: "stellar.toml advertises a different Stellar network",
        data: {
          expected: options.network.networkPassphrase,
          actual: discovery.networkPassphrase,
        },
      });
    }
    return new WebAuthClient({
      ...options,
      homeDomain: discovery.homeDomain,
      signingKey: discovery.signingKey,
      sep10: discovery.sep10,
      sep45: discovery.sep45,
    });
  }

  /** Home domain to which this client is bound. */
  get homeDomain(): string {
    return this.#homeDomain;
  }

  /** Authoritative network configuration. */
  get network(): WebAuthCoreNetworkConfig {
    return this.#network;
  }

  /** Whether the home domain completely advertised a protocol. */
  supports(protocol: WebAuthProtocol): boolean {
    return protocol === "sep10"
      ? this.#sep10 !== undefined
      : this.#sep45 !== undefined;
  }

  /** Selects a protocol using full StrKey validation. */
  protocolFor(account: string): WebAuthProtocol {
    return protocolForAccount(account);
  }

  /** Explicit SEP-10 client. */
  get sep10(): Sep10Client {
    if (!this.#sep10) {
      throw new WebAuthError({
        code: WebAuthCode.PROTOCOL_NOT_ADVERTISED,
        message: "The home domain does not advertise SEP-10",
        protocol: "sep10",
      });
    }
    return this.#sep10;
  }

  /** Explicit SEP-45 client. */
  get sep45(): Sep45Client {
    if (!this.#sep45) {
      throw new WebAuthError({
        code: WebAuthCode.PROTOCOL_NOT_ADVERTISED,
        message: "The home domain does not advertise SEP-45",
        protocol: "sep45",
      });
    }
    return this.#sep45;
  }

  /** Authenticates through the sole protocol selected by the account type. */
  async authenticate(
    options: WebAuthAuthenticationOptions,
  ): Promise<WebAuthToken> {
    const protocol = this.protocolFor(options.account);
    if (protocol === "sep10") {
      if (
        hasOwn(options, "authorize") ||
        hasOwn(options, "authorizationValidityLedgers")
      ) {
        throw new WebAuthError({
          code: WebAuthCode.OPTION_MISMATCH,
          message:
            "SEP-45 authorization options cannot be used with G or M accounts",
          protocol,
        });
      }
      if (!hasOwn(options, "signer")) {
        throw new WebAuthError({
          code: WebAuthCode.OPTION_MISMATCH,
          message: "SEP-10 requires a signer",
          protocol,
        });
      }
      return await this.sep10.authenticate(
        options as Sep10AuthenticationOptions,
      );
    }

    if (hasOwn(options, "signer") || hasOwn(options, "memo")) {
      throw new WebAuthError({
        code: WebAuthCode.OPTION_MISMATCH,
        message:
          "SEP-10 signing and memo options cannot be used with C accounts",
        protocol,
      });
    }
    if (!hasOwn(options, "authorize")) {
      throw new WebAuthError({
        code: WebAuthCode.OPTION_MISMATCH,
        message: "SEP-45 requires an authorization handler",
        protocol,
      });
    }
    return await this.sep45.authenticate(
      options as Sep45AuthenticationOptions,
    );
  }
}
