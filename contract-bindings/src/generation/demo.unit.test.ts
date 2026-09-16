import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { assertSpyCalls, stub } from "@std/testing/mock";
import {
  Contract,
  createContractErrorMatcherPlugin,
  type InvokeContractOutput,
  NetworkConfig,
} from "@colibri/core";
import { xdr } from "stellar-sdk";
import {
  CounterStatus,
  CounterSummary,
  Demo,
  type DemoInvocation,
  DemoSpec,
} from "colibri-internal/tests/generated-bindings/demo/index.ts";
import { contractId } from "colibri-internal/tests/binding-fixtures.ts";

const networkConfig = NetworkConfig.TestNet();
const options: DemoInvocation = {
  config: {
    source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    fee: "100",
    timeout: 30,
    signers: [],
  },
  auth: [],
};

describe("generated Demo client", () => {
  it("dispatches every bound read and invocation and decodes the original transaction result", async () => {
    const client = new Demo({ networkConfig, contractConfig: { contractId } });
    const summary = { count: 7, status: CounterStatus.Counting };
    const summaryValue = CounterSummary.from(summary);
    const cases = [
      {
        method: "summary",
        args: undefined,
        read: () => client.summary.read(),
        invoke: () => client.summary.invoke(options),
        raw: summaryValue.toScVal(),
      },
      {
        method: "get_count",
        args: undefined,
        read: client.getCount.read,
        invoke: () => client.getCount.invoke(options),
        raw: xdr.ScVal.scvU32(7),
      },
      {
        method: "increment",
        args: { by: 7 },
        read: () => client.increment.read({ by: 7 }),
        invoke: () =>
          client.increment.invoke({ ...options, methodArgs: { by: 7 } }),
        raw: xdr.ScVal.scvU32(7),
      },
      {
        method: "echo_summary",
        args: { summary: summaryValue },
        read: () => client.echoSummary.read({ summary: summaryValue }),
        invoke: () =>
          client.echoSummary.invoke({
            ...options,
            methodArgs: { summary: summaryValue },
          }),
        raw: summaryValue.toScVal(),
      },
    ];
    for (const entry of cases) {
      const expected = DemoSpec.funcResToNative(entry.method, entry.raw);
      using read = stub(Contract.prototype, "read", function (args) {
        assertStrictEquals(this, client);
        assertEquals(args, { method: entry.method, methodArgs: entry.args });
        return Promise.resolve(expected);
      });
      const receipt: InvokeContractOutput = {
        hash: "successful-transaction",
        ledger: 10,
        createdAt: 12,
        returnValue: entry.raw,
        response: { status: "SUCCESS" } as InvokeContractOutput["response"],
      };
      using invoke = stub(Contract.prototype, "invoke", function (args) {
        assertStrictEquals(this, client);
        assertEquals(args.method, entry.method);
        assertEquals(args.methodArgs, entry.args);
        assertStrictEquals(args.config, options.config);
        assertStrictEquals(args.auth, options.auth);
        return Promise.resolve(receipt);
      });
      assertEquals(await entry.read(), expected);
      const result = await entry.invoke();
      assertEquals(result, { ...receipt, value: expected });
      assertStrictEquals(result.returnValue, receipt.returnValue);
      assertStrictEquals(result.response, receipt.response);
      assertSpyCalls(read, 1);
      assertSpyCalls(invoke, 1);
    }
    assertEquals(client.events.CountChanged.name, "CountChanged");
    assertEquals(client.events.contractId, contractId);
  });

  it("preserves explicit error ownership, caller plugins and independent specs", () => {
    for (const errors of [false, {}] as const) {
      const client = new Demo({
        errors,
        networkConfig,
        contractConfig: { contractId },
      });
      assertEquals(client.readPipe.plugins, []);
      assertEquals(client.invokePipe.plugins, []);
    }
    const custom = createContractErrorMatcherPlugin({
      1: { message: "Application-owned error" },
    });
    const client = new Demo({
      errors: false,
      networkConfig,
      contractConfig: {
        contractId,
        plugins: { readPipe: [custom], invokePipe: [custom] },
      },
    });
    assertEquals(client.readPipe.plugins, [custom]);
    assertEquals(client.invokePipe.plugins, [custom]);
    const source = new Demo({
      networkConfig,
      contractConfig: { wasmHash: "ab".repeat(32), plugins: {} },
    });
    assertEquals(source.readPipe.plugins.length, 1);
    assertEquals(source.invokePipe.plugins.length, 1);
    assertEquals(source.readPipe.plugins[0].id, "contract-error-matcher");
    assertStrictEquals(
      source.readPipe.plugins[0],
      source.invokePipe.plugins[0],
    );
    assertNotStrictEquals(client.getSpec(), DemoSpec);
    assertNotStrictEquals(client.getSpec(), source.getSpec());
    assertEquals(client.getSpec().entries, DemoSpec.entries);
    assertEquals(source.events.contractId, undefined);
    assertEquals(source.events.CountChanged.name, "CountChanged");
  });
});
