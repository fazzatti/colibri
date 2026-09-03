import { type Pipe, pipe, type PipeContext, type Step, step } from "convee";
import { Server } from "stellar-sdk/rpc";
import { ColibriError } from "@/error/index.ts";
import { buildToSimulate } from "@/pipelines/shared/connectors/build-to-simulate.ts";
import type {
  CreateReadFromContractPipelineArgs,
  ReadFromContractInput,
} from "@/pipelines/read-from-contract/types.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { simulateToRetval } from "@/pipelines/shared/connectors/simulate-to-retval/index.ts";
import * as E from "@/pipelines/read-from-contract/error.ts";
import { inputToBuild } from "@/pipelines/read-from-contract/connectors.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  createBuildTransactionStep,
  createSimulateTransactionStep,
} from "@/steps/index.ts";
import type {
  BuildTransactionInput,
  BuildTransactionOutput,
} from "@/processes/build-transaction/types.ts";
import type {
  SimulateTransactionInput,
  SimulateTransactionOutput,
} from "@/processes/simulate-transaction/types.ts";

/** Stable id of the read-from-contract pipeline. */
export const READ_FROM_CONTRACT_PIPELINE_ID = "ReadFromContractPipeline";

type ReadFromContractPipelineSteps = readonly [
  Step<
    ReadFromContractInput,
    BuildTransactionInput,
    Error,
    "read-from-contract-input"
  >,
  ReturnType<typeof createBuildTransactionStep>,
  Step<BuildTransactionOutput, SimulateTransactionInput>,
  ReturnType<typeof createSimulateTransactionStep>,
  Step<SimulateTransactionOutput, ReturnType<typeof simulateToRetval>>,
];

type ReadFromContractPipelineRuntime = Pipe<
  ReadFromContractPipelineSteps,
  Error,
  PipeContext<ReadFromContractPipelineSteps>,
  typeof READ_FROM_CONTRACT_PIPELINE_ID
>;

/**
 * Builds the read-from-contract pipeline with fully inferred step types.
 */
const buildReadFromContractPipeline = ({
  networkConfig,
  rpc,
}: CreateReadFromContractPipelineArgs & {
  rpc: Server;
}): ReadFromContractPipelineRuntime => {
  const BuildTransaction = createBuildTransactionStep();
  const SimulateTransaction = createSimulateTransactionStep();

  const pipelineSteps: ReadFromContractPipelineSteps = [
    step(inputToBuild(networkConfig.networkPassphrase), {
      id: "read-from-contract-input" as const,
    }),
    BuildTransaction,
    step(buildToSimulate(rpc)),
    SimulateTransaction,
    step(simulateToRetval),
  ];

  return pipe([...pipelineSteps], {
    id: READ_FROM_CONTRACT_PIPELINE_ID,
  });
};

/**
 * Creates the read-from-contract pipeline.
 *
 * @param args Pipeline dependencies and network configuration.
 * @returns Configured read-from-contract pipeline.
 */
const createReadFromContractPipeline = ({
  networkConfig,
  rpc,
}: CreateReadFromContractPipelineArgs): ReturnType<
  typeof buildReadFromContractPipeline
> => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
      },
      (argName: string) => new E.MISSING_ARG(argName),
    );

    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl!, {
        allowHttp: networkConfig.allowHttp ?? false,
      });
    }
    return buildReadFromContractPipeline({ networkConfig, rpc });
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

export { createReadFromContractPipeline };
/** Runtime type returned by {@link createReadFromContractPipeline}. */
export type ReadFromContractPipeline = ReturnType<
  typeof createReadFromContractPipeline
>;
export { ERROR_PIPE_RFC } from "@/pipelines/read-from-contract/error.ts";
