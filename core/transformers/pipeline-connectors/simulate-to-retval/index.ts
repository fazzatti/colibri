import type { xdr } from "stellar-sdk";
import type { Transformer } from "convee";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import { assert } from "@/common/assert/assert.ts";
import * as E from "@/transformers/pipeline-connectors/simulate-to-retval/error.ts";

export const simulateToRetval: Transformer<
  SimulateTransactionOutput,
  xdr.ScVal
> = (simulateOutput: SimulateTransactionOutput): xdr.ScVal => {
  // result is not present if simulation isn't contract invocation
  // simulateToRetval should only be used when invoking contracts
  assert(simulateOutput.result, new E.NO_RETURN_VALUE(simulateOutput));

  return simulateOutput.result.retval;
};
