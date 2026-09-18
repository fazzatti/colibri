import { join } from "node:path";
import { mergeFragments } from "@/recorder/report/aggregate.ts";
import { renderReport } from "@/recorder/report/index.ts";
import { reconcileJUnit } from "@/recorder/deno/junit.ts";
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
}
/** Rebuild a report from artifacts only, including failed or interrupted runs. */
export async function aggregate(
  directory: string,
  options: { html?: boolean } = {},
): Promise<RecorderReport> {
  const manifest: RunManifest = JSON.parse(
    await Deno.readTextFile(join(directory, "manifest.json")),
  );
  if (
    manifest.schemaVersion !== 1 || typeof manifest.runId !== "string" ||
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
    reconcileJUnit(
      report,
      await Deno.readTextFile(join(directory, "runner.junit.xml")),
      manifest.cwd,
    );
  } catch (error) {
    report.complete = false;
    report.diagnostics.push(
      `Runner reconciliation unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (report.records.some((record) => record.status === "running")) {
    report.complete = false;
    report.diagnostics.push(
      "Some observations did not finish before the runner exited.",
    );
  }
  if (report.diagnostics.length) report.complete = false;
  await Deno.writeTextFile(
    join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (options.html ?? manifest.html) {
    await Deno.writeTextFile(
      join(directory, "report.html"),
      renderReport(report),
    );
  }
  return report;
}

async function readFragments(directory: string): Promise<string[]> {
  const fragments: string[] = [];
  try {
    for await (const entry of Deno.readDir(join(directory, "fragments"))) {
      if (entry.isFile && entry.name.endsWith(".jsonl")) {
        fragments.push(
          await Deno.readTextFile(join(directory, "fragments", entry.name)),
        );
      }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return fragments;
}
