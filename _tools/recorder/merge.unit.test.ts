import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { join } from "node:path";
import { mergeReports } from "./merge.ts";
import type { RecorderReport } from "@colibri/test-tooling/recorder/report";

describe("repository test evidence aggregation", () => {
  it("preserves failed runs, isolates record IDs and diagnoses missing or corrupt shards", async () => {
    const root = await Deno.makeTempDir();
    try {
      const input = join(root, "shards");
      async function shard(name: string, runId: string, exitCode = 0) {
        const path = join(input, `test-evidence-${name}`, runId);
        await Deno.mkdir(path, { recursive: true });
        const report: RecorderReport = {
          schemaVersion: 1,
          runId,
          exitCode,
          complete: true,
          diagnostics: [],
          records: [{
            id: "test",
            kind: "test",
            name,
            file: `${name}.ts`,
            status: "passed",
            runnerStatus: "passed",
            startedAt: "now",
          }, {
            id: "call",
            kind: "call",
            name: "call",
            file: `${name}.ts`,
            status: "passed",
            startedAt: "now",
            parentId: "test",
            testId: "test",
            callId: "test",
          }],
        };
        await Deno.writeTextFile(
          join(path, "report.json"),
          JSON.stringify(report),
        );
      }
      const empty = await mergeReports(
        join(root, "empty"),
        join(root, "missing"),
        ["core"],
      );
      assert(!empty.complete);
      assert(empty.diagnostics.includes("Missing test shard: core"));
      await shard("core", "one");
      await shard("react", "two", 1);
      const output = join(root, "combined");
      const report = await mergeReports(input, output, ["core", "react"]);
      assertEquals(report.records.length, 4);
      assertEquals(report.records[1].testId, "one:test");
      assertEquals(report.records[3].callId, "two:test");
      assertEquals(report.exitCode, 1);
      assert(report.complete);
      assertStringIncludes(
        await Deno.readTextFile(join(output, "report.html")),
        "Colibri test evidence",
      );
      const missing = await mergeReports(input, output, ["core", "webauth"]);
      assert(!missing.complete);
      assert(missing.diagnostics.includes("Missing test shard: webauth"));
      await shard("duplicate", "one");
      const duplicate = await mergeReports(input, output);
      assert(!duplicate.complete);
      assert(
        duplicate.diagnostics.some((s) => s.includes("Duplicate recorder run")),
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
});
