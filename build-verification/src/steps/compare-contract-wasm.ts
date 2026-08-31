import { type Step, step } from "convee";
import { compareContractWasm } from "@/processes/compare-contract-wasm/index.ts";
import { COMPARE_CONTRACT_WASM_STEP_ID } from "@/steps/ids.ts";

/** Creates the compare-contract-wasm step used in verifier pipelines. */
export const createCompareContractWasmStep = (): Step<
  Parameters<typeof compareContractWasm>[0],
  Awaited<ReturnType<typeof compareContractWasm>>,
  Error,
  typeof COMPARE_CONTRACT_WASM_STEP_ID
> => step(compareContractWasm, { id: COMPARE_CONTRACT_WASM_STEP_ID });
