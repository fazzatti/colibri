import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { Address, Operation, xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { Contract } from "@/contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import {
  SorobanError,
  SorobanString,
  SorobanSymbol,
  SorobanU32,
  SorobanVal,
} from "@/soroban-types/values/primitives.ts";
import { SorobanLedgerKeyNonce } from "@/soroban-types/values/system.ts";
import { SorobanValueError } from "@/soroban-types/error.ts";
import {
  containsSorobanValue,
  decodeSorobanResult,
  encodeSorobanArguments,
  toContractScVal,
} from "@/contract/encoding/index.ts";
import { createSorobanType } from "@/soroban-types/codecs/custom.ts";
import { buildContractDataLedgerKey } from "@/ledger-entries/keys.ts";
import {
  func,
  option,
  udt,
  union,
  valueSpec,
} from "colibri-internal/tests/soroban-values-fixtures.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";

const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const source = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const config = { source, fee: "100", timeout: 10, signers: [] } as const;

function capturePipe(
  client: Contract,
  name: "readPipe" | "invokePipe",
  run: (input: { operations: xdr.Operation[] }) => Promise<unknown>,
) {
  const descriptor = Object.getOwnPropertyDescriptor(client, name)!;
  const calls: unknown[] = [];
  Object.defineProperty(client, name, {
    configurable: true,
    value: {
      run: (input: { operations: xdr.Operation[] }) => {
        calls.push(input);
        return run(input);
      },
    },
  });
  return {
    calls,
    [Symbol.dispose]() {
      Object.defineProperty(client, name, descriptor);
    },
  };
}

describe("Soroban value boundaries", () => {
  it("encodes and decodes errors nested in optional maps, tuples and custom enums", () => {
    const error = xdr.ScSpecTypeDef.scSpecTypeError();
    const tuple = xdr.ScSpecTypeDef.scSpecTypeTuple(
      new xdr.ScSpecTypeTuple({
        valueTypes: [udt("AccessError"), udt("Choice")],
      }),
    );
    const valueType = option(xdr.ScSpecTypeDef.scSpecTypeMap(
      new xdr.ScSpecTypeMap({
        keyType: xdr.ScSpecTypeDef.scSpecTypeSymbol(),
        valueType: tuple,
      }),
    ));
    const spec = new Spec([
      ...valueSpec().entries,
      union("Choice", { Empty: null, Failure: [error] }),
      func("nested_error", { value: valueType }, [valueType]),
    ]);
    const value = new Map([
      ["ADMIN", [1, {
        tag: "Failure",
        values: [{ type: "sceContract", code: 7 }],
      }]],
    ]);
    const expected = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("ADMIN"),
        val: xdr.ScVal.scvVec([
          xdr.ScVal.scvU32(1),
          xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("Failure"),
            xdr.ScVal.scvError(xdr.ScError.sceContract(7)),
          ]),
        ]),
      }),
    ]);
    assertEquals(encodeSorobanArguments(spec, "nested_error", { value }), [
      expected,
    ]);
    assertEquals(decodeSorobanResult(spec, "nested_error", expected), [
      ...value,
    ]);
    assertEquals(
      encodeSorobanArguments(spec, "nested_error", { value: undefined }),
      [xdr.ScVal.scvVoid()],
    );
    const invalid = new Map([["ADMIN", [999, { tag: "Empty" }]]]);
    assertThrows(
      () => encodeSorobanArguments(spec, "nested_error", { value: invalid }),
      SorobanValueError,
    );
  });
  it("retains native encoding for recursive ordinary custom types", () => {
    const spec = new Spec([
      ...valueSpec().entries,
      func("node", { node: udt("Node") }, [udt("Node")]),
    ]);
    const node = { value: 1, next: { value: 2, next: undefined } };
    const encoded = encodeSorobanArguments(spec, "node", { node });
    assertEquals(encoded, spec.funcArgsToScVals("node", { node }));
    assertEquals(decodeSorobanResult(spec, "node", encoded[0]), {
      value: 1,
      next: { value: 2, next: null },
    });
  });
  it("keeps raw calls on the native spec path and validates wrapped ABI identity", () => {
    const spec = bindingSpec();
    using native = stub(
      spec,
      "funcArgsToScVals",
      () => [xdr.ScVal.scvSymbol("native")],
    );
    assertEquals(
      encodeSorobanArguments(spec, "balance", { owner: "alice" })[0].toXdr(
        "base64",
      ),
      xdr.ScVal.scvSymbol("native").toXdr("base64"),
    );
    assertEquals(native.calls.length, 1);
    assertEquals(
      encodeSorobanArguments(spec, "balance", {
        owner: new SorobanSymbol("alice"),
      })[0].toXdr("base64"),
      xdr.ScVal.scvSymbol("alice").toXdr("base64"),
    );
    assertEquals(native.calls.length, 1);
    assertThrows(
      () =>
        encodeSorobanArguments(spec, "balance", {
          owner: new SorobanString("alice"),
        }),
      SorobanValueError,
    );
    assertThrows(
      () =>
        encodeSorobanArguments(spec, "balance", {
          other: new SorobanSymbol("alice"),
        }),
      SorobanValueError,
    );
    const node: Record<string, unknown> = {};
    node.next = node;
    assertEquals(containsSorobanValue(node), false);
    assertEquals(
      containsSorobanValue(new Map([[new SorobanSymbol("a"), 1]])),
      true,
    );
    assertEquals(containsSorobanValue(new Date()), false);
    assertEquals(
      containsSorobanValue(
        Object.assign(Object.create(null), { value: new SorobanU32(1) }),
      ),
      true,
    );
  });
  it("preserves invocation operations, pipeline instances and result metadata", async () => {
    const spec = valueSpec();
    const client = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { contractId, spec },
    });
    const raw = {
      role: "ADMIN",
      count: 7,
      key: { tag: "RoleIndexToAccount", values: ["ADMIN", 7] },
    };
    const wrapped = createSorobanType(spec, "Config").from(raw);
    const encoded = spec.nativeToScVal(raw, udt("Config"));
    const expected = Operation.invokeContractFunction({
      contract: contractId,
      function: "echo",
      args: [encoded],
    });
    using read = capturePipe(client, "readPipe", ({ operations }) => {
      assertEquals(operations[0].toXdr("base64"), expected.toXdr("base64"));
      return Promise.resolve(encoded);
    });
    const readPipe = client.readPipe;
    assertEquals(
      await client.read({ method: "echo", methodArgs: { config: raw } }),
      raw,
    );
    assertEquals(
      await client.read({ method: "echo", methodArgs: { config: wrapped } }),
      raw,
    );
    assertStrictEquals(client.readPipe, readPipe);
    assertEquals(read.calls.length, 2);
    const result = {
      returnValue: encoded,
      hash: "abc",
    } as InvokeContractOutput;
    using invoke = capturePipe(client, "invokePipe", ({ operations }) => {
      assertEquals(operations[0].toXdr("base64"), expected.toXdr("base64"));
      return Promise.resolve(result);
    });
    assertStrictEquals(
      await client.invoke({
        method: "echo",
        methodArgs: { config: wrapped },
        config: { ...config, signers: [] },
      }),
      result,
    );
    assertEquals(invoke.calls.length, 1);
    await assertRejects(
      () =>
        client.read({
          method: "echo",
          methodArgs: {
            config: createSorobanType(spec, "Pair").from(["ADMIN", 7]),
          },
        }),
      SorobanValueError,
    );
    assertEquals(read.calls.length, 2);
  });
  it("normalizes constructor arguments without altering deployment operation semantics", async () => {
    const spec = valueSpec();
    const client = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { wasmHash: "00".repeat(32), spec },
    });
    const value = { role: "ADMIN", count: 7, key: { tag: "ExistingRoles" } };
    const salt = new Uint8Array(32);
    const expected = Operation.createCustomContract({
      address: new Address(source),
      salt,
      wasmHash: new Uint8Array(32),
      constructorArgs: spec.funcArgsToScVals("__constructor", {
        config: value,
      }),
    });
    const stop = new Error("stop after operation construction");
    using invoke = capturePipe(client, "invokePipe", ({ operations }) => {
      assertEquals(operations[0].toXdr("base64"), expected.toXdr("base64"));
      return Promise.reject(stop);
    });
    await assertRejects(() =>
      client.deploy({
        constructorArgs: {
          config: createSorobanType(spec, "Config").from(value),
        },
        config: { ...config, signers: [] },
        salt,
      })
    );
    assertEquals(invoke.calls.length, 1);
  });
  it("adapts values to native raw invocation and accepts wrapped ledger keys", async () => {
    const client = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { contractId },
    });
    const encoded = xdr.ScVal.scvSymbol("ADMIN");
    const expected = Operation.invokeContractFunction({
      contract: contractId,
      function: "role",
      args: [encoded],
    });
    using read = capturePipe(client, "readPipe", ({ operations }) => {
      assertEquals(operations[0].toXdr("base64"), expected.toXdr("base64"));
      return Promise.resolve(encoded);
    });
    assertEquals(
      await client.readRaw({
        method: "role",
        methodArgs: [new SorobanSymbol("ADMIN").toScVal()],
      }),
      encoded,
    );
    using invoke = capturePipe(client, "invokePipe", ({ operations }) => {
      assertEquals(operations[0].toXdr("base64"), expected.toXdr("base64"));
      return Promise.resolve({ returnValue: encoded } as InvokeContractOutput);
    });
    await client.invokeRaw({
      operationArgs: {
        function: "role",
        args: [new SorobanSymbol("ADMIN").toScVal()],
      },
      config: { ...config, signers: [] },
    });
    assertEquals(invoke.calls.length, 1);
    assertEquals(read.calls.length, 1);
    for (const durability of ["persistent", "temporary"] as const) {
      assertEquals(
        buildContractDataLedgerKey({
          contractId,
          durability,
          key: new SorobanSymbol("ADMIN"),
        }).toXdr("base64"),
        buildContractDataLedgerKey({ contractId, durability, key: encoded })
          .toXdr("base64"),
      );
    }
    assertThrows(
      () => toContractScVal(new SorobanLedgerKeyNonce(1n)),
      SorobanValueError,
    );
    assertStrictEquals(toContractScVal(encoded), encoded);
  });
  it("extends error and nested Result codecs while retaining native top-level Results", () => {
    const error = xdr.ScSpecTypeDef.scSpecTypeError();
    const resultType = xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({
        okType: xdr.ScSpecTypeDef.scSpecTypeU32(),
        errorType: error,
      }),
    );
    const nested = xdr.ScSpecTypeDef.scSpecTypeVec(
      new xdr.ScSpecTypeVec({ elementType: resultType }),
    );
    const spec = new Spec([
      func("error", { error }, [error]),
      func("nested", { values: nested }, [nested]),
      func("result", {}, [resultType]),
      func("ping", {}),
    ]);
    const nativeError = { type: "sceContract", code: 7 } as const;
    const encodedError = new SorobanError(nativeError).toScVal();
    assertEquals(
      encodeSorobanArguments(spec, "error", { error: nativeError }),
      [encodedError],
    );
    assertEquals(decodeSorobanResult(spec, "error", encodedError), nativeError);
    const values = [{ ok: 7 }, { error: nativeError }];
    const encoded = encodeSorobanArguments(spec, "nested", { values })[0];
    assertEquals(decodeSorobanResult(spec, "nested", encoded), values);
    assertEquals(
      decodeSorobanResult(spec, "result", xdr.ScVal.scvU32(7)),
      spec.funcResToNative("result", xdr.ScVal.scvU32(7)),
    );
    assertEquals(
      decodeSorobanResult(spec, "result", encodedError),
      spec.funcResToNative("result", encodedError),
    );
    assertEquals(decodeSorobanResult(spec, "ping", xdr.ScVal.scvVoid()), null);
    const extended = new Spec([
      func("extended", {}, [
        xdr.ScSpecTypeDef.scSpecTypeResult(
          new xdr.ScSpecTypeResult({ okType: nested, errorType: error }),
        ),
      ]),
    ]);
    const decoded = decodeSorobanResult(extended, "extended", encoded) as {
      unwrap(): unknown;
    };
    assertEquals(decoded.unwrap(), values);
    const valSpec = new Spec([
      func("any", { value: xdr.ScSpecTypeDef.scSpecTypeVal() }),
    ]);
    const generic = encodeSorobanArguments(valSpec, "any", {
      value: [new SorobanSymbol("ADMIN"), 7],
    })[0];
    assertEquals(generic.type, "scvVec");
    assertThrows(
      () =>
        encodeSorobanArguments(valSpec, "any", {
          value: new SorobanVal(xdr.ScVal.scvVec(null)),
        }),
      SorobanValueError,
    );
  });
});
