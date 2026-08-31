/**
 * Runnable command-line interface for contract build verification.
 *
 * @module
 */

export * from "@/cli/index.ts";
export { BuildVerificationError, Code } from "@/error/base.ts";

if (import.meta.main) {
  const { runBuildVerificationCli } = await import("@/cli/run.ts");
  Deno.exit(await runBuildVerificationCli(Deno.args));
}
