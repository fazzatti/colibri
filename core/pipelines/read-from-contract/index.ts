import { Pipeline } from "convee";
import { Server } from "stellar-sdk/rpc";
import { P_BuildTransaction } from "@/processes/build-transaction/index.ts";
import { P_SimulateTransaction } from "@/processes/simulate-transaction/index.ts";
import { ColibriError } from "@/error/index.ts";
import { buildToSimulate } from "@/transformers/pipeline-connectors/build-to-simulate.ts";
import type { CreateReadFromContractPipelineArgs } from "@/pipelines/read-from-contract/types.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { simulateToRetval } from "@/transformers/pipeline-connectors/simulate-to-retval/index.ts";
import * as E from "@/pipelines/read-from-contract/error.ts";
import { inputToBuild } from "@/pipelines/read-from-contract/connectors.ts";
import { assert } from "@/common/assert/assert.ts";

export const PIPELINE_NAME = "ReadFromContractPipeline";

const createReadFromContractPipeline = ({
  networkConfig,
  rpc,
}: CreateReadFromContractPipelineArgs) => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl!);
    }
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
export type ReadFromContractPipeline = ReturnType<
  typeof PIPE_ReadFromContract.create
>;
