import type { Buffer } from "node:buffer";
import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "../../error/index.ts";
import { softTryToXDR } from "./xdr.ts";

enum ErrorCode {
  FAILED_TO_GET_WASM_HASH = "HLP_GTR_01",
}

const baseErrorSource = "@colibri/core/helpers/get-transaction-response";
export const getWasmHashFromGetTransactionResponse = (
  response: Api.GetSuccessfulTransactionResponse
): string => {
  try {
    const wasmHash = (
      response.resultMetaXdr
        .v4()
        .sorobanMeta()
        ?.returnValue()
        ?.value() as Buffer
    ).toString("hex") as string;

    return wasmHash;
  } catch (e) {
    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/getWasmHashFromGetTransactionResponse",
      message: "Failed to get wasm hash from GetTransactionResponse!",
      code: ErrorCode.FAILED_TO_GET_WASM_HASH,
      meta: {
        data: {
          resultMetaXdr: softTryToXDR(() =>
            response.resultMetaXdr.toXDR("base64")
          ),
        },
      },
    });
  }
};
