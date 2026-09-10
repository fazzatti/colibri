import {
  assertEquals,
  assertInstanceOf,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { xdr } from "stellar-sdk";
import { Contract } from "@/contract/index.ts";
import * as E from "@/contract/error.ts";
import { ColibriError } from "@/error/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";
import {
  amount,
  bindingSpec,
  contractId,
} from "colibri-internal/tests/binding-fixtures.ts";

class TypedContract extends Contract {
  decode<Value>(method: string, result: InvokeContractOutput) {
    return this.decodeInvocationResult<Value>(method, result);
  }
}

const successfulResult = (
  returnValue: InvokeContractOutput["returnValue"],
): InvokeContractOutput => ({
  hash: "successful-transaction",
  ledger: 7,
  createdAt: 12,
  returnValue,
  response: { status: "SUCCESS" } as InvokeContractOutput["response"],
});

const client = (withSpec = true): TypedContract =>
  new TypedContract({
    networkConfig: NetworkConfig.TestNet(),
    contractConfig: { contractId, spec: withSpec ? bindingSpec() : undefined },
  });

describe("Contract invocation decoding", () => {
  it("decodes the value while preserving every raw field without mutation", () => {
    const result = Object.freeze(successfulResult(amount()));
    const decoded = client().decode<bigint>("balance", result);
    const value: bigint | undefined = decoded.value;
    assertEquals(value, 42n);
    assertEquals(decoded, { ...result, value: 42n });
    assertStrictEquals(decoded.returnValue, result.returnValue);
    assertStrictEquals(decoded.response, result.response);
    assertEquals(Object.hasOwn(result, "value"), false);
  });

  it("returns undefined without requiring a spec when no return value exists", () => {
    const result = successfulResult(undefined);
    assertEquals(client(false).decode("unknown", result), {
      ...result,
      value: undefined,
    });
  });

  it("distinguishes an encoded void result from an absent return value", () => {
    assertEquals(
      client().decode<null>("ping", successfulResult(xdr.ScVal.scvVoid()))
        .value,
      null,
    );
  });

  it("preserves a successful result when its value does not match the spec", () => {
    const result = successfulResult(xdr.ScVal.scvString("wrong ABI"));
    const error = assertThrows(
      () => client().decode("balance", result),
      E.FAILED_TO_DECODE_INVOCATION_RESULT,
    );
    assertInstanceOf(error, ColibriError);
    assertEquals(error.code, "CONTR_021");
    assertEquals(error.domain, "contract");
    assertEquals(error.source, "@colibri/contract");
    assertEquals(error.meta.data.method, "balance");
    assertStrictEquals(error.meta.data.result, result);
    assertInstanceOf(error.meta.cause, Error);
    assertStrictEquals(E.ERROR_CONTR[error.code], error.constructor);
  });

  it("retains the result if loading the spec fails after a successful invocation", () => {
    const result = successfulResult(amount());
    const error = assertThrows(
      () => client(false).decode("balance", result),
      E.FAILED_TO_DECODE_INVOCATION_RESULT,
    );
    assertStrictEquals(error.meta.data.result, result);
    assertInstanceOf(error.meta.cause, E.MISSING_REQUIRED_PROPERTY);
  });

  it("retains the exact original cause, including non-Error exceptions", () => {
    const contract = client();
    const result = successfulResult(amount());
    for (
      const cause of [new Error("decoder failed"), { reason: "custom" }, null]
    ) {
      using _spec = stub(contract, "getSpec", () => {
        throw cause;
      });
      const error = assertThrows(
        () => contract.decode("balance", result),
        E.FAILED_TO_DECODE_INVOCATION_RESULT,
      );
      assertStrictEquals(error.meta.cause, cause);
      assertStrictEquals(error.meta.data.result, result);
    }
  });
});
