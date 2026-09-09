/** Interactive and flag-driven Deno CLI, plus injectable prompt and writer APIs.
 * @module
 */
export * from "@/cli.ts";
export * from "@/writer.ts";
export type { GeneratedBindings } from "@/types.ts";
import { runCli } from "@/cli.ts";
if (import.meta.main) {
  try {
    await runCli(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode = 1;
  }
}
