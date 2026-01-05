/**
 * SEP-10 Client
 *
 * Client for SEP-10 Web Authentication flow.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

import type { Keypair } from "stellar-sdk";
import type { Signer } from "@colibri/core";
import type { StellarToml } from "@colibri/core";
import { SEP10Challenge } from "@/challenge/challenge.ts";
import { Sep10Jwt } from "@/client/jwt.ts";
import type { VerifyChallengeOptions } from "@/types.ts";
import * as E from "@/client/error.ts";

/**
 * Configuration for Sep10Client
 */
export interface Sep10ClientConfig {
  /** The SEP-10 auth endpoint URL (from stellar.toml WEB_AUTH_ENDPOINT) */
  authEndpoint: string;
  /** The server's signing public key (from stellar.toml SIGNING_KEY) */
  serverPublicKey: string;
  /** The expected home domain */
  homeDomain: string;
  /** The Stellar network passphrase */
  networkPassphrase: string;
  /** Optional expected web auth domain (defaults to authEndpoint hostname) */
  webAuthDomain?: string;
  /** Optional custom fetch implementation for testing */
  fetch?: typeof fetch;
  /** Optional request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Options for getting a challenge
 */
export interface GetChallengeOptions {
  /** The client account to authenticate (G... or M...) */
  account: string;
  /** Optional memo for shared account identification */
  memo?: string;
  /** Optional client domain for client domain verification */
  clientDomain?: string;
}

/**
 * Options for the full authentication flow
 */
export interface AuthenticateOptions extends GetChallengeOptions {
  /** The signer(s) to sign the challenge with */
  signer: Keypair | Signer | (Keypair | Signer)[];
  /** Additional signers for multi-sig scenarios */
  extraSigners?: (Keypair | Signer)[];
}

/**
 * Sep10Client - Client for SEP-10 Web Authentication.
 *
 * Handles the complete SEP-10 authentication flow:
 * 1. Fetch challenge from server
 * 2. Verify challenge structure and server signature
 * 3. Sign challenge with client key(s)
 * 4. Submit signed challenge to server
 * 5. Return JWT token
 *
 * @example
 * ```typescript
 * // Create client with config
 * const client = new Sep10Client({
 *   authEndpoint: "https://auth.example.com/auth",
 *   serverPublicKey: "GSERVER...",
 *   homeDomain: "example.com",
 *   networkPassphrase: Networks.TESTNET,
 * });
 *
 * // Full authentication flow
 * const jwt = await client.authenticate({
 *   account: clientPublicKey,
 *   signer: clientKeypair,
 * });
 *
 * // Or step-by-step for complex signing
 * const challenge = await client.getChallenge({ account: clientPublicKey });
 * challenge.sign(signer1).sign(signer2);
 * const jwt = await client.submitChallenge(challenge);
 * ```
 */
export class Sep10Client {
  private readonly _config: Required<
    Omit<Sep10ClientConfig, "webAuthDomain" | "fetch" | "timeout">
  > & {
    webAuthDomain?: string;
    fetch: typeof fetch;
    timeout: number;
  };

  constructor(config: Sep10ClientConfig) {
    this._config = {
      authEndpoint: config.authEndpoint,
      serverPublicKey: config.serverPublicKey,
      homeDomain: config.homeDomain,
      networkPassphrase: config.networkPassphrase,
      webAuthDomain: config.webAuthDomain,
      fetch: config.fetch ?? globalThis.fetch,
      timeout: config.timeout ?? 30000,
    };
  }

  // ===========================================================================
  // Factory Methods
  // ===========================================================================

  /**
   * Creates a Sep10Client from a StellarToml instance.
   *
   * @param toml - The StellarToml instance from `StellarToml.fromDomain()`
   * @param networkPassphrase - Optional network passphrase override (uses toml.networkPassphrase if available)
   * @returns A Sep10Client instance
   * @throws {MISSING_AUTH_ENDPOINT} If WEB_AUTH_ENDPOINT is missing from toml
   * @throws {INVALID_TOML} If SIGNING_KEY is missing or domain is unknown
   *
   * @example
   * ```typescript
   * import { StellarToml } from "@colibri/core";
   *
   * const toml = await StellarToml.fromDomain("example.com");
   * const client = Sep10Client.fromToml(toml);
   * ```
   */
  static fromToml(toml: StellarToml, networkPassphrase?: string): Sep10Client {
    // Validate domain first so we can use it in subsequent error messages
    const homeDomain = toml.domain;
    if (!homeDomain) {
      throw new E.INVALID_TOML("unknown", "domain");
    }

    if (!toml.webAuthEndpoint) {
      throw new E.MISSING_AUTH_ENDPOINT(homeDomain);
    }

    if (!toml.signingKey) {
      throw new E.INVALID_TOML(homeDomain, "SIGNING_KEY");
    }

    const passphrase = networkPassphrase ?? toml.networkPassphrase;
    if (!passphrase) {
      throw new E.INVALID_TOML(homeDomain, "NETWORK_PASSPHRASE");
    }

    // Extract web auth domain from endpoint URL
    let webAuthDomain: string;
    try {
      webAuthDomain = new URL(toml.webAuthEndpoint).hostname;
    } catch {
      throw new E.INVALID_TOML(homeDomain, "WEB_AUTH_ENDPOINT");
    }

    return new Sep10Client({
      authEndpoint: toml.webAuthEndpoint,
      serverPublicKey: toml.signingKey,
      homeDomain,
      networkPassphrase: passphrase,
      webAuthDomain,
    });
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /** The auth endpoint URL */
  get authEndpoint(): string {
    return this._config.authEndpoint;
  }

  /** The server's public key */
  get serverPublicKey(): string {
    return this._config.serverPublicKey;
  }

  /** The expected home domain */
  get homeDomain(): string {
    return this._config.homeDomain;
  }

  /** The network passphrase */
  get networkPassphrase(): string {
    return this._config.networkPassphrase;
  }

  // ===========================================================================
  // Challenge Operations
  // ===========================================================================

  /**
   * Fetches a challenge from the auth server.
   *
   * The challenge is automatically verified before being returned.
   *
   * @param options - The challenge options
   * @returns A verified SEP10Challenge ready for signing
   * @throws {FETCH_CHALLENGE_FAILED} If the request fails
   * @throws {INVALID_SERVER_RESPONSE} If the response is malformed
   * @throws Challenge verification errors if the challenge is invalid
   *
   * @example
   * ```typescript
   * const challenge = await client.getChallenge({
   *   account: "GCLIENT...",
   *   memo: "12345",  // for shared accounts
   * });
   *
   * // Sign with your key(s)
   * challenge.sign(clientKeypair);
   *
   * // Submit
   * const jwt = await client.submitChallenge(challenge);
   * ```
   */
  async getChallenge(options: GetChallengeOptions): Promise<SEP10Challenge> {
    const { account, memo, clientDomain } = options;

    // Build URL with query params
    const url = new URL(this._config.authEndpoint);
    url.searchParams.set("account", account);
    if (memo) {
      url.searchParams.set("memo", memo);
    }
    if (clientDomain) {
      url.searchParams.set("client_domain", clientDomain);
    }

    // Fetch challenge
    let response: Response;
    try {
      response = await this._fetchWithTimeout(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      if (error instanceof E.TIMEOUT) {
        throw error;
      }
      throw new E.FETCH_CHALLENGE_FAILED(url.toString(), error as Error);
    }

    if (!response.ok) {
      throw new E.FETCH_CHALLENGE_FAILED(
        url.toString(),
        undefined,
        response.status,
        response.statusText
      );
    }

    // Parse response
    let body: { transaction?: string; network_passphrase?: string };
    try {
      body = await response.json();
    } catch (error) {
      throw new E.INVALID_SERVER_RESPONSE(url.toString(), String(error));
    }

    if (!body.transaction) {
      throw new E.INVALID_SERVER_RESPONSE(
        url.toString(),
        "Missing 'transaction' field in response"
      );
    }

    // Parse and verify challenge
    const challenge = SEP10Challenge.fromXDR(
      body.transaction,
      this._config.networkPassphrase
    );

    // Build verification options
    const verifyOptions: VerifyChallengeOptions = {
      homeDomain: this._config.homeDomain,
    };
    if (this._config.webAuthDomain) {
      verifyOptions.webAuthDomain = this._config.webAuthDomain;
    }

    // Verify the challenge
    challenge.verify(this._config.serverPublicKey, verifyOptions);

    return challenge;
  }

  /**
   * Submits a signed challenge to the auth server.
   *
   * @param challenge - The signed SEP10Challenge
   * @returns The JWT token
   * @throws {SUBMIT_CHALLENGE_FAILED} If the request fails
   * @throws {MISSING_JWT} If the response doesn't contain a token
   *
   * @example
   * ```typescript
   * challenge.sign(clientKeypair);
   * const jwt = await client.submitChallenge(challenge);
   *
   * // Use the token
   * console.log(jwt.subject);  // authenticated account
   * ```
   */
  async submitChallenge(challenge: SEP10Challenge): Promise<Sep10Jwt> {
    const url = this._config.authEndpoint;

    let response: Response;
    try {
      response = await this._fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          transaction: challenge.toXDR(),
        }),
      });
    } catch (error) {
      if (error instanceof E.TIMEOUT) {
        throw error;
      }
      throw new E.SUBMIT_CHALLENGE_FAILED(url, error as Error);
    }

    // Parse response body for error details
    let body: { token?: string; error?: string };
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    if (!response.ok) {
      throw new E.SUBMIT_CHALLENGE_FAILED(
        url,
        undefined,
        response.status,
        response.statusText,
        body.error
      );
    }

    if (!body.token) {
      throw new E.MISSING_JWT(url);
    }

    return Sep10Jwt.fromToken(body.token);
  }

  /**
   * Performs the complete authentication flow.
   *
   * Fetches challenge, signs it, submits it, and returns the JWT.
   *
   * @param options - Authentication options including signer(s)
   * @returns The JWT token
   *
   * @example
   * ```typescript
   * // Simple case - single signer
   * const jwt = await client.authenticate({
   *   account: clientPublicKey,
   *   signer: clientKeypair,
   * });
   *
   * // Multi-sig case
   * const jwt = await client.authenticate({
   *   account: clientPublicKey,
   *   signer: [signer1, signer2],
   * });
   *
   * // With extra signers (e.g., client domain signer)
   * const jwt = await client.authenticate({
   *   account: clientPublicKey,
   *   signer: clientKeypair,
   *   extraSigners: [clientDomainSigner],
   *   clientDomain: "wallet.example.com",
   * });
   * ```
   */
  async authenticate(options: AuthenticateOptions): Promise<Sep10Jwt> {
    const { signer, extraSigners, ...challengeOptions } = options;

    // Get challenge
    const challenge = await this.getChallenge(challengeOptions);

    // Sign with primary signer(s)
    const signers = Array.isArray(signer) ? signer : [signer];
    for (const s of signers) {
      challenge.sign(s);
    }

    // Sign with extra signers if provided
    if (extraSigners) {
      for (const s of extraSigners) {
        challenge.sign(s);
      }
    }

    // Submit and return JWT
    return this.submitChallenge(challenge);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Fetch with timeout support
   */
  private async _fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort();
    }, this._config.timeout);

    try {
      const response = await this._config.fetch(url, {
        ...init,
        signal: controller.signal,
      });
      globalThis.clearTimeout(timeoutId);
      return response;
    } catch (error) {
      globalThis.clearTimeout(timeoutId);
      if ((error as Error).name === "AbortError") {
        throw new E.TIMEOUT(url, this._config.timeout);
      }
      throw error;
    }
  }
}
