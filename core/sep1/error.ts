import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/**
 * Metadata stored on SEP-1 errors.
 */
export type Meta<DataType = unknown> = {
  cause: Error | null;
  data: DataType;
};

/**
 * Shape accepted by {@link Sep1Error} constructors.
 */
export type Sep1ErrorShape<Code extends string, DataType = unknown> = {
  code: Code;
  message: string;
  details: string;
  diagnostic: Diagnostic;
  cause?: Error;
  data: DataType;
};

/**
 * Base class for SEP-1 discovery and parsing errors.
 */
export abstract class Sep1Error<
  C extends string = Code,
  DataType = unknown
> extends ColibriError<C, Meta<DataType>> {
  /** Error source identifier for SEP-1 failures. */
  override readonly source = "@colibri/core/sep1";
  /** Structured metadata attached to the error instance. */
  override readonly meta: Meta<DataType>;

  /**
   * Creates a SEP-1 error with Colibri-standard metadata.
   *
   * @param args - Error payload used to build the instance.
   */
  constructor(args: Sep1ErrorShape<C, DataType>) {
    const meta: Meta<DataType> = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "sep1" as const,
      source: "@colibri/core/sep1",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Stable error codes emitted by the SEP-1 helper.
 */
export enum Code {
  FETCH_FAILED = "SEP1_001",
  INVALID_DOMAIN = "SEP1_002",
  PARSE_ERROR = "SEP1_003",
  FILE_TOO_LARGE = "SEP1_004",
  INVALID_SIGNING_KEY = "SEP1_005",
  INVALID_URL = "SEP1_006",
  TIMEOUT = "SEP1_007",
  INVALID_ACCOUNT = "SEP1_008",
}

/**
 * Raised when fetching `stellar.toml` fails.
 */
export class FETCH_FAILED extends Sep1Error<
  Code.FETCH_FAILED,
  { domain: string; statusCode?: number; statusText?: string }
> {
  /**
   * Creates a fetch-failed error.
   *
   * @param domain - Domain being queried.
   * @param cause - Underlying network error.
   * @param statusCode - Optional HTTP status code.
   * @param statusText - Optional HTTP status text.
   */
  constructor(
    domain: string,
    cause?: Error,
    statusCode?: number,
    statusText?: string
  ) {
    super({
      code: Code.FETCH_FAILED,
      message: `Failed to fetch stellar.toml from '${domain}'`,
      details: statusCode
        ? `HTTP request failed with status ${statusCode} ${statusText || ""}`
        : "The request to fetch the stellar.toml file failed. Check network connectivity and that the domain hosts a valid stellar.toml.",
      diagnostic: {
        rootCause: cause?.message || "Network request failed",
        suggestion:
          "Verify the domain hosts a stellar.toml file at /.well-known/stellar.toml and is accessible.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md",
        ],
      },
      cause,
      data: { domain, statusCode, statusText },
    });
  }
}

/**
 * Raised when the supplied domain is invalid.
 */
export class INVALID_DOMAIN extends Sep1Error<
  Code.INVALID_DOMAIN,
  { domain: string }
> {
  /**
   * Creates an invalid-domain error.
   *
   * @param domain - Invalid domain value.
   */
  constructor(domain: string) {
    super({
      code: Code.INVALID_DOMAIN,
      message: `Invalid domain: '${domain}'`,
      details:
        "The provided domain is not a valid domain name. It should not include protocol schemes (http://, https://) or paths.",
      diagnostic: {
        rootCause: "Domain format is invalid",
        suggestion:
          "Provide only the domain name without protocol or path, e.g., 'stellar.org' instead of 'https://stellar.org/'",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md",
        ],
      },
      data: { domain },
    });
  }
}

/**
 * Raised when `stellar.toml` content cannot be parsed as TOML.
 */
export class PARSE_ERROR extends Sep1Error<
  Code.PARSE_ERROR,
  { domain?: string; rawContent?: string }
> {
  /**
   * Creates a parse-error instance.
   *
   * @param domain - Domain that supplied the content, when known.
   * @param cause - Underlying TOML parsing error.
   * @param rawContent - Raw content prefix captured for debugging.
   */
  constructor(domain?: string, cause?: Error, rawContent?: string) {
    super({
      code: Code.PARSE_ERROR,
      message: domain
        ? `Failed to parse stellar.toml from '${domain}'`
        : "Failed to parse stellar.toml content",
      details:
        "The content is not valid TOML format. Ensure the file follows the TOML specification.",
      diagnostic: {
        rootCause: cause?.message || "Invalid TOML syntax",
        suggestion:
          "Validate the TOML syntax using a TOML validator or check for common issues like unclosed strings or invalid characters.",
        materials: [
          "https://toml.io/en/",
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#example",
        ],
      },
      cause,
      data: { domain, rawContent: rawContent?.slice(0, 500) },
    });
  }
}

/**
 * Raised when `stellar.toml` exceeds the SEP-1 size limit.
 */
export class FILE_TOO_LARGE extends Sep1Error<
  Code.FILE_TOO_LARGE,
  { domain: string; size: number; maxSize: number }
> {
  /**
   * Creates a file-too-large error.
   *
   * @param domain - Domain serving the oversized file.
   * @param size - Actual file size in bytes.
   * @param maxSize - Maximum accepted size in bytes.
   */
  constructor(domain: string, size: number, maxSize: number = 100 * 1024) {
    super({
      code: Code.FILE_TOO_LARGE,
      message: `stellar.toml from '${domain}' exceeds maximum size`,
      details: `The file size is ${size} bytes, which exceeds the maximum allowed size of ${maxSize} bytes (100KB) as per SEP-1 specification.`,
      diagnostic: {
        rootCause: "File size exceeds SEP-1 limit",
        suggestion:
          "Reduce the stellar.toml file size to under 100KB. Consider removing unnecessary comments or linking to external TOML files for currencies.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md",
        ],
      },
      data: { domain, size, maxSize },
    });
  }
}

/**
 * Raised when a signing key value is not a valid Stellar account id.
 */
export class INVALID_SIGNING_KEY extends Sep1Error<
  Code.INVALID_SIGNING_KEY,
  { domain?: string; field: string; value: string }
> {
  /**
   * Creates an invalid-signing-key error.
   *
   * @param field - TOML field containing the invalid key.
   * @param value - Invalid key value.
   * @param domain - Domain being validated, when known.
   */
  constructor(field: string, value: string, domain?: string) {
    super({
      code: Code.INVALID_SIGNING_KEY,
      message: `Invalid signing key in field '${field}'`,
      details: `The value '${value}' is not a valid Stellar Ed25519 public key (G...). Signing keys must be valid Stellar public keys.`,
      diagnostic: {
        rootCause: "Signing key format is invalid",
        suggestion:
          "Ensure the signing key is a valid Stellar public key starting with 'G' and properly encoded in Strkey format.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md",
        ],
      },
      data: { domain, field, value },
    });
  }
}

/**
 * Raised when a URL field in `stellar.toml` is invalid.
 */
export class INVALID_URL extends Sep1Error<
  Code.INVALID_URL,
  { domain?: string; field: string; value: string }
> {
  /**
   * Creates an invalid-url error.
   *
   * @param field - TOML field containing the invalid URL.
   * @param value - Invalid URL value.
   * @param domain - Domain being validated, when known.
   * @param requireHttps - Whether HTTPS is required for the field.
   */
  constructor(
    field: string,
    value: string,
    domain?: string,
    requireHttps = true
  ) {
    super({
      code: Code.INVALID_URL,
      message: `Invalid URL in field '${field}'`,
      details: requireHttps
        ? `The value '${value}' is not a valid HTTPS URL. SEP-1 requires HTTPS for endpoint URLs.`
        : `The value '${value}' is not a valid URL.`,
      diagnostic: {
        rootCause: "URL format is invalid or not using HTTPS",
        suggestion: requireHttps
          ? "Ensure the URL uses HTTPS protocol and is properly formatted."
          : "Ensure the URL is properly formatted.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md",
        ],
      },
      data: { domain, field, value },
    });
  }
}

/**
 * Raised when fetching `stellar.toml` times out.
 */
export class TIMEOUT extends Sep1Error<
  Code.TIMEOUT,
  { domain: string; timeoutMs: number }
> {
  /**
   * Creates a timeout error.
   *
   * @param domain - Domain being queried.
   * @param timeoutMs - Timeout threshold that was exceeded.
   */
  constructor(domain: string, timeoutMs: number) {
    super({
      code: Code.TIMEOUT,
      message: `Request to fetch stellar.toml from '${domain}' timed out`,
      details: `The request did not complete within ${timeoutMs}ms. The server may be slow or unreachable.`,
      diagnostic: {
        rootCause: "Network request timeout",
        suggestion:
          "Check network connectivity, try again later, or increase the timeout value.",
        materials: [],
      },
      data: { domain, timeoutMs },
    });
  }
}

/**
 * Raised when an account field in `stellar.toml` is invalid.
 */
export class INVALID_ACCOUNT extends Sep1Error<
  Code.INVALID_ACCOUNT,
  { domain?: string; field: string; value: string; index?: number }
> {
  /**
   * Creates an invalid-account error.
   *
   * @param field - TOML field containing the invalid account.
   * @param value - Invalid account value.
   * @param domain - Domain being validated, when known.
   * @param index - Optional array index for repeated account fields.
   */
  constructor(field: string, value: string, domain?: string, index?: number) {
    const location = index !== undefined ? ` at index ${index}` : "";
    super({
      code: Code.INVALID_ACCOUNT,
      message: `Invalid account in field '${field}'${location}`,
      details: `The value '${value}' is not a valid Stellar account address (G...).`,
      diagnostic: {
        rootCause: "Account address format is invalid",
        suggestion:
          "Ensure the account is a valid Stellar public key starting with 'G' and properly encoded in Strkey format.",
        materials: [
          "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md",
        ],
      },
      data: { domain, field, value, index },
    });
  }
}

/**
 * SEP-1 error constructors indexed by stable error code.
 */
export const ERROR_SEP1 = {
  [Code.FETCH_FAILED]: FETCH_FAILED,
  [Code.INVALID_DOMAIN]: INVALID_DOMAIN,
  [Code.PARSE_ERROR]: PARSE_ERROR,
  [Code.FILE_TOO_LARGE]: FILE_TOO_LARGE,
  [Code.INVALID_SIGNING_KEY]: INVALID_SIGNING_KEY,
  [Code.INVALID_URL]: INVALID_URL,
  [Code.TIMEOUT]: TIMEOUT,
  [Code.INVALID_ACCOUNT]: INVALID_ACCOUNT,
};
