import { WebAuthCode, WebAuthError } from "@/error.ts";
import type { WebAuthProtocol } from "@/types.ts";

interface AuthenticatedTokenContext {
  protocol: WebAuthProtocol;
  account: string;
  memo?: string;
  homeDomain: string;
  webAuthDomain: string;
  clientDomain?: string;
  now?: number;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeClaims(token: string): Readonly<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new WebAuthError({
      code: WebAuthCode.INVALID_TOKEN,
      message: "Invalid JWT",
      details: "A JWT must contain three non-empty dot-separated parts.",
    });
  }
  try {
    const claims = JSON.parse(decodeBase64Url(parts[1]));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
      throw new WebAuthError({
        code: WebAuthCode.INVALID_TOKEN_PAYLOAD_TYPE,
        message: "Invalid JWT payload",
        details: "The token payload must be a JSON object.",
      });
    }
    return Object.freeze({ ...claims });
  } catch (cause) {
    if (cause instanceof WebAuthError) {
      throw cause;
    }
    throw new WebAuthError({
      code: WebAuthCode.INVALID_TOKEN,
      message: "Invalid JWT payload",
      details: "The token payload is not valid base64url-encoded JSON.",
      cause,
    });
  }
}

function numericDate(
  claims: Readonly<Record<string, unknown>>,
  name: "iat" | "exp",
): number {
  const value = claims[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WebAuthError({
      code: WebAuthCode.INVALID_TOKEN,
      message: `Invalid JWT ${name} claim`,
      details: `${name} must be an RFC 7519 NumericDate.`,
      data: { claim: name },
    });
  }
  return value;
}

function requiredString(
  claims: Readonly<Record<string, unknown>>,
  name: "iss" | "sub",
): string {
  const value = claims[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new WebAuthError({
      code: WebAuthCode.INVALID_TOKEN,
      message: `Invalid JWT ${name} claim`,
      details: `${name} must be a non-empty string.`,
      data: { claim: name },
    });
  }
  return value;
}

/** Decoded WebAuth JWT plus optional authenticated protocol context. */
export class WebAuthToken {
  readonly #token: string;
  readonly #claims: Readonly<Record<string, unknown>>;
  readonly #protocol?: WebAuthProtocol;
  readonly #account?: string;
  readonly #homeDomain?: string;
  readonly #webAuthDomain?: string;

  private constructor(
    token: string,
    claims: Readonly<Record<string, unknown>>,
    context?: AuthenticatedTokenContext,
  ) {
    this.#token = token;
    this.#claims = claims;
    this.#protocol = context?.protocol;
    this.#account = context?.account;
    this.#homeDomain = context?.homeDomain;
    this.#webAuthDomain = context?.webAuthDomain;
  }

  /** Decodes a JWT without claiming signature verification or authentication. */
  static decode(token: string): WebAuthToken {
    return new WebAuthToken(token, decodeClaims(token));
  }

  /** @internal Validates a token returned by a completed WebAuth exchange. */
  static authenticated(
    token: string,
    context: AuthenticatedTokenContext,
  ): WebAuthToken {
    const claims = decodeClaims(token);
    const issuer = requiredString(claims, "iss");
    try {
      new URL(issuer);
    } catch (cause) {
      throw new WebAuthError({
        code: WebAuthCode.INVALID_TOKEN,
        message: "Invalid JWT issuer",
        details: "The iss claim must be a URI.",
        protocol: context.protocol,
        cause,
      });
    }
    const subject = requiredString(claims, "sub");
    numericDate(claims, "iat");
    const expiresAt = numericDate(claims, "exp");
    const now = context.now ?? Math.floor(Date.now() / 1_000);
    if (now >= expiresAt) {
      throw new WebAuthError({
        code: WebAuthCode.TOKEN_EXPIRED,
        message: "WebAuth token has expired",
        protocol: context.protocol,
        data: { expiresAt, now },
      });
    }

    const expectedSubject = context.protocol === "sep10" && context.memo
      ? `${context.account}:${context.memo}`
      : context.account;
    if (subject !== expectedSubject) {
      throw new WebAuthError({
        code: WebAuthCode.TOKEN_CONTEXT_MISMATCH,
        message: "WebAuth token subject does not match the authentication",
        protocol: context.protocol,
        data: { expected: expectedSubject, actual: subject },
      });
    }

    const claimClientDomain = claims.client_domain;
    if (
      context.clientDomain
        ? claimClientDomain !== context.clientDomain
        : claimClientDomain !== undefined
    ) {
      throw new WebAuthError({
        code: WebAuthCode.TOKEN_CONTEXT_MISMATCH,
        message:
          "WebAuth token client domain does not match the authentication",
        protocol: context.protocol,
        data: {
          expected: context.clientDomain,
          actual: claimClientDomain,
        },
      });
    }

    return new WebAuthToken(token, claims, context);
  }

  /** Raw JWT string. */
  get token(): string {
    return this.#token;
  }

  /** Protocol selected by an authenticated flow, when available. */
  get protocol(): WebAuthProtocol | undefined {
    return this.#protocol;
  }

  /** Account bound by an authenticated flow, when available. */
  get account(): string | undefined {
    return this.#account;
  }

  /** JWT subject claim. */
  get subject(): string | undefined {
    return typeof this.#claims.sub === "string" ? this.#claims.sub : undefined;
  }

  /** JWT issuer claim. */
  get issuer(): string | undefined {
    return typeof this.#claims.iss === "string" ? this.#claims.iss : undefined;
  }

  /** JWT issued-at date. */
  get issuedAt(): Date | undefined {
    return typeof this.#claims.iat === "number"
      ? new Date(this.#claims.iat * 1_000)
      : undefined;
  }

  /** JWT expiration date. */
  get expiresAt(): Date | undefined {
    return typeof this.#claims.exp === "number"
      ? new Date(this.#claims.exp * 1_000)
      : undefined;
  }

  /** Optional JWT identifier. */
  get jti(): string | undefined {
    return typeof this.#claims.jti === "string" ? this.#claims.jti : undefined;
  }

  /** Home domain bound by an authenticated flow. */
  get homeDomain(): string | undefined {
    return this.#homeDomain;
  }

  /** Web-auth domain bound by an authenticated flow. */
  get webAuthDomain(): string | undefined {
    return this.#webAuthDomain;
  }

  /** Optional client-domain JWT claim. */
  get clientDomain(): string | undefined {
    return typeof this.#claims.client_domain === "string"
      ? this.#claims.client_domain
      : undefined;
  }

  /** Defensive copy of all application and standard claims. */
  get claims(): Readonly<Record<string, unknown>> {
    return { ...this.#claims };
  }

  /** Returns the raw JWT. */
  toString(): string {
    return this.#token;
  }
}
