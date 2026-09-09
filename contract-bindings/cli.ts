/** Interactive and flag-driven Deno CLI, plus injectable prompt and writer APIs.
 * @module
 */
export * from "@/cli/run.ts";
export * from "@/output/write.ts";
export type { GeneratedBindings } from "@/types.ts";
import { runCli } from "@/cli/run.ts";
import { BindingError, Code } from "@/error.ts";
if (import.meta.main) {
  try {
    await runCli(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode =
      error instanceof BindingError && error.code === Code.CANCELLED ? 130 : 1;
  }
}
