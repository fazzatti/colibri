/**
 * SEP-10 JWT Token
 *
 * Decodes and provides easy access to SEP-10 JWT token claims.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md#token
 */

import * as E from "@/client/error.ts";

/**
 * Standard JWT claims
 */
interface JwtClaims {
  /** Subject - the authenticated Stellar account */
  sub?: string;
  /** Issuer - the auth server URL */
  iss?: string;
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Issued at time (Unix timestamp) */
  iat?: number;
  /** JWT ID - unique token identifier */
  jti?: string;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Decodes a base64url string to UTF-8
 */
function base64urlDecode(str: string): string {
  // Replace URL-safe characters with standard base64
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

/**
 * Sep10Jwt - A decoded SEP-10 JWT token.
 *
 * Provides easy access to JWT claims without signature verification.
 * Trust is established via challenge transaction verification, not JWT signature.
 *
 * @example
 * ```typescript
 * const jwt = Sep10Jwt.fromToken(tokenString);
 *
 * console.log(jwt.subject);    // "GCLIENT..."
 * console.log(jwt.expiresAt);  // Date
 * console.log(jwt.isExpired);  // false
 *
 * // Use raw token for API calls
 * fetch(url, {
 *   headers: { Authorization: `Bearer ${jwt.token}` }
 * });
 * ```
 */
export class Sep10Jwt {
  private readonly _token: string;
  private readonly _claims: JwtClaims;

  private constructor(token: string, claims: JwtClaims) {
    this._token = token;
    this._claims = claims;
  }

  /**
   * Creates a Sep10Jwt from a raw token string.
   *
   * @param token - The raw JWT string (header.payload.signature)
   * @returns A Sep10Jwt instance
   * @throws {INVALID_JWT} If the token is malformed
   *
   * @example
   * ```typescript
   * const jwt = Sep10Jwt.fromToken(tokenString);
   * ```
   */
  static fromToken(token: string): Sep10Jwt {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new E.INVALID_JWT(
        token,
        `JWT must have 3 parts, got ${parts.length}`
      );
    }

    let claims: JwtClaims;
    try {
      const payloadJson = base64urlDecode(parts[1]);
      claims = JSON.parse(payloadJson);
    } catch (error) {
      throw new E.INVALID_JWT(token, `Failed to decode JWT payload: ${error}`);
    }

    return new Sep10Jwt(token, claims);
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * The raw JWT token string.
   * Use this for Authorization headers.
   */
  get token(): string {
    return this._token;
  }

  /**
   * The authenticated Stellar account (sub claim).
   * Can be a G... or M... address.
   */
  get subject(): string | undefined {
    return this._claims.sub;
  }

  /**
   * The issuer URL (iss claim).
   * Typically the auth server URL.
   */
  get issuer(): string | undefined {
    return this._claims.iss;
  }

  /**
   * When the token expires.
   */
  get expiresAt(): Date | undefined {
    if (this._claims.exp === undefined) {
      return undefined;
    }
    return new Date(this._claims.exp * 1000);
  }

  /**
   * When the token was issued.
   */
  get issuedAt(): Date | undefined {
    if (this._claims.iat === undefined) {
      return undefined;
    }
    return new Date(this._claims.iat * 1000);
  }

  /**
   * Whether the token has expired.
   */
  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false; // No expiration = never expires
    }
    return new Date() > this.expiresAt;
  }

  /**
   * Time until expiration in milliseconds.
   * Negative if already expired.
   */
  get timeUntilExpiration(): number | undefined {
    if (!this.expiresAt) {
      return undefined;
    }
    return this.expiresAt.getTime() - Date.now();
  }

  /**
   * The unique token identifier (jti claim).
   */
  get jti(): string | undefined {
    return this._claims.jti;
  }

  /**
   * The home domain from SEP-10 (if included in claims).
   */
  get homeDomain(): string | undefined {
    return this._claims.home_domain as string | undefined;
  }

  /**
   * The client domain from SEP-10 (if client domain verification was used).
   */
  get clientDomain(): string | undefined {
    return this._claims.client_domain as string | undefined;
  }

  /**
   * The web auth domain from SEP-10.
   */
  get webAuthDomain(): string | undefined {
    return this._claims.web_auth_domain as string | undefined;
  }

  /**
   * The muxed account ID if an M... address was used.
   */
  get muxedAccountId(): string | undefined {
    // Some servers include this separately
    return this._claims.muxed_account_id as string | undefined;
  }

  /**
   * The memo if memo-based account identification was used.
   */
  get memo(): string | undefined {
    // Some servers include this
    return this._claims.memo as string | undefined;
  }

  /**
   * All raw claims from the JWT payload.
   */
  get claims(): Readonly<JwtClaims> {
    return { ...this._claims };
  }

  /**
   * Returns the raw token string.
   */
  toString(): string {
    return this._token;
  }

  /**
   * Returns a JSON representation of the JWT.
   */
  toJSON(): Record<string, unknown> {
    return {
      token: this._token,
      subject: this.subject,
      issuer: this.issuer,
      expiresAt: this.expiresAt?.toISOString(),
      issuedAt: this.issuedAt?.toISOString(),
      isExpired: this.isExpired,
      homeDomain: this.homeDomain,
      clientDomain: this.clientDomain,
    };
  }
}
