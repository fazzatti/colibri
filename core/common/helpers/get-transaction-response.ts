import { errorContext } from "@/common/helpers/error-context.ts";
import type { BaseMeta, ColibriErrorShape } from "@/error/types.ts";
import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { assert } from "@/common/assert/assert.ts";
import { StrKey } from "@/strkeys/index.ts";

/** Stable helper failure codes. */
export enum GetTransactionResponseCode {
  FAILED_TO_GET_WASM_HASH = "HLP_GTR_01",
  FAILED_TO_GET_CONTRACT_ID = "HLP_GTR_02",

  INVALID_CONTRACT_ID = "HLP_GTR_03",
  MISSING_WASM_HASH = "HLP_GTR_04",
  MISSING_CONTRACT_ID = "HLP_GTR_05",
}

const baseErrorSource = "@colibri/core/helpers/get-transaction-response";
export const getWasmHashFromGetTransactionResponse = (
  response: Api.GetSuccessfulTransactionResponse,
): string => {
  try {
    const resultMeta = response.resultMetaXdr;
    const returnValue = resultMeta.type === "v4"
      ? resultMeta.v4.sorobanMeta?.returnValue
      : undefined;
    assert(
      returnValue?.type === "scvBytes",
      new MissingWasmHashError({
        domain: "helpers",
        source: baseErrorSource + "/getWasmHashFromGetTransactionResponse",
        message: "Transaction result does not contain a WASM hash",

        meta: {
          data: {
            resultMetaXdr: softTryToXDR(() =>
              response.resultMetaXdr.toXdr("base64")
            ),
          },
        },
      }),
    );
    const wasmHash = xdr.encodeBytes(returnValue.bytes.toBytes(), "hex");

    return wasmHash;
  } catch (e) {
    if (e instanceof ColibriError) throw e;

    throw new FailedToGetWasmHashError(errorContext(e, {
      domain: "helpers",
      source: baseErrorSource + "/getWasmHashFromGetTransactionResponse",
      message: "Failed to get wasm hash from GetTransactionResponse!",

      meta: {
        data: {
          resultMetaXdr: softTryToXDR(() =>
            response.resultMetaXdr.toXdr("base64")
          ),
        },
      },
    }));
  }
};

export const getContractIdFromGetTransactionResponse = (
  response: Api.GetSuccessfulTransactionResponse,
): ContractId => {
  try {
    const resultMeta = response.resultMetaXdr;
    const returnValue = resultMeta.type === "v4"
      ? resultMeta.v4.sorobanMeta?.returnValue
      : undefined;
    assert(
      returnValue?.type === "scvAddress",
      new MissingContractIdError({
        domain: "helpers",
        source: baseErrorSource + "/getContractIdFromGetTransactionResponse",
        message: "Transaction result does not contain a contract ID",

        meta: {
          data: {
            resultMetaXdr: softTryToXDR(() =>
              response.resultMetaXdr.toXdr("base64")
            ),
          },
        },
      }),
    );
    const contractId = Address.fromScAddress(
      returnValue.address,
    ).toString();

    assert(
      StrKey.isValidContractId(contractId),
      new InvalidContractIdError({
        domain: "helpers",
        source: baseErrorSource + "/getContractIdFromGetTransactionResponse",
        message: "Retrieved contract ID is not a valid contract ID!",

        meta: {
          data: { contractId },
        },
      }),
    );

    return contractId as ContractId;
  } catch (e) {
    if (e instanceof ColibriError) throw e;

    throw new FailedToGetContractIdError(errorContext(e, {
      domain: "helpers",
      source: baseErrorSource + "/getContractIdFromGetTransactionResponse",
      message: "Failed to get contract ID from GetTransactionResponse!",

      meta: {
        data: {
          resultMetaXdr: softTryToXDR(() =>
            response.resultMetaXdr.toXdr("base64")
          ),
        },
      },
    }));
  }
};

/** Failed to get wasm hash. Stable code `HLP_GTR_01`. */
export class FailedToGetWasmHashError
  extends ColibriError<GetTransactionResponseCode.FAILED_TO_GET_WASM_HASH> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      code: GetTransactionResponseCode.FAILED_TO_GET_WASM_HASH,
    });
  }
}

/** Failed to get contract id. Stable code `HLP_GTR_02`. */
export class FailedToGetContractIdError
  extends ColibriError<GetTransactionResponseCode.FAILED_TO_GET_CONTRACT_ID> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      code: GetTransactionResponseCode.FAILED_TO_GET_CONTRACT_ID,
    });
  }
}

/** Invalid contract id. Stable code `HLP_GTR_03`. */
export class InvalidContractIdError
  extends ColibriError<GetTransactionResponseCode.INVALID_CONTRACT_ID> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      details: "details" in context
        ? context.details
        : "An unexpected error occurred",
      meta: { cause: undefined, ...context.meta },
      code: GetTransactionResponseCode.INVALID_CONTRACT_ID,
    });
  }
}

/** Missing wasm hash. Stable code `HLP_GTR_04`. */
export class MissingWasmHashError
  extends ColibriError<GetTransactionResponseCode.MISSING_WASM_HASH> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      details: "details" in context
        ? context.details
        : "An unexpected error occurred",
      meta: { cause: undefined, ...context.meta },
      code: GetTransactionResponseCode.MISSING_WASM_HASH,
    });
  }
}

/** Missing contract id. Stable code `HLP_GTR_05`. */
export class MissingContractIdError
  extends ColibriError<GetTransactionResponseCode.MISSING_CONTRACT_ID> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      details: "details" in context
        ? context.details
        : "An unexpected error occurred",
      meta: { cause: undefined, ...context.meta },
      code: GetTransactionResponseCode.MISSING_CONTRACT_ID,
    });
  }
}
