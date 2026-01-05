/**
 * SEP-1: Stellar Info File (stellar.toml) parser and fetcher
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md
 */
import { parse as parseToml } from "@std/toml";
import { StrKey } from "@/strkeys/index.ts";
import { regex } from "@/common/regex/index.ts";
import type { Ed25519PublicKey, ContractId } from "@/strkeys/types.ts";
import type {
  StellarTomlData,
  StellarTomlDocumentation,
  StellarTomlPrincipal,
  StellarTomlCurrency,
  StellarTomlValidator,
  StellarTomlOptions,
  StellarTomlParseOptions,
  Sep10Config,
  Sep45Config,
} from "@/sep1/types.ts";
import * as E from "@/sep1/error.ts";

/** Maximum file size allowed by SEP-1 specification (100KB) */
const MAX_FILE_SIZE = 100 * 1024;

/** Default timeout for fetch requests (10 seconds) */
const DEFAULT_TIMEOUT = 10000;

/** URL fields that require HTTPS validation */
const HTTPS_URL_FIELDS = [
  "FEDERATION_SERVER",
  "AUTH_SERVER",
  "TRANSFER_SERVER",
  "TRANSFER_SERVER_SEP0024",
  "KYC_SERVER",
  "WEB_AUTH_ENDPOINT",
  "WEB_AUTH_FOR_CONTRACTS_ENDPOINT",
  "HORIZON_URL",
  "DIRECT_PAYMENT_SERVER",
  "ANCHOR_QUOTE_SERVER",
  "ORG_URL",
] as const;

/** Fields containing Stellar public keys (G...) */
const SIGNING_KEY_FIELDS = ["SIGNING_KEY", "URI_REQUEST_SIGNING_KEY"] as const;

/**
 * StellarToml - Parser and fetcher for SEP-1 stellar.toml files
 *
 * Provides functionality to:
 * - Fetch stellar.toml from a domain
 * - Parse raw TOML content
 * - Validate fields according to SEP-1 specification
 * - Extract configuration for other SEPs (SEP-10, SEP-45)
 *
 * @example
 * ```typescript
 * // Fetch from domain
 * const toml = await StellarToml.fromDomain("stellar.org");
 * console.log(toml.signingKey);
 *
 * // Parse raw content
 * const toml = StellarToml.fromString(rawTomlContent);
 *
 * // Get SEP-10 config
 * const sep10 = toml.sep10Config;
 * if (sep10) {
 *   console.log(sep10.webAuthEndpoint);
 * }
 * ```
 */
export class StellarToml {
  private readonly _data: StellarTomlData;
  private readonly _domain?: string;

  private constructor(data: StellarTomlData, domain?: string) {
    this._data = data;
    this._domain = domain;
  }

  // ===========================================================================
  // Factory Methods
  // ===========================================================================

  /**
   * Fetches and parses a stellar.toml from a domain.
   *
   * @param domain - The domain to fetch from (e.g., "stellar.org")
   * @param options - Fetch and parse options
   * @returns Promise resolving to a StellarToml instance
   * @throws {INVALID_DOMAIN} If the domain format is invalid
   * @throws {FETCH_FAILED} If the HTTP request fails
   * @throws {TIMEOUT} If the request times out
   * @throws {FILE_TOO_LARGE} If the file exceeds 100KB
   * @throws {PARSE_ERROR} If the TOML content is invalid
   *
   * @example
   * ```typescript
   * const toml = await StellarToml.fromDomain("stellar.org");
   *
   * // With options
   * const toml = await StellarToml.fromDomain("localhost:8000", {
   *   allowHttp: true,
   *   timeout: 5000,
   *   validate: false,
   * });
   * ```
   */
  static async fromDomain(
    domain: string,
    options: StellarTomlOptions = {}
  ): Promise<StellarToml> {
    const {
      timeout = DEFAULT_TIMEOUT,
      allowHttp = false,
      fetchFn = fetch,
      validate = true,
    } = options;

    // Validate domain format
    const cleanDomain = domain.replace(/\/+$/, ""); // Remove trailing slashes
    if (!regex.domain.test(cleanDomain) && !cleanDomain.includes("localhost")) {
      // Allow localhost for testing
      if (cleanDomain.includes("://")) {
        throw new E.INVALID_DOMAIN(domain);
      }
    }

    const protocol = allowHttp ? "http" : "https";
    const url = `${protocol}://${cleanDomain}/.well-known/stellar.toml`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/plain, application/toml",
        },
      });

      if (!response.ok) {
        throw new E.FETCH_FAILED(
          cleanDomain,
          undefined,
          response.status,
          response.statusText
        );
      }

      // Check content length if available
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
        throw new E.FILE_TOO_LARGE(
          cleanDomain,
          parseInt(contentLength, 10),
          MAX_FILE_SIZE
        );
      }

      const text = await response.text();

      // Check actual size after reading
      if (text.length > MAX_FILE_SIZE) {
        throw new E.FILE_TOO_LARGE(cleanDomain, text.length, MAX_FILE_SIZE);
      }

      clearTimeout(timeoutId);
      return StellarToml.fromString(text, { validate, allowHttp }, cleanDomain);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof E.Sep1Error) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new E.TIMEOUT(cleanDomain, timeout);
      }

      throw new E.FETCH_FAILED(
        cleanDomain,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Parses a stellar.toml from a raw TOML string.
   *
   * @param content - The raw TOML content
   * @param options - Parse options (validate: boolean)
   * @param domain - Optional domain for error context
   * @returns A StellarToml instance
   * @throws {PARSE_ERROR} If the TOML content is invalid
   * @throws {INVALID_SIGNING_KEY} If validation is enabled and a signing key is invalid
   * @throws {INVALID_URL} If validation is enabled and a URL is invalid
   *
   * @example
   * ```typescript
   * const toml = StellarToml.fromString(`
   *   VERSION = "2.0.0"
   *   SIGNING_KEY = "GBXYZ..."
   * `);
   *
   * // Without validation
   * const toml = StellarToml.fromString(content, { validate: false });
   * ```
   */
  static fromString(
    content: string,
    options: StellarTomlParseOptions = {},
    domain?: string
  ): StellarToml {
    const { validate = true, allowHttp = false } = options;

    let data: StellarTomlData;

    try {
      data = parseToml(content) as StellarTomlData;
    } catch (error) {
      throw new E.PARSE_ERROR(domain, error as Error, content);
    }

    if (validate) {
      StellarToml.validate(data, domain, allowHttp);
    }

    return new StellarToml(data, domain);
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Validates the stellar.toml data according to SEP-1 specification.
   *
   * @param data - The parsed TOML data
   * @param domain - Optional domain for error context
   * @param allowHttp - Allow HTTP URLs (for testing only, SEP-1 requires HTTPS)
   * @throws {INVALID_SIGNING_KEY} If a signing key is invalid
   * @throws {INVALID_URL} If a URL is invalid
   * @throws {INVALID_ACCOUNT} If an account in ACCOUNTS is invalid
   */
  private static validate(
    data: StellarTomlData,
    domain?: string,
    allowHttp = false
  ): void {
    // Validate signing key fields
    for (const field of SIGNING_KEY_FIELDS) {
      const value = data[field];
      if (value && !StrKey.isValidEd25519PublicKey(value)) {
        throw new E.INVALID_SIGNING_KEY(field, value, domain);
      }
    }

    // Validate URL fields
    const requireHttps = !allowHttp;
    for (const field of HTTPS_URL_FIELDS) {
      const value = data[field as keyof StellarTomlData] as string | undefined;
      if (value) {
        try {
          const url = new URL(value);
          if (requireHttps && url.protocol !== "https:") {
            throw new E.INVALID_URL(field, value, domain, requireHttps);
          }
        } catch (error) {
          if (error instanceof E.INVALID_URL) throw error;
          throw new E.INVALID_URL(field, value, domain, requireHttps);
        }
      }
    }

    // Validate DOCUMENTATION.ORG_URL if present
    if (data.DOCUMENTATION?.ORG_URL) {
      try {
        const url = new URL(data.DOCUMENTATION.ORG_URL);
        if (requireHttps && url.protocol !== "https:") {
          throw new E.INVALID_URL(
            "DOCUMENTATION.ORG_URL",
            data.DOCUMENTATION.ORG_URL,
            domain,
            requireHttps
          );
        }
      } catch (error) {
        if (error instanceof E.INVALID_URL) throw error;
        throw new E.INVALID_URL(
          "DOCUMENTATION.ORG_URL",
          data.DOCUMENTATION.ORG_URL,
          domain,
          requireHttps
        );
      }
    }

    // Validate ACCOUNTS array
    if (data.ACCOUNTS) {
      for (let i = 0; i < data.ACCOUNTS.length; i++) {
        const account = data.ACCOUNTS[i];
        if (!StrKey.isValidEd25519PublicKey(account)) {
          throw new E.INVALID_ACCOUNT("ACCOUNTS", account, domain, i);
        }
      }
    }

    // Validate validator PUBLIC_KEYs
    if (data.VALIDATORS) {
      for (let i = 0; i < data.VALIDATORS.length; i++) {
        const validator = data.VALIDATORS[i];
        if (
          validator.PUBLIC_KEY &&
          !StrKey.isValidEd25519PublicKey(validator.PUBLIC_KEY)
        ) {
          throw new E.INVALID_SIGNING_KEY(
            `VALIDATORS[${i}].PUBLIC_KEY`,
            validator.PUBLIC_KEY,
            domain
          );
        }
      }
    }

    // Validate currency issuers
    if (data.CURRENCIES) {
      for (let i = 0; i < data.CURRENCIES.length; i++) {
        const currency = data.CURRENCIES[i];
        if (
          currency.issuer &&
          !StrKey.isValidEd25519PublicKey(currency.issuer)
        ) {
          throw new E.INVALID_ACCOUNT(
            `CURRENCIES[${i}].issuer`,
            currency.issuer,
            domain
          );
        }
        if (currency.contract && !StrKey.isValidContractId(currency.contract)) {
          throw new E.INVALID_ACCOUNT(
            `CURRENCIES[${i}].contract`,
            currency.contract,
            domain
          );
        }
      }
    }
  }

  // ===========================================================================
  // Getters - General Information
  // ===========================================================================

  /**
   * The domain this stellar.toml was fetched from (if applicable)
   */
  get domain(): string | undefined {
    return this._domain;
  }

  /**
   * The SEP-1 version the stellar.toml adheres to
   */
  get version(): string | undefined {
    return this._data.VERSION;
  }

  /**
   * The network passphrase for this infrastructure
   */
  get networkPassphrase(): string | undefined {
    return this._data.NETWORK_PASSPHRASE;
  }

  /**
   * The SEP-10 Web Authentication endpoint
   */
  get webAuthEndpoint(): string | undefined {
    return this._data.WEB_AUTH_ENDPOINT;
  }

  /**
   * The SEP-45 Web Authentication endpoint
   */
  get webAuthForContractsEndpoint(): string | undefined {
    return this._data.WEB_AUTH_FOR_CONTRACTS_ENDPOINT;
  }

  /**
   * The SEP-45 Web Authentication contract ID
   */
  get webAuthContractId(): string | undefined {
    return this._data.WEB_AUTH_CONTRACT_ID;
  }

  /**
   * The signing key for SEP-10/SEP-45 authentication
   */
  get signingKey(): Ed25519PublicKey | undefined {
    return this._data.SIGNING_KEY as Ed25519PublicKey | undefined;
  }

  /**
   * The SEP-2 Federation server endpoint
   */
  get federationServer(): string | undefined {
    return this._data.FEDERATION_SERVER;
  }

  /**
   * The SEP-6 Transfer server endpoint
   */
  get transferServer(): string | undefined {
    return this._data.TRANSFER_SERVER;
  }

  /**
   * The SEP-24 Transfer server endpoint
   */
  get transferServerSep24(): string | undefined {
    return this._data.TRANSFER_SERVER_SEP0024;
  }

  /**
   * The SEP-12 KYC server endpoint
   */
  get kycServer(): string | undefined {
    return this._data.KYC_SERVER;
  }

  /**
   * The Horizon server URL
   */
  get horizonUrl(): string | undefined {
    return this._data.HORIZON_URL;
  }

  /**
   * List of Stellar accounts controlled by this domain
   */
  get accounts(): Ed25519PublicKey[] {
    return (this._data.ACCOUNTS as Ed25519PublicKey[]) || [];
  }

  /**
   * The SEP-7 URI request signing key
   */
  get uriRequestSigningKey(): Ed25519PublicKey | undefined {
    return this._data.URI_REQUEST_SIGNING_KEY as Ed25519PublicKey | undefined;
  }

  /**
   * The SEP-31 direct payment server endpoint
   */
  get directPaymentServer(): string | undefined {
    return this._data.DIRECT_PAYMENT_SERVER;
  }

  /**
   * The SEP-38 anchor quote server endpoint
   */
  get anchorQuoteServer(): string | undefined {
    return this._data.ANCHOR_QUOTE_SERVER;
  }

  // ===========================================================================
  // Getters - Sections
  // ===========================================================================

  /**
   * Organization documentation
   */
  get documentation(): StellarTomlDocumentation | undefined {
    return this._data.DOCUMENTATION;
  }

  /**
   * List of principals/points of contact
   */
  get principals(): StellarTomlPrincipal[] {
    return this._data.PRINCIPALS || [];
  }

  /**
   * List of currencies/tokens
   */
  get currencies(): StellarTomlCurrency[] {
    return this._data.CURRENCIES || [];
  }

  /**
   * List of validator nodes
   */
  get validators(): StellarTomlValidator[] {
    return this._data.VALIDATORS || [];
  }

  /**
   * Raw parsed TOML data
   */
  get raw(): Readonly<StellarTomlData> {
    return this._data;
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Checks if this domain supports SEP-10 Web Authentication
   */
  hasWebAuth(): boolean {
    return !!(this._data.WEB_AUTH_ENDPOINT && this._data.SIGNING_KEY);
  }

  /**
   * Checks if this domain supports SEP-45 Web Authentication for Contracts
   */
  hasWebAuthForContracts(): boolean {
    return !!(
      this._data.WEB_AUTH_FOR_CONTRACTS_ENDPOINT &&
      this._data.SIGNING_KEY &&
      this._data.WEB_AUTH_CONTRACT_ID
    );
  }

  /**
   * Checks if this domain supports SEP-2 Federation
   */
  hasFederation(): boolean {
    return !!this._data.FEDERATION_SERVER;
  }

  /**
   * Checks if this domain supports SEP-6 Transfer
   */
  hasTransferServer(): boolean {
    return !!this._data.TRANSFER_SERVER;
  }

  /**
   * Checks if this domain supports SEP-24 Interactive Transfer
   */
  hasTransferServerSep24(): boolean {
    return !!this._data.TRANSFER_SERVER_SEP0024;
  }

  /**
   * Gets SEP-10 Web Authentication configuration
   * Returns undefined if required fields are missing
   */
  get sep10Config(): Sep10Config | undefined {
    if (!this.hasWebAuth()) {
      return undefined;
    }

    return {
      webAuthEndpoint: this._data.WEB_AUTH_ENDPOINT!,
      signingKey: this._data.SIGNING_KEY as Ed25519PublicKey,
      networkPassphrase: this._data.NETWORK_PASSPHRASE,
    };
  }

  /**
   * Gets SEP-45 Web Authentication configuration
   * Returns undefined if required fields are missing
   */
  get sep45Config(): Sep45Config | undefined {
    if (!this.hasWebAuthForContracts()) {
      return undefined;
    }

    return {
      webAuthEndpoint: this._data.WEB_AUTH_FOR_CONTRACTS_ENDPOINT!,
      signingKey: this._data.SIGNING_KEY as Ed25519PublicKey,
      contractId: this._data.WEB_AUTH_CONTRACT_ID as ContractId,
      networkPassphrase: this._data.NETWORK_PASSPHRASE,
    };
  }

  /**
   * Finds a currency by code and optionally by issuer
   *
   * @param code - The currency code to search for
   * @param issuer - Optional issuer to filter by
   * @returns The matching currency or undefined
   */
  findCurrency(code: string, issuer?: string): StellarTomlCurrency | undefined {
    return this.currencies.find((c) => {
      if (c.code !== code) return false;
      if (issuer && c.issuer !== issuer) return false;
      return true;
    });
  }

  /**
   * Finds currencies matching a code template pattern
   *
   * @param pattern - The pattern to match (e.g., "CORN????????")
   * @returns Array of matching currencies
   */
  findCurrenciesByTemplate(pattern: string): StellarTomlCurrency[] {
    return this.currencies.filter((c) => c.code_template === pattern);
  }

  /**
   * Gets all currencies with a specific status
   *
   * @param status - The status to filter by
   * @returns Array of matching currencies
   */
  getCurrenciesByStatus(
    status: "live" | "dead" | "test" | "private"
  ): StellarTomlCurrency[] {
    return this.currencies.filter((c) => c.status === status);
  }
}
