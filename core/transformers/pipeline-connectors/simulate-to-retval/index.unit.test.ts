import { assertEquals, assertRejects } from "@std/assert";

import { describe, it } from "@std/testing/bdd";
import { simulateToRetval } from "./index.ts";

import * as E from "./error.ts";
import { type SorobanDataBuilder, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";

describe("Pipeline Connector simulateToRetval", () => {
  it("extracts the return value from a simulation output", async () => {
    const mockSimulateOutputWithRetval: Api.SimulateTransactionSuccessResponse =
      {
        id: "1",
        minResourceFee: "1",
        latestLedger: 1,
        events: [],
        _parsed: true,
        result: {
          auth: [],
          retval: xdr.ScVal.scvU32(42),
        },
        transactionData: {} as SorobanDataBuilder,
      };

    assertEquals(
      await simulateToRetval(mockSimulateOutputWithRetval),
      xdr.ScVal.scvU32(42)
    );
  });

  it(" throws NO_RETURN_VALUE if the simulate output does not contain a return value", async () => {
    const mockSimulateOutputWithoutRetval: Api.SimulateTransactionSuccessResponse =
      {
        id: "1",
        minResourceFee: "1",
        latestLedger: 1,
        events: [],
        _parsed: true,

        transactionData: {} as SorobanDataBuilder,
      };

    await assertRejects(
      async () => await simulateToRetval(mockSimulateOutputWithoutRetval),
      E.NO_RETURN_VALUE
    );
  });
});
