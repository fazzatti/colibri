import { assert, assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { aggregate } from "@/recorder/artifacts/aggregate.ts";
import { Journal } from "@/recorder/artifacts/journal.ts";
import { Collector } from "@/recorder/runtime/collector.ts";
import { reconcileNodeResults } from "@/recorder/artifacts/node-results.ts";
import { nodeReporter as reporter } from "@/recorder/node/reporter.ts";

const { describe, it } = recordColibriTests(import.meta.url);
describe("Node result reconciliation", () => {
  it("preserves worker file identity for equal paths and final hook failures", async () => {
    const c = new Collector();
    for (const file of ["file:///tmp/a.mjs", "file:///tmp/b.mjs"]) {
      const record = c.record("test", "same", { file });
      record.path = ["suite", "same"];
      record.status = "passed";
      c.emit(record);
    }
    async function* events() {
      for (const file of ["/tmp/a.mjs", "/tmp/b.mjs"]) {
        yield { type: "test:start", data: { name: "suite", nesting: 0 } };
        yield { type: "test:start", data: { name: "same", nesting: 1 } };
        yield {
          type: "test:fail",
          data: {
            name: "same",
            nesting: 1,
            file: "adapter.js",
            details: {
              error: { message: "hook failed", cause: { message: "teardown" } },
            },
          },
        };
        yield { type: "test:summary", data: { file } };
      }
    }
    let text = "";
    for await (const chunk of reporter(events())) text += chunk;
    const report = c.report();
    reconcileNodeResults(report, text, "/tmp");
    assertEquals(report.diagnostics, []);
    for (const record of report.records) {
      assertEquals(record.status, "passed");
      assertEquals(record.runnerStatus, "failed");
      assertEquals(record.data, {
        callback: null,
        runnerFailure: "hook failed: teardown",
      });
    }
  });
  it("aggregates Node manifests and writes the same report schema", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const collector = new Collector({}, "node-run"),
        journal = new Journal(collector, directory);
      const record = collector.record("test", "passes", { file: "test.mjs" });
      record.status = "passed";
      collector.emit(record);
      await journal.flush();
      await Deno.writeTextFile(
        directory + "/manifest.json",
        JSON.stringify({
          schemaVersion: 1,
          runId: "node-run",
          cwd: directory,
          runtime: "node",
          endedAt: "now",
          exitCode: 0,
        }),
      );
      await Deno.writeTextFile(
        directory + "/runner.node.jsonl",
        JSON.stringify({
          file: "test.mjs",
          results: [{ path: ["passes"], status: "passed" }],
        }) + "\n" + JSON.stringify({ complete: true }) + "\n",
      );
      const report = await aggregate(directory);
      assertEquals(report.complete, true);
      assertEquals(report.records[0].runnerStatus, "passed");
      assertEquals(
        JSON.parse(await Deno.readTextFile(directory + "/report.json")),
        report,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("marks incomplete or ambiguous results and retains failures outside observations", () => {
    const c = new Collector();
    for (let i = 0; i < 2; i++) {
      c.emit(c.record("test", "same", { file: "a.mjs" }));
    }
    const report = c.report();
    reconcileNodeResults(
      report,
      JSON.stringify({
        results: [{ file: "a.mjs", path: ["same"], status: "failed" }],
      }),
      "/tmp",
    );
    assertEquals(report.records.map((r) => r.runnerStatus), [
      "unknown",
      "unknown",
    ]);
    assert(report.diagnostics.some((d) => d.includes("incomplete")));
    assert(report.diagnostics.some((d) => d.includes("outside")));
    for (
      const value of [
        {},
        { results: [{ file: 1, path: [], status: "passed" }] },
        { results: [{ file: "a", path: [1], status: "passed" }] },
        { results: [{ file: "a", path: [], status: "invalid" }] },
      ]
    ) {
      assertThrows(() =>
        reconcileNodeResults(c.report(), JSON.stringify(value), "/tmp")
      );
    }
  });
  it("retains skipped/todo and file-level failures without worker summaries", async () => {
    async function* events() {
      yield { type: "test:start", data: {} };
      yield {
        type: "test:pass",
        data: { name: "skip", file: "a.mjs", skip: true },
      };
      yield {
        type: "test:pass",
        data: { name: "todo", file: "a.mjs", todo: "later" },
      };
      yield { type: "test:fail", data: { name: "syntax", file: "b.mjs" } };
      yield { type: "test:pass", data: { file: "a.mjs" } };
    }
    let text = "";
    for await (const chunk of reporter(events())) text += chunk;
    const rows = JSON.parse(text.split("\n")[0]).results;
    assertEquals(rows.map((r: { status: string }) => r.status), [
      "skipped",
      "skipped",
      "failed",
      "passed",
    ]);
    const c = new Collector();
    for (const name of ["skip", "todo", "<anonymous>"]) {
      c.emit(c.record("test", name, { file: "a.mjs" }));
    }
    const report = c.report();
    reconcileNodeResults(report, text, "/tmp");
    assertEquals(report.records.map((r) => r.runnerStatus), [
      "skipped",
      "skipped",
      "passed",
    ]);
    assert(report.diagnostics.some((d) => d.includes("syntax")));
  });
});
