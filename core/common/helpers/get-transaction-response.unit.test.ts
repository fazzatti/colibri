import { assertEquals, assertThrows } from "@std/assert";
import { Buffer } from "buffer";
import { describe, it } from "@std/testing/bdd";
import { Address, type xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import {
  getContractIdFromGetTransactionResponse,
  getWasmHashFromGetTransactionResponse,
} from "@/common/helpers/get-transaction-response.ts";

const makeResponse = (returnValue: {
  value?: () => Buffer;
  address?: () => xdr.ScAddress;
}): Api.GetSuccessfulTransactionResponse =>
  ({
    resultMetaXdr: {
      v4() {
        return {
          sorobanMeta() {
            return {
              returnValue() {
                return returnValue;
              },
            };
          },
        };
      },
      toXDR() {
        return "result-meta-xdr";
      },
    },
  } as unknown as Api.GetSuccessfulTransactionResponse);

const makeBrokenResponse = (cause: unknown): Api.GetSuccessfulTransactionResponse =>
  ({
    resultMetaXdr: {
      v4() {
        throw cause;
      },
      toXDR() {
        return "result-meta-xdr";
      },
    },
  } as unknown as Api.GetSuccessfulTransactionResponse);

describe("get-transaction-response helpers", () => {
  it("extracts the wasm hash from a successful transaction response", () => {
    const response = makeResponse({
      value: () => Buffer.from("cafe", "hex"),
    });

    const wasmHash = getWasmHashFromGetTransactionResponse(response);

    assertEquals(wasmHash, "cafe");
  });

  it("wraps malformed wasm hash responses", () => {
    const error = assertThrows(
      () => getWasmHashFromGetTransactionResponse(makeBrokenResponse(new Error("bad meta"))),
      ColibriError
    );

    assertEquals(error.code, "HLP_GTR_01");
    assertEquals(error.meta?.data, { resultMetaXdr: "result-meta-xdr" });
    assertEquals((error.meta?.cause as Error).message, "bad meta");
  });

  it("extracts the contract ID from a successful transaction response", () => {
    const contract = Address.contract(Buffer.alloc(32, 11));
    const response = makeResponse({
      address: () => contract.toScAddress(),
    });

    const contractId = getContractIdFromGetTransactionResponse(response);

    assertEquals(contractId, contract.toString());
  });

  it("rethrows invalid contract IDs without wrapping them", () => {
    const originalFromScAddress = Address.fromScAddress;
    const contract = Address.contract(Buffer.alloc(32, 12));
    const response = makeResponse({
      address: () => contract.toScAddress(),
    });

    try {
      // deno-lint-ignore no-explicit-any
      (Address as any).fromScAddress = () => ({
        toString: () => "invalid-contract-id",
      });

      const error = assertThrows(
        () => getContractIdFromGetTransactionResponse(response),
        ColibriError
      );

      assertEquals(error.code, "HLP_GTR_03");
      assertEquals(error.meta?.data, { contractId: "invalid-contract-id" });
    } finally {
      // deno-lint-ignore no-explicit-any
      (Address as any).fromScAddress = originalFromScAddress;
    }
  });

  it("wraps malformed contract ID responses", () => {
    const error = assertThrows(
      () => getContractIdFromGetTransactionResponse(makeBrokenResponse("bad meta")),
      ColibriError
    );

    assertEquals(error.code, "HLP_GTR_02");
    assertEquals(error.meta?.data, { resultMetaXdr: "result-meta-xdr" });
    assertEquals(error.meta?.cause, "bad meta");
  });
});
