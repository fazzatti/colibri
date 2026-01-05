import type { Ed25519PublicKey, ContractId } from "@/strkeys/types.ts";

/**
 * Options for fetching a stellar.toml file
 */
export interface StellarTomlFetchOptions {
  /**
   * Request timeout in milliseconds.
   * @default 10000
   */
  timeout?: number;

  /**
   * Allow fetching over HTTP instead of HTTPS.
   * Only use for testing purposes - the spec requires HTTPS.
   * @default false
   */
  allowHttp?: boolean;

  /**
   * Custom fetch implementation for testing or proxying.
   */
  fetchFn?: typeof fetch;
}

/**
 * Options for parsing and validating a stellar.toml
 */
export interface StellarTomlParseOptions {
  /**
   * Enable strict validation of fields (signing keys, URLs, etc.)
   * When false, accepts any valid TOML structure.
   * @default true
   */
  validate?: boolean;

  /**
   * Allow HTTP URLs in endpoint fields instead of requiring HTTPS.
   * **For testing purposes only** - SEP-1 specification requires HTTPS for all endpoints.
   * @default false
   */
  allowHttp?: boolean;
}

/**
 * Combined options for fromDomain
 */
export type StellarTomlOptions = StellarTomlFetchOptions &
  StellarTomlParseOptions;

// =============================================================================
// General Information (top-level fields from SEP-1)
// =============================================================================

/**
 * Top-level fields in a stellar.toml file
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#general-information
 */
export interface StellarTomlGeneralInfo {
  /** The version of SEP-1 the stellar.toml adheres to */
  VERSION?: string;

  /** The passphrase for the specific Stellar network this infrastructure operates on */
  NETWORK_PASSPHRASE?: string;

  /** The endpoint for clients to resolve stellar addresses via SEP-2 Federation Protocol */
  FEDERATION_SERVER?: string;

  /** @deprecated The endpoint used for SEP-3 Compliance Protocol */
  AUTH_SERVER?: string;

  /** The server used for SEP-6 Anchor/Client interoperability */
  TRANSFER_SERVER?: string;

  /** The server used for SEP-24 Anchor/Client interoperability */
  TRANSFER_SERVER_SEP0024?: string;

  /** The server used for SEP-12 Anchor/Client customer info transfer */
  KYC_SERVER?: string;

  /** The endpoint used for SEP-10 Web Authentication */
  WEB_AUTH_ENDPOINT?: string;

  /** The endpoint used for SEP-45 Web Authentication */
  WEB_AUTH_FOR_CONTRACTS_ENDPOINT?: string;

  /** The web authentication contract ID for SEP-45 Web Authentication */
  WEB_AUTH_CONTRACT_ID?: string;

  /** The signing key used for SEP-3 (deprecated), SEP-10, and SEP-45 Authentication */
  SIGNING_KEY?: string;

  /** Location of public-facing Horizon instance */
  HORIZON_URL?: string;

  /** A list of Stellar accounts controlled by this domain */
  ACCOUNTS?: string[];

  /** The signing key used for SEP-7 delegated signing */
  URI_REQUEST_SIGNING_KEY?: string;

  /** The server used for receiving SEP-31 direct fiat-to-fiat payments */
  DIRECT_PAYMENT_SERVER?: string;

  /** The server used for receiving SEP-38 requests */
  ANCHOR_QUOTE_SERVER?: string;
}

// =============================================================================
// [DOCUMENTATION] section
// =============================================================================

/**
 * Organization documentation fields from [DOCUMENTATION] table
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#organization-documentation
 */
export interface StellarTomlDocumentation {
  /** Legal name of the organization */
  ORG_NAME?: string;

  /** DBA (Doing Business As) of the organization */
  ORG_DBA?: string;

  /** Organization's official URL */
  ORG_URL?: string;

  /** URL to a PNG image of the organization's logo on a transparent background */
  ORG_LOGO?: string;

  /** Short description of the organization */
  ORG_DESCRIPTION?: string;

  /** Physical address for the organization */
  ORG_PHYSICAL_ADDRESS?: string;

  /** URL to attestation document for physical address */
  ORG_PHYSICAL_ADDRESS_ATTESTATION?: string;

  /** Organization's phone number in E.164 format */
  ORG_PHONE_NUMBER?: string;

  /** URL to phone bill attestation */
  ORG_PHONE_NUMBER_ATTESTATION?: string;

  /** Keybase account name for the organization */
  ORG_KEYBASE?: string;

  /** Organization's Twitter/X account */
  ORG_TWITTER?: string;

  /** Organization's Github account */
  ORG_GITHUB?: string;

  /** Email for business partners (must be hosted at ORG_URL domain) */
  ORG_OFFICIAL_EMAIL?: string;

  /** Email for user support */
  ORG_SUPPORT_EMAIL?: string;

  /** Name of the licensing authority or agency */
  ORG_LICENSING_AUTHORITY?: string;

  /** Type of financial license, registration, or authorization */
  ORG_LICENSE_TYPE?: string;

  /** Official license number */
  ORG_LICENSE_NUMBER?: string;
}

// =============================================================================
// [[PRINCIPALS]] list
// =============================================================================

/**
 * Point of contact / principal information
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#point-of-contact-documentation
 */
export interface StellarTomlPrincipal {
  /** Full legal name */
  name?: string;

  /** Business email address */
  email?: string;

  /** Personal Keybase account */
  keybase?: string;

  /** Personal Telegram account */
  telegram?: string;

  /** Personal Twitter/X account */
  twitter?: string;

  /** Personal Github account */
  github?: string;

  /** SHA-256 hash of government-issued photo ID */
  id_photo_hash?: string;

  /** SHA-256 hash of verification photo */
  verification_photo_hash?: string;
}

// =============================================================================
// [[CURRENCIES]] list
// =============================================================================

/**
 * Currency/token status values
 */
export type CurrencyStatus = "live" | "dead" | "test" | "private";

/**
 * Anchor asset types
 */
export type AnchorAssetType =
  | "fiat"
  | "crypto"
  | "nft"
  | "stock"
  | "bond"
  | "commodity"
  | "realestate"
  | "other";

/**
 * Currency/token documentation
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#currency-documentation
 */
export interface StellarTomlCurrency {
  /** Token code (required, max 12 characters) */
  code: string;

  /** Stellar public key of the issuing account (for Stellar Assets) */
  issuer?: string;

  /** Contract ID of the token contract (for SEP-41 tokens) */
  contract?: string;

  /** Pattern with ? as wildcard for multiple assets */
  code_template?: string;

  /** Status of the token */
  status?: CurrencyStatus;

  /** Preference for number of decimals to show (0-7) */
  display_decimals?: number;

  /** Short name for the token (max 20 characters) */
  name?: string;

  /** Description of token and what it represents */
  desc?: string;

  /** Conditions on the token */
  conditions?: string;

  /** URL to PNG image representing the token */
  image?: string;

  /** Fixed number of tokens (mutually exclusive with max_number, is_unlimited) */
  fixed_number?: number;

  /** Max number of tokens (mutually exclusive with fixed_number, is_unlimited) */
  max_number?: number;

  /** Whether the number of tokens is dilutable at issuer's discretion */
  is_unlimited?: boolean;

  /** Whether token can be redeemed for underlying asset */
  is_asset_anchored?: boolean;

  /** Type of anchored asset */
  anchor_asset_type?: AnchorAssetType;

  /** Code/symbol for the anchored asset */
  anchor_asset?: string;

  /** URL to attestation or proof of reserves */
  attestation_of_reserve?: string;

  /** Instructions to redeem the underlying asset */
  redemption_instructions?: string;

  /** Public addresses holding collateral for anchored crypto tokens */
  collateral_addresses?: string[];

  /** Messages stating funds are reserved */
  collateral_address_messages?: string[];

  /** Signatures proving control of collateral addresses */
  collateral_address_signatures?: string[];

  /** Whether this is a SEP-8 regulated asset */
  regulated?: boolean;

  /** URL of SEP-8 compliant approval service */
  approval_server?: string;

  /** Human readable approval criteria */
  approval_criteria?: string;

  /** Link to separate TOML file for this currency */
  toml?: string;
}

// =============================================================================
// [[VALIDATORS]] list
// =============================================================================

/**
 * Validator node information
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md#validator-information
 */
export interface StellarTomlValidator {
  /** Name for display in stellar-core configs (^[a-z0-9-]{2,16}$) */
  ALIAS?: string;

  /** Human-readable name for display */
  DISPLAY_NAME?: string;

  /** Stellar account associated with the node */
  PUBLIC_KEY?: string;

  /** IP:port or domain:port for peer connections */
  HOST?: string;

  /** Location of the history archive published by this validator */
  HISTORY?: string;
}

// =============================================================================
// Full TOML structure
// =============================================================================

/**
 * Complete stellar.toml data structure
 */
export interface StellarTomlData extends StellarTomlGeneralInfo {
  /** Organization documentation */
  DOCUMENTATION?: StellarTomlDocumentation;

  /** List of principals/points of contact */
  PRINCIPALS?: StellarTomlPrincipal[];

  /** List of currencies/tokens */
  CURRENCIES?: StellarTomlCurrency[];

  /** List of validator nodes */
  VALIDATORS?: StellarTomlValidator[];
}

// =============================================================================
// SEP-10 convenience type
// =============================================================================

/**
 * SEP-10 Web Authentication configuration extracted from stellar.toml
 */
export interface Sep10Config {
  /** The SEP-10 web auth endpoint URL */
  webAuthEndpoint: string;

  /** The server's signing key */
  signingKey: Ed25519PublicKey;

  /** Optional network passphrase */
  networkPassphrase?: string;
}

/**
 * SEP-45 Web Authentication configuration extracted from stellar.toml
 */
export interface Sep45Config {
  /** The SEP-45 web auth endpoint URL */
  webAuthEndpoint: string;

  /** The server's signing key */
  signingKey: Ed25519PublicKey;

  /** The web auth contract ID */
  contractId: ContractId;

  /** Optional network passphrase */
  networkPassphrase?: string;
}
