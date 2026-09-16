import { errorContext } from "@/common/helpers/error-context.ts";
import type { BaseMeta, ColibriErrorShape } from "@/error/types.ts";
import { Address, type xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import type { ContractId } from "@/strkeys/types.ts";
import { ColibriError } from "@/error/index.ts";

/** Stable helper failure codes. */
export enum FailedSimulationResponseCode {
  FAILED_TO_GET_ASSET_CONTRACT_ID = "HLP_FSR_01",
}

const baseErrorSource = "@colibri/core/helpers/failed-simulation-response";
const contractIdLookupContext = {
  domain: "helpers" as const,
  code: FailedSimulationResponseCode.FAILED_TO_GET_ASSET_CONTRACT_ID,
  source: baseErrorSource +
    "/getStellarAssetContractIdFromFailedSimulationResponse",
  message: "Failed to get the contract Id from the simulation response!",
  diagnostic: {
    rootCause:
      "When trying to identify the contract Id from the simulation response, an unexpected error occurred.",
    suggestion:
      "Ensure the simulation response is valid and contains the expected events. The reason behind the failure could be a different underlying cause than an already wrapped asset.",
  },
};

export const getStellarAssetContractIdFromFailedSimulationResponse = (
  response: Api.SimulateTransactionErrorResponse,
): ContractId => {
  try {
    const events = response.events;

    const data = events?.[0]?.event.body.v0.data;
    const dataVec: xdr.ScVal[] | null = data?.type === "scvVec" ? data.vec : [];

    if (
      dataVec?.[0]?.value?.toString() === "contract already exists" &&
      dataVec[1]?.type === "scvBytes"
    ) {
      const contractId = Address.contract(
        dataVec[1].bytes.toBytes(),
      ).toString();
      return contractId as ContractId;
    }

    throw new FailedToGetAssetContractIdError({
      ...contractIdLookupContext,
      details:
        "The simulation response does not indicate an already wrapped asset.",
      meta: {
        data: {
          simulationResponse: response,
        },
      },
    });
  } catch (e) {
    throw (e instanceof ColibriError
      ? e
      : new FailedToGetAssetContractIdError(errorContext(e, {
        ...contractIdLookupContext,
        meta: {
          data: {
            simulationResponse: response,
          },
        },
      })));
  }
};

/** Failed to get asset contract id. Stable code `HLP_FSR_01`. */
export class FailedToGetAssetContractIdError extends ColibriError<
  FailedSimulationResponseCode.FAILED_TO_GET_ASSET_CONTRACT_ID
> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      code: FailedSimulationResponseCode.FAILED_TO_GET_ASSET_CONTRACT_ID,
    });
  }
}
