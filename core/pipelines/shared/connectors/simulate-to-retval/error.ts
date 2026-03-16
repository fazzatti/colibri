import { PipelineConnectorError } from "@/pipelines/shared/connectors/error.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";

export enum Code {
  NO_RETURN_VALUE = "PIPE_SIMTRV_001",
}

export type MetaData = {
  simulation: SimulateTransactionOutput;
};

export abstract class SimulateToRetvalError extends PipelineConnectorError<
  Code,
  MetaData
> {
  override readonly source =
    "@colibri/core/pipelines/shared/connectors/simulate-to-retval";
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

export const ERROR_PIPE_SIMTRV = {
  [Code.NO_RETURN_VALUE]: NO_RETURN_VALUE,
};
