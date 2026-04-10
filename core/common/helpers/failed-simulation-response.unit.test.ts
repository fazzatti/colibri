import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { getStellarAssetContractIdFromFailedSimulationResponse } from "@/common/helpers/failed-simulation-response.ts";
import { ColibriError } from "@/error/index.ts";

function makeSimulationErrorResponse(
  values: xdr.ScVal[] | undefined,
): Api.SimulateTransactionErrorResponse {
  return {
    events: values
      ? [{
        event: () => ({
          body: () => ({
            v0: () => ({
              data: () => ({
                vec: () => values,
              }),
            }),
          }),
        }),
      }] as unknown as Api.SimulateTransactionErrorResponse["events"]
      : undefined,
  } as Api.SimulateTransactionErrorResponse;
}

describe("getStellarAssetContractIdFromFailedSimulationResponse", () => {
  it("extracts the deployed Stellar Asset Contract id from the failure payload", () => {
    const contractHash = Buffer.alloc(32, 7);
    const response = makeSimulationErrorResponse([
      xdr.ScVal.scvString("contract already exists"),
      xdr.ScVal.scvBytes(contractHash),
    ]);

    const contractId = getStellarAssetContractIdFromFailedSimulationResponse(
      response,
    );

    assertEquals(typeof contractId, "string");
    assertEquals(contractId.length > 0, true);
  });

  it("throws a typed ColibriError when the response is not an already-wrapped asset failure", () => {
    const response = makeSimulationErrorResponse(undefined);

    const error = assertThrows(
      () => getStellarAssetContractIdFromFailedSimulationResponse(response),
      ColibriError,
    );

    assertInstanceOf(error, ColibriError);
    assertEquals(error.code, "HLP_FSR_01");
    assertEquals(
      error.details,
      "The simulation response does not indicate an already wrapped asset.",
    );
    assertEquals(
      (error.meta?.data as { simulationResponse: Api.SimulateTransactionErrorResponse })
        .simulationResponse,
      response,
    );
  });

  it("wraps malformed responses into the same typed ColibriError contract", () => {
    const response = {
      events: [{}],
    } as Api.SimulateTransactionErrorResponse;

    const error = assertThrows(
      () => getStellarAssetContractIdFromFailedSimulationResponse(response),
      ColibriError,
    );

    assertInstanceOf(error, ColibriError);
    assertEquals(error.code, "HLP_FSR_01");
    assertExists(error.meta?.cause);
  });
});
