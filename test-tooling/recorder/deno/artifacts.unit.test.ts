import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { join } from "node:path";
import { stub } from "@std/testing/mock";
import { Collector } from "@/recorder/runtime/collector.ts";
import { environment, Journal } from "@/recorder/artifacts/journal.ts";
import { aggregate } from "@/recorder/artifacts/aggregate.ts";
import { main } from "@/recorder/cli/index.ts";
import { RecorderError } from "@/recorder/error.ts";
import { reconcileJUnit } from "@/recorder/artifacts/deno-results.ts";

const { describe, it } = recordColibriTests(import.meta.url);

async function temporary(
  fn: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await Deno.makeTempDir();
  try {
    await fn(directory);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}
describe("recorder artifacts and failure handling", () => {
  it("drains sequentially and keeps failed writes observable without changing test results", () =>
    temporary(async (directory) => {
      const collector = new Collector({}, "run");
      const journal = new Journal(collector, directory);
      collector.emit(collector.record("log", "one", { file: "file.ts" }));
      journal.flushSync();
      collector.emit(collector.record("log", "two", { file: "file.ts" }));
      await Promise.all([journal.flush(), journal.flush()]);
      assertEquals(collector.pending.length, 0);
      assertEquals(
        (await Deno.readTextFile(
          join(directory, "fragments", collector.fragmentId + ".jsonl"),
        )).trim().split("\n").length,
        2,
      );
      const bad = join(directory, "file");
      await Deno.writeTextFile(bad, "occupied");
      const failed = new Journal(collector, bad);
      collector.emit(collector.record("log", "three", { file: "file.ts" }));
      failed.flushSync();
      await failed.flush();
      assert(
        collector.diagnostics.some((d) => d.includes("Journal write failed")),
      );
      assert(collector.pending.length > 0);
      const memory = new Journal(new Collector());
      memory.flushSync();
      await memory.flush();
    }));
  it("works without optional environment permission", () => {
    using denied = stub(Deno.env, "get", () => {
      throw new Deno.errors.NotCapable("permission denied");
    });
    assertEquals(environment("COLIBRI_RECORDER_RUN_ID"), undefined);
    assertEquals(denied.calls.length, 1);
  });
  it("reports missing journals, missing JUnit, partial calls and invalid manifests", () =>
    temporary(async (directory) => {
      await Deno.writeTextFile(
        join(directory, "manifest.json"),
        JSON.stringify({
          schemaVersion: 1,
          runId: "run",
          cwd: directory,
          endedAt: "now",
          exitCode: 0,
        }),
      );
      const missing = await aggregate(directory);
      assert(!missing.complete);
      assertStringIncludes(missing.diagnostics.join(), "No recorder fragments");
      const c = new Collector({}, "run");
      const j = new Journal(c, directory);
      c.emit(c.record("call", "interrupted", { file: "file.ts" }));
      await j.flush();
      await Deno.writeTextFile(
        join(directory, "runner.junit.xml"),
        "<testsuites></testsuites>",
      );
      await Deno.writeTextFile(
        join(directory, "fragments", "unrelated.txt"),
        "ignored",
      );
      await Deno.mkdir(join(directory, "fragments", "subdirectory"));
      const interrupted = await aggregate(directory, { html: false });
      assert(!interrupted.complete);
      assertStringIncludes(interrupted.diagnostics.join(), "did not finish");
      assertEquals(await main(["aggregate", directory, "--html"]), 0);
      await Deno.writeTextFile(join(directory, "manifest.json"), "{}");
      await assertRejects(() => aggregate(directory), RecorderError);
      await assertRejects(() => main([]), RecorderError);
    }));
  it("marks duplicate full names ambiguous and decodes XML entities without resolving entities", () => {
    const c = new Collector();
    for (const file of ["one.ts", "two.ts"]) {
      const record = c.record("test", "same", { file });
      record.path = ["same"];
      c.emit(record);
    }
    const report = c.report();
    reconcileJUnit(
      report,
      '<testsuites><testcase classname="wrapper.ts" name="same"><failure>failed</failure></testcase></testsuites>',
      "/tmp",
    );
    assert(report.records.every((r) => r.runnerStatus === "unknown"));
    assertStringIncludes(
      report.diagnostics.join(),
      "outside a uniquely recorded",
    );
    const second = new Collector();
    const r = second.record("test", 'A & B "quoted"', { file: "/tmp/test.ts" });
    r.path = [r.name];
    second.emit(r);
    const escaped = second.report();
    reconcileJUnit(
      escaped,
      '<testsuites><testcase classname="test.ts" name="A &amp; B &#34;quoted&#x22;"><skipped/></testcase></testsuites>',
      "/tmp",
    );
    assertEquals(escaped.records[0].runnerStatus, "skipped");
  });
  it("matches std BDD's synthetic global suite for file-level hooks", () => {
    const collector = new Collector();
    const record = collector.record("test", "works", { file: "test.ts" });
    record.path = ["suite", "works"];
    collector.emit(record);
    const report = collector.report();
    reconcileJUnit(
      report,
      '<testsuites><testcase classname="wrapper.ts" name="global &gt; suite &gt; works"/></testsuites>',
      "/tmp",
    );
    assertEquals(report.records[0].runnerStatus, "passed");
    assertEquals(report.diagnostics, []);
  });
  it("rejects a non-directory journal location and malformed testcase attributes", () =>
    temporary(async (directory) => {
      await Deno.writeTextFile(
        join(directory, "manifest.json"),
        JSON.stringify({ schemaVersion: 1, runId: "run", cwd: directory }),
      );
      await Deno.writeTextFile(join(directory, "fragments"), "not a directory");
      await assertRejects(
        () => aggregate(directory),
        Error,
        "ENOTDIR",
      );
      assertThrows(
        () =>
          reconcileJUnit(
            new Collector().report(),
            '<testsuites><testcase name="missing file"/></testsuites>',
            directory,
          ),
        RecorderError,
      );
    }));
});
