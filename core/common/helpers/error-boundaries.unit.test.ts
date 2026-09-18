import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Account, Keypair, Networks, TransactionBuilder } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import { ArrayLengthOutOfBoundsError } from "@/common/helpers/bounded-array.ts";
import { IsBlankStringError } from "@/common/helpers/string.ts";
import {
  FailedToGetContractIdError,
  FailedToGetWasmHashError,
  getContractIdFromGetTransactionResponse,
  getWasmHashFromGetTransactionResponse,
  InvalidContractIdError,
  MissingContractIdError,
  MissingWasmHashError,
} from "@/common/helpers/get-transaction-response.ts";
import {
  FailedToGetOperationsFromTransactionError,
  FailedToGetTransactionTimeoutError,
  getOperationsFromTransaction,
  getTransactionTimeout,
} from "@/common/helpers/transaction.ts";

const { describe, it } = recordColibriTests(import.meta.url);

const context = {
  domain: "helpers" as const,
  source: "consumer/helper",
  message: "Validation failed",
};

describe("helper error boundaries", () => {
  it("returns no deadline when an envelope has no time bounds", () => {
    const transaction = new TransactionBuilder(
      new Account(Keypair.random().publicKey(), "0"),
      { fee: "100", networkPassphrase: Networks.TESTNET },
    ).setTimeout(30).build();
    Object.defineProperty(transaction, "timeBounds", { value: undefined });
    assertEquals(getTransactionTimeout(transaction), undefined);
  });

  for (
    const [ErrorClass, code] of [
      [ArrayLengthOutOfBoundsError, "HLP_BND_01"],
      [IsBlankStringError, "HLP_STR_00"],
      [InvalidContractIdError, "HLP_GTR_03"],
      [MissingWasmHashError, "HLP_GTR_04"],
      [MissingContractIdError, "HLP_GTR_05"],
    ] as const
  ) {
    it(`${code} defaults absent details but preserves explicitly supplied diagnostics`, () => {
      const absent = new ErrorClass(context);
      assertEquals(absent.code, code);
      assertEquals(absent.details, "An unexpected error occurred");
      assertEquals(absent.meta, { cause: undefined });
      const cause = new Error("Underlying failure");
      const data = { address: "invalid" };
      const diagnostic = {
        rootCause: "Input",
        suggestion: "Correct the input",
      };
      for (const details of ["Consumer explanation", undefined]) {
        const supplied = new ErrorClass({
          ...context,
          details,
          diagnostic,
          meta: { cause, data },
        });
        assertEquals(supplied.code, code);
        assertEquals(supplied.domain, context.domain);
        assertEquals(supplied.source, context.source);
        assertEquals(supplied.message, context.message);
        assertEquals(supplied.details, details);
        assertStrictEquals(supplied.meta?.cause, cause);
        assertStrictEquals(supplied.meta?.data, data);
        assertStrictEquals(supplied.diagnostic, diagnostic);
      }
    });
  }

  for (
    const [read, property, ErrorClass, code] of [
      [
        getTransactionTimeout,
        "timeBounds",
        FailedToGetTransactionTimeoutError,
        "HLP_TX_01",
      ],
      [
        getOperationsFromTransaction,
        "tx",
        FailedToGetOperationsFromTransactionError,
        "HLP_TX_02",
      ],
    ] as const
  ) {
    it(`${code} preserves typed failures and wraps native failures with their original cause`, () => {
      const typed = new IsBlankStringError({
        ...context,
        details: "Existing diagnostics",
      });
      for (const cause of [typed, new Error("Broken envelope accessor")]) {
        const transaction = new TransactionBuilder(
          new Account(Keypair.random().publicKey(), "0"),
          {
            fee: "100",
            networkPassphrase: Networks.TESTNET,
          },
        ).setTimeout(30).build();
        Object.defineProperty(transaction, property, {
          get() {
            throw cause;
          },
        });
        const error = assertThrows(() => read(transaction), ColibriError);
        if (cause === typed) {
          assertStrictEquals(error, typed);
        } else {
          assertEquals(error instanceof ErrorClass, true);
          assertEquals(error.code, code);
          assertEquals(error.message, cause.message);
          assertStrictEquals(error.meta?.cause, cause);
          assertEquals(error.details, cause.stack);
        }
      }
    });
  }

  for (
    const [read, ErrorClass, code] of [
      [
        getWasmHashFromGetTransactionResponse,
        FailedToGetWasmHashError,
        "HLP_GTR_01",
      ],
      [
        getContractIdFromGetTransactionResponse,
        FailedToGetContractIdError,
        "HLP_GTR_02",
      ],
    ] as const
  ) {
    it(`${code} keeps typed metadata failures intact and wraps unknown failures once`, () => {
      const typed = new IsBlankStringError(context);
      for (const cause of [typed, new Error("Broken result metadata")]) {
        const response = {
          resultMetaXdr: {
            get type() {
              throw cause;
            },
            toXdr() {
              return "original-result-xdr";
            },
          },
        } as unknown as Api.GetSuccessfulTransactionResponse;
        const error = assertThrows(() => read(response), ColibriError);
        if (cause === typed) {
          assertStrictEquals(error, typed);
        } else {
          assertEquals(error instanceof ErrorClass, true);
          assertEquals(error.code, code);
          assertStrictEquals(error.meta?.cause, cause);
          assertEquals(error.meta?.data, {
            resultMetaXdr: "original-result-xdr",
          });
        }
      }
    });
  }
});
