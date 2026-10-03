import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  createContractErrorMatcherPlugin,
  type InvokeContractOutput,
  NetworkConfig,
} from "@colibri/core";
import { Address, Operation, xdr } from "stellar-sdk";
import {
  Protocol28,
  type Protocol28Invocation,
  Protocol28Spec,
} from "colibri-internal/tests/generated-bindings/protocol-28/index.ts";
import { contractId } from "colibri-internal/tests/binding-fixtures.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const networkConfig = NetworkConfig.TestNet();
const options: Protocol28Invocation = {
  config: {
    source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    fee: "100",
    timeout: 30,
    signers: [],
  },
  auth: [],
};

describe("generated Protocol28 client", () => {
  it("encodes every bound method through Contract and preserves decoded and raw invocation results", async () => {
    const client = new Protocol28({
      networkConfig,
      contractConfig: { contractId },
    });
    // Inputs encode all declared fields; Rust results may omit absent options.
    const state = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("b"),
        val: xdr.ScVal.scvU32(7),
      }),
    ]);
    const cases = [
      {
        method: "echo",
        args: [xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("a"),
            val: xdr.ScVal.scvVoid(),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("b"),
            val: xdr.ScVal.scvU32(7),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("c"),
            val: xdr.ScVal.scvVoid(),
          }),
        ])],
        raw: state,
        decoded: { a: null, b: 7, c: null },
        read: () => client.echo.read({ state: { b: 7 } }),
        invoke: () =>
          client.echo.invoke({ ...options, methodArgs: { state: { b: 7 } } }),
      },
      {
        method: "updates",
        args: [xdr.ScVal.scvVoid(), xdr.ScVal.scvU32(7)],
        raw: xdr.ScVal.scvVoid(),
        decoded: null,
        read: () => client.updates.read({ a: null, b: 7 }),
        invoke: () =>
          client.updates.invoke({ ...options, methodArgs: { a: null, b: 7 } }),
      },
      ...[undefined, 42n].map((id) => ({
        method: "transfers",
        args: [
          new Address(options.config.source).toScVal(),
          new Address(contractId).toScVal(),
          id === undefined ? xdr.ScVal.scvVoid() : xdr.ScVal.scvU64(id),
        ],
        raw: xdr.ScVal.scvVoid(),
        decoded: null,
        read: () =>
          client.transfers.read({
            from: options.config.source,
            to: contractId,
            id,
          }),
        invoke: () =>
          client.transfers.invoke({
            ...options,
            methodArgs: { from: options.config.source, to: contractId, id },
          }),
      })),
    ];
    for (const entry of cases) {
      const operation = Operation.invokeContractFunction({
        contract: contractId,
        function: entry.method,
        args: entry.args,
        auth: [],
      });
      let reads = 0;
      let invocations = 0;
      Object.defineProperty(client, "readPipe", {
        configurable: true,
        value: {
          run: ({ operations }: { operations: xdr.Operation[] }) => {
            reads++;
            assertEquals(operations, [operation]);
            return Promise.resolve(entry.raw);
          },
        },
      });
      const receipt: InvokeContractOutput = {
        hash: "successful-protocol-28-transaction",
        ledger: 10,
        createdAt: 12,
        returnValue: entry.raw,
        response: { status: "SUCCESS" } as InvokeContractOutput["response"],
      };
      Object.defineProperty(client, "invokePipe", {
        configurable: true,
        value: {
          run: ({ config, operations }: {
            config: Protocol28Invocation["config"];
            operations: xdr.Operation[];
          }) => {
            invocations++;
            assertStrictEquals(config, options.config);
            assertEquals(operations, [operation]);
            return Promise.resolve(receipt);
          },
        },
      });
      assertEquals(await entry.read(), entry.decoded);
      const result = await entry.invoke();
      assertEquals(result, { ...receipt, value: entry.decoded });
      assertStrictEquals(result.returnValue, receipt.returnValue);
      assertStrictEquals(result.response, receipt.response);
      assertEquals([reads, invocations], [1, 1]);
    }
    assertEquals(client.events.contractId, contractId);
    assertEquals(client.events.SparseUpdate.name, "SparseUpdate");
  });

  it("respects caller error ownership and plugins with isolated specs for ID and Wasm clients", () => {
    for (const errors of [undefined, false, {}] as const) {
      const client = new Protocol28({
        errors,
        networkConfig,
        contractConfig: { contractId },
      });
      assertEquals(client.readPipe.plugins, []);
      assertEquals(client.invokePipe.plugins, []);
    }
    const errors = { 1: { message: "Application-owned error" } };
    const custom = createContractErrorMatcherPlugin(errors);
    const client = new Protocol28({
      errors,
      networkConfig,
      contractConfig: {
        contractId,
        plugins: { readPipe: [custom], invokePipe: [custom] },
      },
    });
    assertEquals(client.readPipe.plugins.length, 2);
    assertEquals(client.invokePipe.plugins.length, 2);
    assertStrictEquals(client.readPipe.plugins[1], custom);
    assertStrictEquals(client.invokePipe.plugins[1], custom);
    assertStrictEquals(
      client.readPipe.plugins[0],
      client.invokePipe.plugins[0],
    );
    const source = new Protocol28({
      errors,
      networkConfig,
      contractConfig: { wasmHash: "ab".repeat(32), plugins: {} },
    });
    assertEquals(source.readPipe.plugins.length, 1);
    assertEquals(source.invokePipe.plugins.length, 1);
    assertEquals(source.readPipe.plugins[0].id, "contract-error-matcher");
    assertNotStrictEquals(client.getSpec(), Protocol28Spec);
    assertNotStrictEquals(client.getSpec(), source.getSpec());
    assertEquals(client.getSpec().entries, Protocol28Spec.entries);
    assertEquals(source.events.contractId, undefined);
    assertEquals(source.events.SparseUpdate.name, "SparseUpdate");
  });
});
