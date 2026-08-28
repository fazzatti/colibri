import type {
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
} from "../core/index.ts";
import { ContractBuildVerifier } from "./contract-build-verifier.ts";
import type { ContractBuildVerifierOptions } from "./types.ts";

/** Verifies one contract build without retaining a verifier instance. */
export const verifyContractBuild = (
  input: ContractBuildVerificationInput,
  options?: ContractBuildVerifierOptions,
): Promise<ContractBuildVerificationResult> =>
  new ContractBuildVerifier(options).verify(input);
