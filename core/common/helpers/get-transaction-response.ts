import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { assert } from "@/common/assert/assert.ts";
import { StrKey } from "@/strkeys/index.ts";

enum ErrorCode {
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
      ColibriError.unexpected({
        domain: "helpers",
        source: baseErrorSource + "/getWasmHashFromGetTransactionResponse",
        message: "Transaction result does not contain a WASM hash",
        code: ErrorCode.MISSING_WASM_HASH,
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

    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/getWasmHashFromGetTransactionResponse",
      message: "Failed to get wasm hash from GetTransactionResponse!",
      code: ErrorCode.FAILED_TO_GET_WASM_HASH,
      meta: {
        data: {
          resultMetaXdr: softTryToXDR(() =>
            response.resultMetaXdr.toXdr("base64")
          ),
        },
      },
    });
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
      ColibriError.unexpected({
        domain: "helpers",
        source: baseErrorSource + "/getContractIdFromGetTransactionResponse",
        message: "Transaction result does not contain a contract ID",
        code: ErrorCode.MISSING_CONTRACT_ID,
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
      ColibriError.unexpected({
        domain: "helpers",
        source: baseErrorSource + "/getContractIdFromGetTransactionResponse",
        message: "Retrieved contract ID is not a valid contract ID!",
        code: ErrorCode.INVALID_CONTRACT_ID,
        meta: {
          data: { contractId },
        },
      }),
    );

    return contractId as ContractId;
  } catch (e) {
    if (e instanceof ColibriError) throw e;

    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/getContractIdFromGetTransactionResponse",
      message: "Failed to get contract ID from GetTransactionResponse!",
      code: ErrorCode.FAILED_TO_GET_CONTRACT_ID,
      meta: {
        data: {
          resultMetaXdr: softTryToXDR(() =>
            response.resultMetaXdr.toXdr("base64")
          ),
        },
      },
    });
  }
};
