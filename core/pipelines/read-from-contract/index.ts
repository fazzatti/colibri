import { pipe, step } from "convee";
import { Server } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import { buildToSimulate } from "@/pipelines/shared/connectors/build-to-simulate.ts";
import type { CreateReadFromContractPipelineArgs } from "@/pipelines/read-from-contract/types.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { simulateToRetval } from "@/pipelines/shared/connectors/simulate-to-retval/index.ts";
import * as E from "@/pipelines/read-from-contract/error.ts";
import { inputToBuild } from "@/pipelines/read-from-contract/connectors.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  createBuildTransactionStep,
  createSimulateTransactionStep,
} from "@/steps/index.ts";

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
    const BuildTransaction = createBuildTransactionStep();
    const SimulateTransaction = createSimulateTransactionStep();

    const pipelineSteps = [
      step(inputToBuild(networkConfig.networkPassphrase), {
        id: "read-from-contract-input" as const,
      }),
      BuildTransaction,
      buildToSimulate(rpc),
      SimulateTransaction,
      simulateToRetval,
    ] as const;

    const readPipe = pipe([...pipelineSteps], {
      id: PIPELINE_NAME,
    });

    return readPipe;
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
