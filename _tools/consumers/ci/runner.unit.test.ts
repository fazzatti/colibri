import { stub } from "@std/testing/mock";
import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { type Check, compatibilityChecks } from "./plan.ts";
import { execute, runChecks, summarize } from "./runner.ts";

const resolutions = [
  { selection: "17.0.1", version: "17.0.1" },
  { selection: "^17.0.1", version: "17.0.1" },
];
const check = (id: string): Check => ({
  id,
  phase: "test",
  label: id,
  args: [],
  env: {},
  deno: "2.9.6",
});

describe("compatibility result reporting", () => {
  it("executes subprocess arguments and environment and preserves a nonzero exit", async () => {
    const result = await execute({
      ...check("process"),
      args: [
        "eval",
        'console.log(Deno.env.get("COMPATIBILITY_TEST_VALUE")); console.error("diagnostic"); Deno.exit(7);',
      ],
      env: { COMPATIBILITY_TEST_VALUE: "fixture" },
    });
    assertEquals(result.code, 7);
    assertStringIncludes(result.stdout, "fixture");
    assertStringIncludes(result.stderr, "diagnostic");
  });
  it("continues after failing or unlaunchable commands and retains each case's diagnostics", async () => {
    using _log = stub(console, "log");
    using _error = stub(console, "error");
    const directory = await Deno.makeTempDir();
    try {
      const calls: string[] = [];
      const checks = [check("failed"), check("unlaunchable"), check("passed")];
      const passed = await runChecks(checks, directory, (item) => {
        calls.push(item.id);
        if (item.id === "unlaunchable") throw new Error("could not start");
        return Promise.resolve({
          code: item.id === "failed" ? 5 : 0,
          stdout: item.id,
          stderr: "fixture diagnostic",
        });
      });
      assertEquals(passed, false);
      assertEquals(calls, ["failed", "unlaunchable", "passed"]);
      assertStringIncludes(
        await Deno.readTextFile(`${directory}/logs/failed.log`),
        "fixture diagnostic",
      );
      assertStringIncludes(
        await Deno.readTextFile(`${directory}/logs/unlaunchable.log`),
        "could not start",
      );
      const summary = await summarize(checks, resolutions, directory);
      assertEquals(summary.passed, false);
      assertStringIncludes(summary.markdown, "| failed | FAIL |");
      assertStringIncludes(summary.markdown, "| passed | PASS |");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("bounds concurrent cases and retains all results after asynchronous failures", async () => {
    using log = stub(console, "log");
    using _error = stub(console, "error");
    const directory = await Deno.makeTempDir();
    let active = 0;
    let peak = 0;
    const completed: string[] = [];
    const checks = ["first", "failed", "throws", "fourth", "last"].map(check);
    try {
      const passed = await runChecks(checks, directory, async (item) => {
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
        completed.push(item.id);
        if (item.id === "throws") throw new Error("asynchronous failure");
        return {
          code: item.id === "failed" ? 7 : 0,
          stdout: item.id,
          stderr: "",
        };
      }, 2);
      assertEquals(peak, 2);
      assertEquals(active, 0);
      assertEquals(passed, false);
      assertEquals(completed.sort(), checks.map((item) => item.id).sort());
      for (const item of checks) {
        const result = JSON.parse(
          await Deno.readTextFile(`${directory}/results/${item.id}.json`),
        );
        assertEquals(result.id, item.id);
        assertEquals(
          result.code,
          item.id === "failed" ? 7 : item.id === "throws" ? 1 : 0,
        );
        assertStringIncludes(
          await Deno.readTextFile(`${directory}/logs/${item.id}.log`),
          item.id === "throws" ? "asynchronous failure" : item.id,
        );
      }
      const groups = log.calls.map((call) => call.args[0]).filter((text) =>
        typeof text === "string" && text.startsWith("::")
      );
      assertEquals(groups.length, checks.length * 2);
      for (let i = 0; i < groups.length; i += 2) {
        assertStringIncludes(groups[i], "::group::");
        assertEquals(groups[i + 1], "::endgroup::");
      }
      assertEquals(
        (await summarize(checks, resolutions, directory)).passed,
        false,
      );
      assertEquals(await runChecks([], directory, undefined, 4), true);
      for (const concurrency of [0, -1, 1.5, NaN, Infinity]) {
        await assertRejects(
          () => runChecks(checks, directory, undefined, concurrency),
          Error,
          "positive integer",
        );
      }
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("fails the full matrix summary when any phase is missing, malformed or mismatched", async () => {
    using _log = stub(console, "log");
    using _error = stub(console, "error");
    const directory = await Deno.makeTempDir();
    try {
      const checks = compatibilityChecks(resolutions, directory);
      await runChecks(
        checks,
        directory,
        () => Promise.resolve({ code: 0, stdout: "ok", stderr: "" }),
      );
      assertEquals(
        (await summarize(checks, resolutions, directory)).passed,
        true,
      );
      const path = `${directory}/results/${checks[0].id}.json`;
      for (
        const content of [
          "not JSON",
          JSON.stringify({ id: "different", code: 0, seconds: 1 }),
          JSON.stringify({ id: checks[0].id, code: 0 }),
        ]
      ) {
        await Deno.writeTextFile(path, content);
        const result = await summarize(checks, resolutions, directory);
        assertEquals(result.passed, false);
        assertStringIncludes(
          result.markdown,
          `| ${checks[0].label} | MISSING |`,
        );
      }
      await Deno.remove(path);
      assertEquals(
        (await summarize(checks, resolutions, directory)).passed,
        false,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});

describe("compatibility CLI exit status", () => {
  it("fails missing or failed scenarios and publishes a complete summary only when every result passes", async () => {
    using _log = stub(console, "log");
    using _error = stub(console, "error");
    const directory = await Deno.makeTempDir();
    try {
      await Deno.writeTextFile(
        `${directory}/plan.json`,
        JSON.stringify(resolutions),
      );
      const invoke = (phase: string) =>
        new Deno.Command(Deno.execPath(), {
          args: [
            "run",
            "-A",
            new URL("./index.ts", import.meta.url).href,
            phase,
            directory,
          ],
          env: { GITHUB_STEP_SUMMARY: `${directory}/github-summary.md` },
        }).output();
      const missing = await invoke("summary");
      assertEquals(missing.success, false);
      assertStringIncludes(
        new TextDecoder().decode(missing.stdout),
        "MISSING",
        new TextDecoder().decode(missing.stderr),
      );
      assertStringIncludes(
        await Deno.readTextFile(`${directory}/summary.md`),
        "MISSING",
      );
      const checks = compatibilityChecks(resolutions, directory);
      await runChecks(
        checks,
        directory,
        () => Promise.resolve({ code: 0, stdout: "ok", stderr: "" }),
      );
      assertEquals((await invoke("summary")).success, true);
      assertStringIncludes(
        await Deno.readTextFile(`${directory}/github-summary.md`),
        "Consumer compatibility",
      );
      await Deno.writeTextFile(
        `${directory}/results/${checks[0].id}.json`,
        JSON.stringify({ id: checks[0].id, code: 9, seconds: 1 }),
      );
      assertEquals((await invoke("summary")).success, false);
      const mismatched = await invoke(
        Deno.version.deno === "2.9.6" ? "deno-2.7.11" : "deno-2.9.6",
      );
      assertEquals(mismatched.success, false);
      assertStringIncludes(
        new TextDecoder().decode(mismatched.stderr),
        "Runtime mismatch",
      );
      assertEquals((await invoke("unknown")).success, false);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
