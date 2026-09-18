import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rm, writeFile } from "node:fs/promises";
import process from "node:process";
import * as ERROR from "@/recorder/error.ts";
// Include the standalone reporter in the published graph without requiring a
// public entrypoint or a default export from a published library module.
import "@/recorder/node/reporter.ts";
const reporterURL = new URL(
  "../node/reporter" + (import.meta.url.endsWith(".ts") ? ".ts" : ".js"),
  import.meta.url,
).href;
export type RunnerKind = "deno" | "node";
const reserved = {
  deno: ["--junit-path"],
  node: [
    "--test-reporter",
    "--test-reporter-destination",
    "--watch",
    "--test-isolation",
  ],
};
/** Keep the test runner's result destinations owned by one recording run. */
export function nativeArguments(
  kind: RunnerKind,
  args: string[],
  directory: string,
): string[] {
  if (
    args.some((arg) =>
      reserved[kind].some((flag) => arg === flag || arg.startsWith(flag + "="))
    )
  ) {
    throw new ERROR.INVALID_CONFIGURATION(
      "The recorder owns runner result output and requires a single test run with file isolation.",
    );
  }
  return kind === "deno"
    ? ["test", `--junit-path=${join(directory, "runner.junit.xml")}`, ...args]
    : [
      "--test",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      `--test-reporter=${pathToFileURL(join(directory, "reporter.mjs")).href}`,
      `--test-reporter-destination=${join(directory, "runner.node.jsonl")}`,
      ...args,
    ];
}
/** Node loads this tiny adapter directly; the library itself keeps named exports. */
export async function prepareNodeReporter(directory: string): Promise<void> {
  await writeFile(
    join(directory, "reporter.mjs"),
    `export { nodeReporter as default } from ${JSON.stringify(reporterURL)};\n`,
  );
}
const runners = {
  deno: { prepare: async (_directory: string): Promise<void> => {} },
  node: { prepare: prepareNodeReporter },
};
/** Platform comes from the host runtime, with no external Deno dependency on Node. */
export const runtime: RunnerKind = process.versions.deno ? "deno" : "node";
export const nativeRunner: { prepare(directory: string): Promise<void> } =
  runners[runtime];
/** Remove only the temporary reporter adapter, leaving the collected evidence. */
export async function cleanupReporter(directory: string): Promise<void> {
  await rm(join(directory, "reporter.mjs"), { force: true });
}
