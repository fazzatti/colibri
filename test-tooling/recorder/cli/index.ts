/**
 * @module
 * Run instrumented Deno tests and rebuild JSON/HTML artifacts.
 */
import { runTests } from "@/recorder/cli/runner.ts";
import { aggregate } from "@/recorder/deno/aggregate.ts";
import * as ERROR from "@/recorder/error.ts";

/** Execute recorder CLI commands, returning the original test exit code. */
export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === "aggregate" && rest[0]) {
    await aggregate(rest[0], rest.includes("--html") ? { html: true } : {});
    return 0;
  }
  if (command === "run") {
    const separator = rest.indexOf("--");
    const config = rest.slice(0, separator < 0 ? rest.length : separator).find((
      arg,
    ) => arg.startsWith("--config="))?.slice(9);
    if (config) {
      return await runTests(
        config,
        separator < 0 ? [] : rest.slice(separator + 1),
      );
    }
  }
  throw new ERROR.INVALID_CONFIGURATION(
    "Usage: recorder run --config=tests/recording.ts -- -A --parallel tests | recorder aggregate <run-directory> [--html]",
  );
}
if (import.meta.main) {
  try {
    Deno.exitCode = await main(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode = 1;
  }
}
