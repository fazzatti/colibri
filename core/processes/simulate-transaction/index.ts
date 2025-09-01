import { ProcessEngine } from "convee";
import type {
  SimulateTransactionInput,
  SimulateTransactionOutput,
} from "./types.ts";
import * as E from "./error.ts";

import { Account, Transaction, TransactionBuilder } from "stellar-sdk";
import { assert } from "../../common/assert/assert.ts";
import { Api } from "stellar-sdk/rpc";

const simulateTransactionProcess = async (
  input: SimulateTransactionInput
): Promise<SimulateTransactionOutput> => {
  try {

    const { transaction, rpc } = input;

    let simulationResponse: Api.SimulateTransactionResponse

    try {
      simulationResponse = await rpc.simulateTransaction(transaction)
    } catch (e) {
      throw new E.UNEXPECTED_ERROR(input, e as Error);
      // throw PSIError.failedToSimulateTransaction(e as Error, extractConveyorBeltErrorMeta(item, this.getMeta(itemId)))
    }

    if (Api.isSimulationError(simulationResponse)) {
      throw new E.UNEXPECTED_ERROR(input, e as Error);
      // throw PSIError.simulationFailed(simulationResponse, extractConveyorBeltErrorMeta(item, this.getMeta(itemId)))
    }

    if (Api.isSimulationRestore(simulationResponse) && simulationResponse.result) {
      return {
        response: simulationResponse as Api.SimulateTransactionRestoreResponse,
        assembledTransaction: this.assembleTransaction(transaction, simulationResponse, item, itemId),
      } as SimulateTransactionPipelineOutput
    }

    if (Api.isSimulationSuccess(simulationResponse)) {
      return {
        response: simulationResponse as Api.SimulateTransactionSuccessResponse,
        assembledTransaction: this.assembleTransaction(transaction, simulationResponse, item, itemId),
      } as SimulateTransactionPipelineOutput
    }

    // throw PSIError.simulationResultCouldNotBeVerified(
    //   simulationResponse,
    //   extractConveyorBeltErrorMeta(item, this.getMeta(itemId))
    // )
  throw new E.UNEXPECTED_ERROR(input, e as Error);


  } catch (e) {
    if (e instanceof E.SimulateTransactionError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};


const assembleTransaction = (
    transaction: Transaction,
    simulationResponse: SorobanRpc.Api.SimulateTransactionSuccessResponse,
    item: SimulateTransactionPipelineInput,
    itemId: string
  ): Transaction => {
    try {
      return SorobanRpc.assembleTransaction(transaction, simulationResponse).build()
    } catch (error) {
      throw PSIError.failedToAssembleTransaction(
        error as Error,
        simulationResponse,
        transaction,
        extractConveyorBeltErrorMeta(item, this.getMeta(itemId))
      )
    }

export const SimulateTransaction = ProcessEngine.create(
  simulateTransactionProcess,
  {
    name: "SimulateTransaction",
  }
);
