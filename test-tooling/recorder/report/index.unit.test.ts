import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  mergeFragments,
  profileGroups,
  renderReport,
  statistics,
  summarize,
} from "@/recorder/report/index.ts";
import { Collector } from "@/recorder/runtime/collector.ts";
import { reconcileJUnit } from "@/recorder/artifacts/deno-results.ts";
import { RecorderError } from "@/recorder/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("portable reports", () => {
  it("merges updates, preserves truncation evidence and rejects mixed runs", () => {
    const c = new Collector({}, "run");
    c.journalEnabled = true;
    const record = c.record("call", "one", { file: "test.ts" });
    c.emit(record);
    record.status = "passed";
    c.emit(record);
    c.diagnostic("warning");
    c.diagnostic("warning");
    const journal = c.pending.map((e) => JSON.stringify(e)).join("\n") + "\n";
    const report = mergeFragments("run", [journal]);
    assertEquals(report.records.length, 1);
    assertEquals(report.records[0].status, "passed");
    assertEquals(report.diagnostics, ["warning"]);
    assertStringIncludes(
      mergeFragments("run", [journal + '{"partial"']).diagnostics.join(),
      "Truncated",
    );
    assertThrows(() => mergeFragments("other", [journal]), RecorderError);
    assertThrows(
      () => mergeFragments("run", [journal, journal]),
      RecorderError,
    );
    assertThrows(() => mergeFragments("run", ["bad\nmore\n"]), RecorderError);
  });
  it("calculates variance and percentiles over available comparable samples", () => {
    assertEquals(statistics([]), undefined);
    assertEquals(statistics([1, 2, 3, NaN]), {
      count: 3,
      min: 1,
      max: 3,
      mean: 2,
      p50: 2,
      p95: 3,
      variance: 2 / 3,
      standardDeviation: Math.sqrt(2 / 3),
    });
    const c = new Collector();
    // Test and log records must not inflate transaction sample counts.
    c.emit(c.record("test", "owner", { file: "test.ts" }));
    c.emit(c.record("log", "setup", { file: "test.ts" }));
    assertEquals(profileGroups(c.report()), []);
    const record = c.record("execution", "read", { file: "test.ts" });
    record.durationMs = 10;
    record.execution = {
      kind: "read",
      network: "testnet",
      method: "balance",
      operations: [],
      chain: "not-submitted",
      stages: [],
      simulations: [{
        stage: "simulate",
        instructions: 100,
        diskReadBytes: 20,
        writeBytes: 0,
      }],
    };
    c.emit(record);
    const group = profileGroups(c.report())[0];
    assertEquals(group.executions, 1);
    assertEquals(group.instructions?.mean, 100);
    assertEquals(group.durationMs?.mean, 10);
    record.durationMs = undefined;
    c.emit(record);
    assertEquals(profileGroups(c.report())[0].durationMs, undefined);
    assertEquals(summarize(c.report()).unknown, 1);
  });
  it("uses runner statuses for leaf counts and keeps callback failures separate", () => {
    const c = new Collector();
    const suite = c.record("suite", "Token", { file: "file:///tmp/tests.ts" });
    suite.path = ["Token"];
    c.emit(suite);
    const test = c.record("test", "fails", { file: "file:///tmp/tests.ts" });
    test.path = ["Token", "fails"];
    test.status = "passed";
    c.emit(test);
    const report = c.report();
    reconcileJUnit(
      report,
      '<testsuites><testcase classname="tests.ts" name="Token"><failure>child failed</failure></testcase><testcase classname="tests.ts" name="Token &gt; fails"><failure>sanitizer</failure></testcase></testsuites>',
      "/tmp",
    );
    assertEquals(summarize(report).failed, 1);
    assertEquals(report.records[1].status, "passed");
    const missing = c.record("test", "missing", { file: "/tmp/tests.ts" });
    c.emit(missing);
    const incomplete = c.report();
    reconcileJUnit(incomplete, "<testsuites></testsuites>", "/tmp");
    assertEquals(summarize(incomplete).unknown, 2);
    assertThrows(
      () => reconcileJUnit(report, "not xml", "/tmp"),
      RecorderError,
    );
  });
  it("embeds hostile evidence without closing the JSON script element", () => {
    const c = new Collector();
    c.emit(
      c.record("log", "</script><script>globalThis.pwned=true</script>", {
        file: "test.ts",
      }),
    );
    const html = renderReport(c.report());
    assert(!html.includes("<script>globalThis.pwned"));
    assertStringIncludes(html, "\\u003c/script>");
    assertStringIncludes(html, "default-src 'none'");
  });
});
