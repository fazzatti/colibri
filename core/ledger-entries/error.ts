import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";
import type { LedgerEntryKind } from "@/ledger-entries/types.ts";

/**
 * Metadata stored on ledger-entries errors.
 */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/**
 * Shape accepted by {@link LedgerEntriesError} constructors.
 */
export type LedgerEntriesErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/**
 * Base class for ledger-entries-module errors.
 */
export abstract class LedgerEntriesError<
  Code extends string,
> extends ColibriError<Code, Meta> {
  /** Structured metadata preserved on ledger-entries errors. */
  override readonly meta: Meta;

  /**
   * Creates a new ledger-entries error.
   *
   * @param args - Error construction payload.
   */
  constructor(args: LedgerEntriesErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "core" as const,
      source: "@colibri/core/ledger-entries",
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
 * Stable error codes emitted by the ledger-entries module.
 */
export enum Code {
  INVALID_CONSTRUCTOR_ARGS = "LDE_000",
  MISSING_RPC_URL = "LDE_001",
  INVALID_ACCOUNT_ID = "LDE_002",
  INVALID_CONTRACT_ID = "LDE_003",
  INVALID_CLAIMABLE_BALANCE_ID = "LDE_004",
  INVALID_LIQUIDITY_POOL_ID = "LDE_005",
  INVALID_HEX_HASH = "LDE_006",
  INVALID_CONFIG_SETTING_ID = "LDE_007",
  INVALID_LEDGER_KEY_HASH = "LDE_008",
  LEDGER_ENTRY_NOT_FOUND = "LDE_009",
  UNEXPECTED_LEDGER_ENTRY_TYPE = "LDE_010",
  CONTRACT_INSTANCE_HAS_NO_WASM_HASH = "LDE_011",
  UNSUPPORTED_RPC_LEDGER_KEY = "LDE_012",
  UNSUPPORTED_XDR_VARIANT = "LDE_013",
  INVALID_OFFER_ID = "LDE_014",
}

/**
 * Raised when the constructor receives both or neither supported init inputs.
 */
export class INVALID_CONSTRUCTOR_ARGS extends LedgerEntriesError<Code> {
  constructor() {
    super({
      code: Code.INVALID_CONSTRUCTOR_ARGS,
      message: "Invalid LedgerEntries constructor arguments",
      details:
        "LedgerEntries must be initialized with exactly one of 'networkConfig' or 'rpc'.",
      data: {},
    });
  }
}

/**
 * Raised when a network config does not provide an RPC URL.
 */
export class MISSING_RPC_URL extends LedgerEntriesError<Code> {
  constructor() {
    super({
      code: Code.MISSING_RPC_URL,
      message: "Missing required argument: rpcUrl",
      details:
        "The provided network configuration does not contain an RPC URL, so LedgerEntries cannot create its own RPC client.",
      diagnostic: {
        suggestion:
          "Either provide a network configuration with 'rpcUrl' or pass an RPC Server instance directly.",
        rootCause:
          "LedgerEntries needs a live RPC client to perform getLedgerEntries requests.",
      },
      data: {},
    });
  }
}

/**
 * Raised when an invalid Ed25519 account id is provided.
 */
export class INVALID_ACCOUNT_ID extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param accountId - Invalid account id supplied by the caller.
   */
  constructor(accountId: string) {
    super({
      code: Code.INVALID_ACCOUNT_ID,
      message: `Invalid account id: ${accountId}`,
      details:
        "The provided account id is not a valid Ed25519 Stellar public key.",
      data: { accountId },
    });
  }
}

/**
 * Raised when an invalid offer id is provided.
 */
export class INVALID_OFFER_ID extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param offerId - Invalid offer id supplied by the caller.
   */
  constructor(offerId: string | number | bigint) {
    super({
      code: Code.INVALID_OFFER_ID,
      message: `Invalid offer id: ${offerId}`,
      details: "The provided offer id must be a non-negative 64-bit integer.",
      data: { offerId },
    });
  }
}

/**
 * Raised when an invalid contract id is provided.
 */
export class INVALID_CONTRACT_ID extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param contractId - Invalid contract id supplied by the caller.
   */
  constructor(contractId: string) {
    super({
      code: Code.INVALID_CONTRACT_ID,
      message: `Invalid contract id: ${contractId}`,
      details: "The provided contract id is not a valid Stellar contract id.",
      data: { contractId },
    });
  }
}

/**
 * Raised when an invalid claimable-balance id is provided.
 */
export class INVALID_CLAIMABLE_BALANCE_ID extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param balanceId - Invalid claimable-balance id supplied by the caller.
   */
  constructor(balanceId: string) {
    super({
      code: Code.INVALID_CLAIMABLE_BALANCE_ID,
      message: `Invalid claimable balance id: ${balanceId}`,
      details:
        "The provided claimable balance id is not a valid Stellar claimable-balance strkey.",
      data: { balanceId },
    });
  }
}

/**
 * Raised when an invalid liquidity-pool id is provided.
 */
export class INVALID_LIQUIDITY_POOL_ID extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param liquidityPoolId - Invalid liquidity-pool id supplied by the caller.
   */
  constructor(liquidityPoolId: string) {
    super({
      code: Code.INVALID_LIQUIDITY_POOL_ID,
      message: `Invalid liquidity pool id: ${liquidityPoolId}`,
      details:
        "The provided liquidity pool id is not a valid Stellar liquidity-pool strkey.",
      data: { liquidityPoolId },
    });
  }
}

/**
 * Raised when a hash argument is not a 32-byte hex string.
 */
export class INVALID_HEX_HASH extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param hash - Invalid hash value supplied by the caller.
   */
  constructor(hash: string) {
    super({
      code: Code.INVALID_HEX_HASH,
      message: `Invalid hash: ${hash}`,
      details:
        "The provided hash must be a 64-character hexadecimal string or a 32-byte payload.",
      data: { hash },
    });
  }
}

/**
 * Raised when a config-setting id is not recognized.
 */
export class INVALID_CONFIG_SETTING_ID extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param configSettingId - Invalid config-setting identifier.
   */
  constructor(configSettingId: string) {
    super({
      code: Code.INVALID_CONFIG_SETTING_ID,
      message: `Invalid config setting id: ${configSettingId}`,
      details:
        "The provided config setting id is not one of the supported Stellar config-setting identifiers.",
      data: { configSettingId },
    });
  }
}

/**
 * Raised when a TTL key hash is invalid.
 */
export class INVALID_LEDGER_KEY_HASH extends LedgerEntriesError<Code> {
  constructor() {
    super({
      code: Code.INVALID_LEDGER_KEY_HASH,
      message: "Invalid ledger key hash",
      details:
        "The provided TTL key hash must be a valid SHA-256 strkey or a 32-byte payload.",
      data: {},
    });
  }
}

/**
 * Raised when a convenience method cannot find the requested entry.
 */
export class LEDGER_ENTRY_NOT_FOUND extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param kind - Logical ledger-entry kind requested by the caller.
   * @param key - Encoded ledger-key payload used for the lookup.
   */
  constructor(kind: LedgerEntryKind, key: string) {
    super({
      code: Code.LEDGER_ENTRY_NOT_FOUND,
      message: `Ledger entry not found: ${kind}`,
      details:
        "No live ledger entry matched the requested key on the connected RPC server.",
      data: { kind, key },
    });
  }
}

/**
 * Raised when the RPC response does not match the requested ledger-key type.
 */
export class UNEXPECTED_LEDGER_ENTRY_TYPE extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param expected - Entry type implied by the requested key.
   * @param actual - Entry type decoded from the RPC response.
   */
  constructor(expected: LedgerEntryKind, actual: LedgerEntryKind) {
    super({
      code: Code.UNEXPECTED_LEDGER_ENTRY_TYPE,
      message:
        `Unexpected ledger entry type: expected ${expected}, received ${actual}`,
      details:
        "The RPC server returned a ledger entry whose decoded type does not match the requested key.",
      data: { expected, actual },
    });
  }
}

/**
 * Raised when a contract instance points at a built-in executable instead of wasm.
 */
export class CONTRACT_INSTANCE_HAS_NO_WASM_HASH extends LedgerEntriesError<
  Code
> {
  /**
   * Creates the error.
   *
   * @param contractId - Contract id requested by the caller.
   * @param executableType - Executable type found on the contract instance.
   */
  constructor(contractId: string, executableType: string) {
    super({
      code: Code.CONTRACT_INSTANCE_HAS_NO_WASM_HASH,
      message: `Contract instance has no wasm hash: ${contractId}`,
      details:
        "The targeted contract instance does not point to a wasm executable, so no contract-code ledger entry can be derived from it.",
      data: { contractId, executableType },
    });
  }
}

/**
 * Raised when Stellar RPC does not support querying a ledger-key type.
 */
export class UNSUPPORTED_RPC_LEDGER_KEY extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param kind - Ledger-key kind rejected by Stellar RPC.
   */
  constructor(kind: LedgerEntryKind) {
    super({
      code: Code.UNSUPPORTED_RPC_LEDGER_KEY,
      message: `Unsupported RPC ledger key: ${kind}`,
      details: kind === "ttl"
        ? "Current Stellar RPC servers do not allow direct TTL ledger-entry queries via getLedgerEntries."
        : "The connected Stellar RPC server does not support querying this ledger-key type via getLedgerEntries.",
      diagnostic: {
        rootCause:
          "LedgerEntries uses Stellar RPC getLedgerEntries, but the server rejects this ledger-key type.",
        suggestion: kind === "ttl"
          ? "Query the underlying entry instead, or use another data source that exposes TTL metadata."
          : "Use a different API path that supports this ledger-key type.",
      },
      data: { kind },
    });
  }
}

/**
 * Raised when a decoded Stellar XDR union variant is unsupported.
 */
export class UNSUPPORTED_XDR_VARIANT extends LedgerEntriesError<Code> {
  /**
   * Creates the error.
   *
   * @param kind High-level XDR union family being decoded.
   * @param value Unsupported variant name returned by Stellar SDK.
   */
  constructor(kind: string, value: string) {
    super({
      code: Code.UNSUPPORTED_XDR_VARIANT,
      message: `Unsupported ${kind} type: ${value}`,
      details:
        "The connected Stellar SDK returned an XDR union variant that this LedgerEntries decoder does not currently support.",
      data: { kind, value },
    });
  }
}

/**
 * Error code to class mapping.
 */
export const ERROR_LDE = {
  [Code.INVALID_CONSTRUCTOR_ARGS]: INVALID_CONSTRUCTOR_ARGS,
  [Code.MISSING_RPC_URL]: MISSING_RPC_URL,
  [Code.INVALID_ACCOUNT_ID]: INVALID_ACCOUNT_ID,
  [Code.INVALID_OFFER_ID]: INVALID_OFFER_ID,
  [Code.INVALID_CONTRACT_ID]: INVALID_CONTRACT_ID,
  [Code.INVALID_CLAIMABLE_BALANCE_ID]: INVALID_CLAIMABLE_BALANCE_ID,
  [Code.INVALID_LIQUIDITY_POOL_ID]: INVALID_LIQUIDITY_POOL_ID,
  [Code.INVALID_HEX_HASH]: INVALID_HEX_HASH,
  [Code.INVALID_CONFIG_SETTING_ID]: INVALID_CONFIG_SETTING_ID,
  [Code.INVALID_LEDGER_KEY_HASH]: INVALID_LEDGER_KEY_HASH,
  [Code.LEDGER_ENTRY_NOT_FOUND]: LEDGER_ENTRY_NOT_FOUND,
  [Code.UNEXPECTED_LEDGER_ENTRY_TYPE]: UNEXPECTED_LEDGER_ENTRY_TYPE,
  [Code.CONTRACT_INSTANCE_HAS_NO_WASM_HASH]: CONTRACT_INSTANCE_HAS_NO_WASM_HASH,
  [Code.UNSUPPORTED_RPC_LEDGER_KEY]: UNSUPPORTED_RPC_LEDGER_KEY,
  [Code.UNSUPPORTED_XDR_VARIANT]: UNSUPPORTED_XDR_VARIANT,
} as const;
