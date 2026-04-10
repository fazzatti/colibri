/**
 * @module common/helpers/xdr/error
 * @description Error definitions for XDR helper functions.
 */

import { ColibriError } from "@/error/index.ts";

/**
 * Error codes for XDR helpers.
 *
 * Codes follow the pattern: HLP_XDR_XX
 * - HLP: Helpers domain
 * - XDR: XDR helpers module
 * - XX: Sequential number
 */
export enum Code {
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE = "HLP_XDR_01",
  FAILED_TO_GET_AUTH_ENTRY_SIGNER = "HLP_XDR_02",
  INVALID_AUTH_ENTRY_SIGNER_ADDRESS = "HLP_XDR_03",
  FAILED_TO_PARSE_ERROR_RESULT = "HLP_XDR_04",
  // Asset parsing errors
  UNKNOWN_ASSET_TYPE = "HLP_XDR_05",
  UNKNOWN_CHANGE_TRUST_ASSET_TYPE = "HLP_XDR_06",
  UNKNOWN_MUXED_ACCOUNT_TYPE = "HLP_XDR_07",
  INVALID_XDR_PARSE = "HLP_XDR_08",
  FAILED_TO_PARSE_XDR = "HLP_XDR_09",
  UNSUPPORTED_SCVAL_TYPE = "HLP_XDR_10",
  UNKNOWN_SCVAL_TYPE = "HLP_XDR_11",
  UNKNOWN_TRUSTLINE_ASSET_TYPE = "HLP_XDR_12",
}

export type MetaData = {
  assetType?: string;
  value?: unknown;
};

export type Meta = {
  cause: Error | null;
  data: MetaData;
};

export type XdrHelperErrorShape = {
  code: Code;
  message: string;
  data?: MetaData;
  details: string;
  cause?: Error;
};

/**
 * Base error class for XDR helper errors.
 */
export abstract class XdrHelperError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/common/helpers/xdr";
  override readonly domain = "helpers" as const;
  override readonly meta: Meta;

  constructor(args: XdrHelperErrorShape) {
    const meta: Meta = {
      cause: args.cause ?? null,
      data: args.data ?? {},
    };

    super({
      domain: "helpers",
      source: "@colibri/core/common/helpers/xdr",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Thrown when an unknown Asset type is encountered.
 */
export class UNKNOWN_ASSET_TYPE extends XdrHelperError {
  constructor(assetType: string) {
    super({
      code: Code.UNKNOWN_ASSET_TYPE,
      message: `Unknown asset type: ${assetType}`,
      details:
        "Expected assetTypeNative, assetTypeCreditAlphanum4, or assetTypeCreditAlphanum12",
      data: { assetType },
    });
  }
}

/**
 * Thrown when an unknown ChangeTrustAsset type is encountered.
 */
export class UNKNOWN_CHANGE_TRUST_ASSET_TYPE extends XdrHelperError {
  constructor(assetType: string) {
    super({
      code: Code.UNKNOWN_CHANGE_TRUST_ASSET_TYPE,
      message: `Unknown ChangeTrustAsset type: ${assetType}`,
      details:
        "Expected assetTypeNative, assetTypeCreditAlphanum4, assetTypeCreditAlphanum12, or assetTypePoolShare",
      data: { assetType },
    });
  }
}

/**
 * Thrown when an unknown TrustLineAsset type is encountered.
 */
export class UNKNOWN_TRUSTLINE_ASSET_TYPE extends XdrHelperError {
  constructor(assetType: string) {
    super({
      code: Code.UNKNOWN_TRUSTLINE_ASSET_TYPE,
      message: `Unknown TrustLineAsset type: ${assetType}`,
      details:
        "Expected assetTypeNative, assetTypeCreditAlphanum4, assetTypeCreditAlphanum12, or assetTypePoolShare",
      data: { assetType },
    });
  }
}

/**
 * Thrown when an unknown MuxedAccount type is encountered.
 */
export class UNKNOWN_MUXED_ACCOUNT_TYPE extends XdrHelperError {
  constructor(accountType: string) {
    super({
      code: Code.UNKNOWN_MUXED_ACCOUNT_TYPE,
      message: `Unknown muxed account type: ${accountType}`,
      details: "Expected keyTypeEd25519 or keyTypeMuxedEd25519",
      data: { assetType: accountType },
    });
  }
}

/**
 * Thrown when XDR parsing fails.
 */
export class INVALID_XDR_PARSE extends XdrHelperError {
  constructor(reason: string, cause?: Error) {
    super({
      code: Code.INVALID_XDR_PARSE,
      message: `Failed to parse XDR: ${reason}`,
      details: "The provided XDR data could not be parsed",
      cause,
    });
  }
}

/**
 * Thrown when ensureXdrType fails to parse XDR input.
 */
export class FAILED_TO_PARSE_XDR extends XdrHelperError {
  constructor(valueType: string, xdrTypeName: string, cause?: Error) {
    super({
      code: Code.FAILED_TO_PARSE_XDR,
      message: `Failed to parse XDR as ${xdrTypeName}`,
      details: `Could not parse ${valueType} input as ${xdrTypeName}`,
      data: { value: { valueType, xdrTypeName } },
      cause,
    });
  }
}

/**
 * Thrown when getting address type from auth entry fails.
 */
export class FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE extends XdrHelperError {
  constructor(authEntryXDR: string, cause?: Error) {
    super({
      code: Code.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
      message: "Failed to get address type from SorobanAuthorizationEntry",
      details:
        "Could not extract address type from the authorization entry credentials",
      data: { value: { authEntryXDR } },
      cause,
    });
  }
}

/**
 * Thrown when getting signer from auth entry fails.
 */
export class FAILED_TO_GET_AUTH_ENTRY_SIGNER extends XdrHelperError {
  constructor(authEntryXDR: string, cause?: Error) {
    super({
      code: Code.FAILED_TO_GET_AUTH_ENTRY_SIGNER,
      message: "Failed to get signer from SorobanAuthorizationEntry",
      details: "Could not extract signer address from the authorization entry",
      data: { value: { authEntryXDR } },
      cause,
    });
  }
}

/**
 * Thrown when an invalid signer address is encountered.
 */
export class INVALID_AUTH_ENTRY_SIGNER_ADDRESS extends XdrHelperError {
  constructor(authEntryXDR: string, signer: string) {
    super({
      code: Code.INVALID_AUTH_ENTRY_SIGNER_ADDRESS,
      message:
        "Invalid signer address extracted from SorobanAuthorizationEntry",
      details:
        "Expected a valid Ed25519 public key or contract ID, but got an invalid address",
      data: { value: { authEntryXDR, signer } },
    });
  }
}

/**
 * Thrown when parsing error result fails.
 */
export class FAILED_TO_PARSE_ERROR_RESULT extends XdrHelperError {
  constructor(errorResultXDR: string) {
    super({
      code: Code.FAILED_TO_PARSE_ERROR_RESULT,
      message: "Unexpected format of TransactionResult XDR",
      details:
        "The TransactionResult XDR does not match the expected format for error parsing",
      data: { value: { errorResultXDR } },
    });
  }
}

/**
 * Thrown when an unsupported ScVal type is encountered during parsing.
 */
export class UNSUPPORTED_SCVAL_TYPE extends XdrHelperError {
  constructor(scValType: string) {
    super({
      code: Code.UNSUPPORTED_SCVAL_TYPE,
      message: `Unsupported ScVal type: ${scValType}`,
      details:
        "The ScVal type is not supported for parsing into a TypeScript-friendly value",
      data: { value: { scValType } },
    });
  }
}

/**
 * Thrown when an unknown ScVal type is encountered when getting type name.
 */
export class UNKNOWN_SCVAL_TYPE extends XdrHelperError {
  constructor(scValType: string) {
    super({
      code: Code.UNKNOWN_SCVAL_TYPE,
      message: `Unknown ScVal type: ${scValType}`,
      details: "The ScVal type is not recognized",
      data: { value: { scValType } },
    });
  }
}

/**
 * Error code to class mapping.
 */
export const ERROR_XDR = {
  [Code.UNKNOWN_ASSET_TYPE]: UNKNOWN_ASSET_TYPE,
  [Code.UNKNOWN_CHANGE_TRUST_ASSET_TYPE]: UNKNOWN_CHANGE_TRUST_ASSET_TYPE,
  [Code.UNKNOWN_TRUSTLINE_ASSET_TYPE]: UNKNOWN_TRUSTLINE_ASSET_TYPE,
  [Code.UNKNOWN_MUXED_ACCOUNT_TYPE]: UNKNOWN_MUXED_ACCOUNT_TYPE,
  [Code.INVALID_XDR_PARSE]: INVALID_XDR_PARSE,
  [Code.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE]:
    FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
  [Code.FAILED_TO_GET_AUTH_ENTRY_SIGNER]: FAILED_TO_GET_AUTH_ENTRY_SIGNER,
  [Code.INVALID_AUTH_ENTRY_SIGNER_ADDRESS]: INVALID_AUTH_ENTRY_SIGNER_ADDRESS,
  [Code.FAILED_TO_PARSE_ERROR_RESULT]: FAILED_TO_PARSE_ERROR_RESULT,
  [Code.UNSUPPORTED_SCVAL_TYPE]: UNSUPPORTED_SCVAL_TYPE,
  [Code.UNKNOWN_SCVAL_TYPE]: UNKNOWN_SCVAL_TYPE,
} as const;
