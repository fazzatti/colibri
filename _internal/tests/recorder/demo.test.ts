import { assertEquals, assertThrows } from "@std/assert";
import { stub } from "@std/testing/mock";
import { Address, Operation, SorobanDataBuilder, xdr } from "stellar-sdk";
import { type Api, Server } from "stellar-sdk/rpc";
import { createReadFromContractPipeline, NetworkConfig } from "@colibri/core";
import { recorder } from "colibri-internal/tests/recorder/recording.ts";

const { describe, it, observer } = recorder.recordTests(import.meta.url);

describe("Offline recorder demonstration", () => {
  it("compares three simulated balance reads", async () => {
    // The Colibri pipeline is real. RPC responses are local fixtures: this demo
    // requires neither a wallet nor a running ledger, and sends no transactions.
    const rpc = new Server("https://rpc.example.org");
    let sample = 0;
    using simulation = stub(rpc, "simulateTransaction", () => {
      const response: Api.SimulateTransactionSuccessResponse = {
        _parsed: true,
        id: "offline-fixture",
        latestLedger: 100,
        events: [],
        minResourceFee: "120",
        transactionData: new SorobanDataBuilder()
          .setResources([1000, 1400, 1200][sample++], 500, 100)
          .setResourceFee(120),
        result: { auth: [], retval: xdr.ScVal.scvU32(7) },
      };
      return Promise.resolve(response);
    });
    const pipeline = observer.create(() =>
      createReadFromContractPipeline({
        networkConfig: NetworkConfig.TestNet(),
        rpc,
      }), { name: "token" });
    const operation = Operation.invokeContractFunction({
      contract: Address.contract(new Uint8Array(32)).toString(),
      function: "balance",
      args: [],
    });
    // Each call is a separate execution. Select Profiling in the report to see
    // the individual budgets and their grouped variance.
    for (let index = 0; index < 3; index++) {
      const result = await pipeline({ operations: [operation] });
      assertEquals(result, xdr.ScVal.scvU32(7));
    }
    assertEquals(simulation.calls.length, 3);
    observer.log("Fixture provenance", {
      networkCalls: 0,
      simulatedBudgets: true,
    });
  });

  it("retains an expected error while the test passes", () => {
    assertThrows(() =>
      observer.capture(() => {
        throw new TypeError("An expected demonstration error");
      })
    );
  });

  it.ignore("an ignored test is visible in the report", () => {});
});
