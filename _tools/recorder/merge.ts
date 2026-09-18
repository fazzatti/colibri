import { join } from "node:path";
import {
  type RecorderReport,
  renderReport,
  summarize,
} from "@colibri/test-tooling/recorder/report";

/** Combine completed shard reports, retaining missing/failed shard evidence. */
export async function mergeReports(
  source: string,
  destination: string,
  expected: string[] = [],
): Promise<RecorderReport> {
  const report: RecorderReport = {
    schemaVersion: 1,
    runId: crypto.randomUUID(),
    records: [],
    diagnostics: [],
    complete: true,
    exitCode: 0,
  };
  const seen = new Set<string>();
  const runs = new Set<string>();
  const sources: { shard: string; runId: string; exitCode?: number }[] = [];
  async function read(directory: string, shard: string): Promise<void> {
    for await (const entry of Deno.readDir(directory)) {
      const path = join(directory, entry.name);
      if (entry.isDirectory) await read(path, shard);
      if (!entry.isFile || entry.name !== "report.json") continue;
      try {
        const child: RecorderReport = JSON.parse(await Deno.readTextFile(path));
        if (
          child.schemaVersion !== 1 || !Array.isArray(child.records) ||
          !Array.isArray(child.diagnostics) || typeof child.runId !== "string"
        ) {
          throw new Error("Invalid recorder report schema");
        }
        if (runs.has(child.runId)) throw new Error("Duplicate recorder run");
        runs.add(child.runId);
        seen.add(shard);
        sources.push({ shard, runId: child.runId, exitCode: child.exitCode });
        const id = (value: string) => `${child.runId}:${value}`;
        for (const record of child.records) {
          report.records.push({
            ...record,
            id: id(record.id),
            parentId: record.parentId ? id(record.parentId) : undefined,
            testId: record.testId ? id(record.testId) : undefined,
            callId: record.callId ? id(record.callId) : undefined,
          });
        }
        report.complete &&= child.complete;
        report.exitCode = Math.max(report.exitCode!, child.exitCode ?? 1);
        report.diagnostics.push(
          ...child.diagnostics.map((s) => `${shard}: ${s}`),
        );
      } catch (error) {
        report.diagnostics.push(`${shard}: cannot read ${path}: ${error}`);
      }
    }
  }
  await Deno.mkdir(source, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    if (entry.isDirectory) {
      await read(
        join(source, entry.name),
        entry.name.replace(/^test-evidence-/, ""),
      );
    }
  }
  for (const shard of expected) {
    if (!seen.has(shard)) {
      report.diagnostics.push(`Missing test shard: ${shard}`);
    }
  }
  if (!runs.size) report.diagnostics.push("No recorded test runs found.");
  if (report.diagnostics.length) report.complete = false;
  await Deno.mkdir(destination, { recursive: true });
  await Deno.writeTextFile(
    join(destination, "report.json"),
    JSON.stringify(report) + "\n",
  );
  await Deno.writeTextFile(
    join(destination, "report.html"),
    renderReport(report),
  );
  await Deno.writeTextFile(
    join(destination, "sources.json"),
    JSON.stringify(sources, null, 2) + "\n",
  );
  console.log("Combined Colibri evidence:", summarize(report));
  console.log(`HTML: ${join(destination, "report.html")}`);
  return report;
}

if (import.meta.main) {
  const [source, destination, ...options] = Deno.args;
  if (!source || !destination) {
    throw new Error(
      "Usage: merge <shard-directory> <output-directory> [--expected=shard,...]",
    );
  }
  const expected = options.find((value) =>
    value.startsWith("--expected=")
  )?.slice(11).split(",") ?? [];
  const report = await mergeReports(source, destination, expected);
  // Test failures already fail their own jobs; this gate diagnoses missing artifacts.
  if (
    report.diagnostics.some((message) =>
      /^(Missing test shard:|No recorded test runs|.*: cannot read )/.test(
        message,
      )
    )
  ) {
    Deno.exitCode = 1;
  }
}
