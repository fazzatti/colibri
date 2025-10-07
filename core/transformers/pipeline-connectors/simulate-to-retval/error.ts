import { TransformerError } from "../../error.ts";
import type { SimulateTransactionOutput } from "../../../processes/simulate-transaction/types.ts";

export enum Code {
  NO_RETURN_VALUE = "TRN_SIMTRV_001",
}

export type MetaData = {
  simulation: SimulateTransactionOutput;
};

export abstract class SimulateToRetvalError extends TransformerError<
  Code,
  MetaData
> {
  override readonly source =
    "@colibri/core/transformers/pipeline-connectors/simulate-to-retval";
}

export class NO_RETURN_VALUE extends SimulateToRetvalError {
  constructor(simulation: SimulateTransactionOutput) {
    super({
      code: Code.NO_RETURN_VALUE,
      message: "No return value from simulation!",
      data: {
        simulation,
      },
      details: `The simulation did not contain a return value. This is normally because the transaction did not contain a contract invocation operation.`,
    });
  }
}

export const ERROR_TRN_SIMTRV = {
  [Code.NO_RETURN_VALUE]: NO_RETURN_VALUE,
};
