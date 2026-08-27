/**
 * Runnable command-line interface for contract build verification.
 *
 * @module
 */

export * from "@/cli.ts";
export * from "@/types.ts";
export { writeVerificationEvidence } from "@/verifier.ts";

import { runBuildVerificationCli } from "@/cli.ts";

if (import.meta.main) {
  Deno.exit(await runBuildVerificationCli(Deno.args));
}
