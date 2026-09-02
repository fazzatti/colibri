import { assertEquals, assertThrows } from "@std/assert";
import { Buffer } from "node:buffer";
import { describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import {
  getContractIdFromGetTransactionResponse,
  getWasmHashFromGetTransactionResponse,
} from "@/common/helpers/get-transaction-response.ts";

const makeResponse = (
  returnValue: xdr.ScVal,
): Api.GetSuccessfulTransactionResponse => ({
  resultMetaXdr: {
    type: "v4",
    v4: {
      sorobanMeta: {
        returnValue,
      },
    },
    toXdr() {
      return "result-meta-xdr";
    },
  },
} as unknown as Api.GetSuccessfulTransactionResponse);

const makeBrokenResponse = (
  cause: unknown,
): Api.GetSuccessfulTransactionResponse => ({
  resultMetaXdr: {
    get type(): never {
      throw cause;
    },
    toXdr() {
      return "result-meta-xdr";
    },
  },
} as unknown as Api.GetSuccessfulTransactionResponse);

const makeNonV4Response = (): Api.GetSuccessfulTransactionResponse => ({
  resultMetaXdr: {
    type: "v3",
    toXdr() {
      return "result-meta-xdr";
    },
  },
} as unknown as Api.GetSuccessfulTransactionResponse);

describe("get-transaction-response helpers", () => {
  it("extracts the wasm hash from a successful transaction response", () => {
    const response = makeResponse(
      xdr.ScVal.scvBytes(Buffer.from("cafe", "hex")),
    );

    const wasmHash = getWasmHashFromGetTransactionResponse(response);

    assertEquals(wasmHash, "cafe");
  });

  it("wraps malformed wasm hash responses", () => {
    const error = assertThrows(
      () =>
        getWasmHashFromGetTransactionResponse(
          makeBrokenResponse(new Error("bad meta")),
        ),
      ColibriError,
    );

    assertEquals(error.code, "HLP_GTR_01");
    assertEquals(error.meta?.data, { resultMetaXdr: "result-meta-xdr" });
    assertEquals((error.meta?.cause as Error).message, "bad meta");
  });

  it("wraps successful metadata without a Wasm-hash return value", () => {
    const error = assertThrows(
      () =>
        getWasmHashFromGetTransactionResponse(
          makeResponse(xdr.ScVal.scvVoid()),
        ),
      ColibriError,
    );

    assertEquals(error.code, "HLP_GTR_04");
    assertEquals(
      error.message,
      "Transaction result does not contain a WASM hash",
    );
    assertEquals(error.meta?.data, { resultMetaXdr: "result-meta-xdr" });
  });

  it("rejects non-v4 metadata without treating it as a Wasm result", () => {
    const error = assertThrows(
      () => getWasmHashFromGetTransactionResponse(makeNonV4Response()),
      ColibriError,
    );

    assertEquals(error.code, "HLP_GTR_04");
  });

  it("extracts the contract ID from a successful transaction response", () => {
    const contract = Address.contract(Buffer.alloc(32, 11));
    const response = makeResponse(xdr.ScVal.scvAddress(contract.toScAddress()));

    const contractId = getContractIdFromGetTransactionResponse(response);

    assertEquals(contractId, contract.toString());
  });

  it("rethrows invalid contract IDs without wrapping them", () => {
    const originalFromScAddress = Address.fromScAddress;
    const contract = Address.contract(Buffer.alloc(32, 12));
    const response = makeResponse(xdr.ScVal.scvAddress(contract.toScAddress()));

    try {
      // deno-lint-ignore no-explicit-any
      (Address as any).fromScAddress = () => ({
        toString: () => "invalid-contract-id",
      });

      const error = assertThrows(
        () => getContractIdFromGetTransactionResponse(response),
        ColibriError,
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
      () =>
        getContractIdFromGetTransactionResponse(makeBrokenResponse("bad meta")),
      ColibriError,
    );

    assertEquals(error.code, "HLP_GTR_02");
    assertEquals(error.meta?.data, { resultMetaXdr: "result-meta-xdr" });
    assertEquals(error.meta?.cause, "bad meta");
  });

  it("wraps successful metadata without a contract-ID return value", () => {
    const error = assertThrows(
      () =>
        getContractIdFromGetTransactionResponse(
          makeResponse(xdr.ScVal.scvVoid()),
        ),
      ColibriError,
    );

    assertEquals(error.code, "HLP_GTR_05");
    assertEquals(
      error.message,
      "Transaction result does not contain a contract ID",
    );
    assertEquals(error.meta?.data, { resultMetaXdr: "result-meta-xdr" });
  });

  it("rejects non-v4 metadata without treating it as a contract result", () => {
    const error = assertThrows(
      () => getContractIdFromGetTransactionResponse(makeNonV4Response()),
      ColibriError,
    );

    assertEquals(error.code, "HLP_GTR_05");
  });
});
