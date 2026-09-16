import {
  assertEquals,
  assertInstanceOf,
  assertStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { assertSpyCalls, stub } from "@std/testing/mock";
import { plugin } from "convee";
import { Operation, SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";
import { type Api, Server } from "stellar-sdk/rpc";
import { readContract } from "@/contract/read/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { createReadFromContractPipeline } from "@/pipelines/read-from-contract/index.ts";
import { SorobanSymbol } from "@/soroban-types/values/primitives.ts";
import {
  amount,
  bindingSpec,
  contractId,
} from "colibri-internal/tests/binding-fixtures.ts";

describe("standalone contract reads", () => {
  it("builds argument-free and encoded calls through the default simulation pipeline", async () => {
    const rpc = new Server("https://rpc.example.test");
    const networkConfig = NetworkConfig.TestNet();
    const spec = bindingSpec();
    for (const owner of [undefined, "alice", new SorobanSymbol("alice")]) {
      const method = owner === undefined ? "ping" : "balance";
      const expected = Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args: owner === undefined ? [] : [xdr.ScVal.scvSymbol("alice")],
      });
      using simulate = stub(rpc, "simulateTransaction", (transaction) => {
        assertInstanceOf(transaction, Transaction);
        assertEquals(
          transaction.operations,
          [Operation.fromXdrObject(expected)],
        );
        const response: Api.SimulateTransactionSuccessResponse = {
          id: "simulation",
          latestLedger: 10,
          events: [],
          transactionData: new SorobanDataBuilder(),
          minResourceFee: "100",
          _parsed: true,
          result: {
            auth: [],
            retval: owner === undefined ? xdr.ScVal.scvVoid() : amount(),
          },
        };
        return Promise.resolve(response);
      });
      const result = await readContract({
        networkConfig,
        contractId,
        spec,
        method,
        rpc,
        methodArgs: owner === undefined ? undefined : { owner },
      });
      assertEquals(result, owner === undefined ? null : 42n);
      assertSpyCalls(simulate, 1);
    }
  });

  it("reuses the caller's pipeline and its plugins without requiring another RPC", async () => {
    const networkConfig = NetworkConfig.CustomNet({
      networkPassphrase: "custom",
    });
    const rpc = new Server("https://rpc.example.test");
    using simulate = stub(rpc, "simulateTransaction", () =>
      Promise.resolve({
        id: "simulation",
        latestLedger: 10,
        events: [],
        transactionData: new SorobanDataBuilder(),
        minResourceFee: "100",
        _parsed: true,
        result: { auth: [], retval: amount() },
      }));
    let builds = 0;
    const observer = plugin({ id: "observe-read", target: "build-transaction" })
      .onOutput((transaction: Transaction) => {
        builds++;
        return transaction;
      });
    const pipeline = createReadFromContractPipeline({ networkConfig, rpc });
    pipeline.use(observer);
    assertEquals(
      await readContract({
        networkConfig,
        contractId,
        spec: bindingSpec(),
        method: "balance",
        methodArgs: { owner: "alice" },
        pipeline,
      }),
      42n,
    );
    assertEquals(builds, 1);
    assertSpyCalls(simulate, 1);
    assertStrictEquals(pipeline.plugins[0], observer);
  });
});
