import { Pipeline } from "convee";
import { P_BuildTransaction } from "../../processes/build-transaction/index.ts";
import { P_SimulateTransaction } from "../../processes/simulate-transaction/index.ts";

import { Server } from "stellar-sdk/rpc";
import { ColibriError } from "../../error/index.ts";
import { buildToSimulate } from "../../transformers/pipeline-connectors/build-to-simulate.ts";
import type { CreateReadFromContractPipelineArgs } from "./types.ts";
import { assertRequiredArgs } from "../../common/assert/assert-args.ts";
import { simulateToRetval } from "../../transformers/pipeline-connectors/simulate-to-retval/index.ts";
import * as E from "./error.ts";
import { inputToBuild } from "./connectors.ts";

export const PIPELINE_NAME = "ReadFromContractPipeline";

const createReadFromContractPipeline = ({
  networkConfig,
}: CreateReadFromContractPipelineArgs) => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        rpcUrl: networkConfig && networkConfig.rpcUrl,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    const rpc = new Server(networkConfig.rpcUrl!); // already asserted above

    const BuildTransaction = P_BuildTransaction();
    const SimulateTransaction = P_SimulateTransaction();

    const pipelineSteps = [
      inputToBuild(networkConfig.networkPassphrase),
      BuildTransaction,
      buildToSimulate(rpc),
      SimulateTransaction,
      simulateToRetval,
    ] as const;

    const pipe = Pipeline.create([...pipelineSteps], {
      name: PIPELINE_NAME,
    });

    return pipe;
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

export { createReadFromContractPipeline };

const PIPE_ReadFromContract = {
  create: createReadFromContractPipeline,
  name: PIPELINE_NAME,
  errors: E,
};

export { PIPE_ReadFromContract };
