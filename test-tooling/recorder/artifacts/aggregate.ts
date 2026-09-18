import { diagnosticMessage } from "@/recorder/runtime/diagnostic.ts";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { reconcileNodeResults } from "@/recorder/artifacts/node-results.ts";
import { join } from "node:path";
import { mergeFragments } from "@/recorder/report/aggregate.ts";
import { renderReport } from "@/recorder/report/index.ts";
import { reconcileJUnit } from "@/recorder/artifacts/deno-results.ts";
import type { RecorderReport } from "@/recorder/types.ts";
import * as ERROR from "@/recorder/error.ts";

/** Run metadata shared by all child runtimes. */
export interface RunManifest {
  schemaVersion: 1;
  runId: string;
  cwd: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  html?: boolean;
  /** Native test runner used to produce the results; absent in legacy Deno runs. */
  runtime?: "deno" | "node";
}
/** Rebuild a report from artifacts only, including failed or interrupted runs. */
export async function aggregate(
  directory: string,
  options: { html?: boolean } = {},
): Promise<RecorderReport> {
  const text = await readFile(join(directory, "manifest.json"), "utf8");
  let manifest: RunManifest;
  try {
    manifest = JSON.parse(text);
  } catch (cause) {
    throw new ERROR.INVALID_ARTIFACT("Invalid recorder run manifest JSON.", {
      cause,
    });
  }
  if (
    !manifest || manifest.schemaVersion !== 1 ||
    typeof manifest.runId !== "string" ||
    typeof manifest.cwd !== "string"
  ) throw new ERROR.INVALID_ARTIFACT("Invalid recorder run manifest.");
  const fragments = await readFragments(directory);
  const report = mergeFragments(manifest.runId, fragments);
  report.exitCode = manifest.exitCode;
  report.complete = Boolean(manifest.endedAt);
  if (!fragments.length) {
    report.diagnostics.push(
      "No recorder fragments were produced. Check recorder imports and child filesystem/environment permissions.",
    );
  }
  try {
    if (manifest.runtime === "node") {
      reconcileNodeResults(
        report,
        await readFile(join(directory, "runner.node.jsonl"), "utf8"),
        manifest.cwd,
      );
    } else {
      reconcileJUnit(
        report,
        await readFile(join(directory, "runner.junit.xml"), "utf8"),
        manifest.cwd,
      );
    }
  } catch (error) {
    report.complete = false;
    report.diagnostics.push(
      `Runner reconciliation unavailable: ${diagnosticMessage(error)}`,
    );
  }
  if (report.records.some((record) => record.status === "running")) {
    report.complete = false;
    report.diagnostics.push(
      "Some observations did not finish before the runner exited.",
    );
  }
  if (report.diagnostics.length) report.complete = false;
  await writeFile(
    join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (options.html ?? manifest.html) {
    await writeFile(
      join(directory, "report.html"),
      renderReport(report),
    );
  }
  return report;
}

async function readFragments(directory: string): Promise<string[]> {
  const fragments: string[] = [];
  try {
    for (
      const entry of await readdir(join(directory, "fragments"), {
        withFileTypes: true,
      })
    ) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        fragments.push(
          await readFile(join(directory, "fragments", entry.name), "utf8"),
        );
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return fragments;
}
