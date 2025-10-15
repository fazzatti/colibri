import type { Api } from "stellar-sdk/rpc";
import type { ContractId } from "../../strkeys/types.ts";
import { Address, type xdr } from "stellar-sdk";
import { ColibriError } from "../../error/index.ts";

enum ErrorCode {
  FAILED_TO_GET_ASSET_CONTRACT_ID = "HLP_FSR_01",
}

const baseErrorSource = "@colibri/core/helpers/failed-simulation-response";

export const getStellarAssetContractIdFromFailedSimulationResponse = (
  response: Api.SimulateTransactionErrorResponse
): ContractId => {
  try {
    const events = response.events;

    const dataVec: xdr.ScVal[] | null = events
      ? events[0].event().body().v0().data().vec()
      : [];

    if (
      dataVec &&
      dataVec[0].value()?.toString() === "contract already exists"
    ) {
      const contractId = Address.contract(dataVec[1].bytes()).toString();
      return contractId as ContractId;
    }

    throw new Error(
      "The simulation response does not indicate an already wrapped asset."
    );
  } catch (e) {
    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      code: ErrorCode.FAILED_TO_GET_ASSET_CONTRACT_ID,
      source:
        baseErrorSource +
        "/getStellarAssetContractIdFromFailedSimulationResponse",
      message: "Failed to get the contract Id from the simulation response!",
      diagnostic: {
        rootCause:
          "When trying to identify the contract Id from the simulation response, an unexpected error occurred.",
        suggestion:
          "Ensure the simulation response is valid and contains the expected events. The reason behind the failure could be a different underlying cause than an already wrapped asset.",
      },
      meta: {
        data: {
          simulationResponse: response,
        },
      },
    });
  }
};
