import { ProcessEngine } from "convee";
import type {
  SimulateTransactionInput,
  SimulateTransactionOutput,
} from "@/processes/simulate-transaction/types.ts";
import * as E from "@/processes/simulate-transaction/error.ts";

import { Api } from "stellar-sdk/rpc";

const simulateTransactionProcess = async (
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
const PROCESS_NAME = "SimulateTransaction" as const;

const P_SimulateTransaction = () =>
  ProcessEngine.create<
    SimulateTransactionInput,
    SimulateTransactionOutput,
    E.SimulateTransactionError,
    typeof PROCESS_NAME
  >(simulateTransactionProcess, {
    name: PROCESS_NAME,
  });

const P_SimulateTransactionErrors = E;

export { P_SimulateTransaction, P_SimulateTransactionErrors };
