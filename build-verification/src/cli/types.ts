import type {
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
} from "../core/index.ts";
import type { writeVerificationEvidence } from "../reporting/evidence-writer.ts";
import type { writeVerificationLogs } from "../reporting/log-writer.ts";
import type { ContractBuildVerifierOptions } from "../verifier/types.ts";

/**
 * Injectable boundaries retained for CLI composition and tests.
 * @internal
 */
export type BuildVerificationCliDependencies = {
  readonly createVerifier?: (
    options: ContractBuildVerifierOptions,
  ) => {
    verify(
      input: ContractBuildVerificationInput,
    ): Promise<ContractBuildVerificationResult>;
  };
  readonly writeEvidence?: typeof writeVerificationEvidence;
  readonly writeLogs?: typeof writeVerificationLogs;
};

/** Parsed build-verification command-line flag map. */
export type ParsedBuildVerificationFlags = Map<string, string | true>;
