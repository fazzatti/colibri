import type {
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
} from "@/core/index.ts";
import {
  type BuildVerificationPipeline,
  createBuildVerificationPipeline,
} from "@/pipelines/build-verification/index.ts";
import { createDefaultBuildVerificationDependencies } from "@/verifier/defaults.ts";
import type { ContractBuildVerifierOptions } from "@/verifier/types.ts";

/** Rebuilds Stellar contract Wasm and compares it byte-for-byte with a target. */
export class ContractBuildVerifier {
  /** Composable pipeline that owns this verifier's complete workflow. */
  public readonly verificationPipe: BuildVerificationPipeline;

  /** Creates a reusable verifier and installs caller plugins in order. */
  constructor(options: ContractBuildVerifierOptions = {}) {
    this.verificationPipe = createBuildVerificationPipeline(
      createDefaultBuildVerificationDependencies(options),
    );
    for (const plugin of options.plugins ?? []) {
      this.verificationPipe.use(plugin);
    }
  }

  /** Delegates one verification request to the configured pipeline. */
  verify(
    input: ContractBuildVerificationInput,
  ): Promise<ContractBuildVerificationResult> {
    if (input.mode === "outOfBand") {
      return this.verificationPipe.run(input);
    }
    return this.verificationPipe.run(input);
  }
}
