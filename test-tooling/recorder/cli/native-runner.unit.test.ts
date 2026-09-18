import { assert, assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  cleanupReporter,
  nativeArguments,
  prepareNodeReporter,
} from "@/recorder/cli/native-runner.ts";
const { describe, it } = recordColibriTests(import.meta.url);
describe("native runner protocol", () => {
  it("retains native arguments while reserving both result destinations", () => {
    const args = ["--test-concurrency=2", "one.test.mjs"];
    const node = nativeArguments("node", args, "/tmp/run");
    assert(node.includes("--test"));
    assert(node.includes("--test-reporter=spec"));
    assert(node.some((v) => v.endsWith("runner.node.jsonl")));
    assertEquals(node.slice(-2), args);
    assertEquals(nativeArguments("deno", ["-A", "one.test.ts"], "/tmp/run"), [
      "test",
      "--junit-path=/tmp/run/runner.junit.xml",
      "-A",
      "one.test.ts",
    ]);
    for (
      const flag of [
        "--test-reporter=tap",
        "--test-reporter-destination=stdout",
        "--test-isolation=none",
        "--watch",
      ]
    ) assertThrows(() => nativeArguments("node", [flag], "/tmp/run"));
    assertThrows(() =>
      nativeArguments("deno", ["--junit-path=other.xml"], "/tmp/run")
    );
  });
  it("creates a directly loadable reporter adapter and cleans up only that adapter", async () => {
    const directory = await Deno.makeTempDir();
    try {
      await prepareNodeReporter(directory);
      const reporter = await import(
        new URL("file://" + directory + "/reporter.mjs").href
      );
      assertEquals(typeof reporter.default, "function");
      await Deno.writeTextFile(directory + "/report.json", "{}");
      await cleanupReporter(directory);
      await cleanupReporter(directory);
      assertEquals(Array.from(Deno.readDirSync(directory), (e) => e.name), [
        "report.json",
      ]);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
