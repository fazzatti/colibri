import { Pipeline } from "convee";
import { BuildTransaction } from "../../processes/build-transaction/index.ts";
import { SimulateTransaction } from "../../processes/simulate-transaction/index.ts";

import { Server } from "stellar-sdk/rpc";
import { ColibriError } from "../../error/index.ts";
import { buildToSimulate } from "../../transformers/pipeline-connectors/build-to-simulate.ts";
import type { BuildTransactionInput } from "../../processes/build-transaction/types.ts";
import type {
  ReadFromContractInput,
  CreateReadFromContractPipelineArgs,
} from "./types.ts";
import { assertRequiredArgs } from "../../common/assert/assert-args.ts";
import { simulateToRetval } from "../../transformers/pipeline-connectors/simulate-to-retval/index.ts";
import { Keypair } from "stellar-sdk";
import type { Ed25519PublicKey } from "../../common/types.ts";
import * as E from "./error.ts";

const inputToBuild = (networkPassphrase: string) => {
  return (input: ReadFromContractInput): BuildTransactionInput => {
    const { operations } = input;

    const source = Keypair.random().publicKey() as Ed25519PublicKey;

    return {
      baseFee: "10000000",
      source,
      networkPassphrase,
      operations,
      sequence: "1",
    };
  };
};

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

    const pipelineSteps = [
      inputToBuild(networkConfig.networkPassphrase),
      BuildTransaction,
      buildToSimulate(rpc),
      SimulateTransaction,
      simulateToRetval,
    ] as const;

    const pipe = Pipeline.create([...pipelineSteps], {
      name: "ReadFromContractPipeline",
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
