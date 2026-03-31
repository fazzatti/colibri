import type {
  SimulateTransactionInput,
  SimulateTransactionOutput,
} from "@/processes/simulate-transaction/types.ts";
import * as E from "@/processes/simulate-transaction/error.ts";

import { Api } from "stellar-sdk/rpc";

/** Simulates a built transaction against Stellar RPC. */
export const simulateTransaction = async (
  input: SimulateTransactionInput
): Promise<SimulateTransactionOutput> => {
  try {
    const { transaction, rpc } = input;

    let simulationResponse: Api.SimulateTransactionResponse;

    try {
      simulationResponse = await rpc.simulateTransaction(transaction);
    } catch (e) {
      throw new E.COULD_NOT_SIMULATE_TRANSACTION(input, e as Error);
    }

    if (Api.isSimulationError(simulationResponse)) {
      throw new E.SIMULATION_FAILED(input, simulationResponse);
    }

    if (
      Api.isSimulationRestore(simulationResponse) &&
      simulationResponse.result
    ) {
      return {
        ...(simulationResponse as Api.SimulateTransactionRestoreResponse),
      } as SimulateTransactionOutput;
    }

    if (Api.isSimulationSuccess(simulationResponse)) {
      return {
        ...(simulationResponse as Api.SimulateTransactionSuccessResponse),
      } as SimulateTransactionOutput;
    }

    throw new E.SIMULATION_RESULT_NOT_VERIFIED(input, simulationResponse);
  } catch (e) {
    if (e instanceof E.SimulateTransactionError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};
/** Error constructors emitted by {@link simulateTransaction}. */
export const SimulateTransactionErrors: typeof E = E;
