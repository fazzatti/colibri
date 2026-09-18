import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { join } from "node:path";
import { main } from "@/recorder/cli/index.ts";
import { runTests } from "@/recorder/cli/runner.ts";
import { RecorderError } from "@/recorder/error.ts";
import { EventEmitter } from "node:events";
import childProcess from "node:child_process";
import process from "node:process";
import { stub } from "@std/testing/mock";

const { describe, it } = recordColibriTests(import.meta.url);

describe("recorder command", () => {
  it("rejects invalid configuration and preserves a successful memory-only test exit", async () => {
    const directory = await Deno.makeTempDir();
    const output: string[] = [];
    const spawn = childProcess.spawn;
    // Exercise the real native runner, but retain its deliberately empty test
    // output here. Production CLI output remains inherited and visible.
    using _childOutput = stub(
      childProcess,
      "spawn",
      ((command, args, options) => {
        const child = spawn(command, args, { ...options, stdio: "pipe" });
        child.stdin.end();
        child.stdout.on("data", (chunk) => output.push(String(chunk)));
        child.stderr.on("data", (chunk) => output.push(String(chunk)));
        return child;
      }) as typeof childProcess.spawn,
    );
    try {
      const invalid = join(directory, "invalid.ts");
      await Deno.writeTextFile(invalid, "export const recorder = {};");
      await assertRejects(() => runTests(invalid, []), RecorderError);
      const config = join(directory, "recording.ts");
      await Deno.writeTextFile(
        config,
        "export const recorder = {options:{output:{summary:true}}};",
      );
      await assertRejects(() => main(["run"]), RecorderError);
      await assertRejects(
        () => runTests(config, ["--junit-path=other.xml"]),
        RecorderError,
      );
      const test = join(directory, "empty.test.ts");
      await Deno.writeTextFile(test, "export {};");
      using log = stub(console, "log");
      assertEquals(
        await main([
          "run",
          `--config=${config}`,
          "--",
          "--no-check",
          "--quiet",
          test,
        ]),
        0,
      );
      assertEquals(log.calls.length, 1);
      using fail = stub(console, "error");
      // A child can pass and still leave an unwritable report destination.
      await Deno.writeTextFile(
        test,
        `const dir=Deno.env.get("COLIBRI_RECORDER_DIRECTORY"); await Deno.mkdir(dir+"/report.json");`,
      );
      assertEquals(await runTests(config, ["-A", "--quiet", test]), 1);
      assertEquals(fail.calls.length, 1);
      await Deno.writeTextFile(
        test,
        `const dir=Deno.env.get("COLIBRI_RECORDER_DIRECTORY"); await Deno.mkdir(dir+"/report.json"); Deno.exit(7);`,
      );
      assertEquals(await runTests(config, ["-A", "--quiet", test]), 7);
      assertEquals(fail.calls.length, 2);
    } catch (cause) {
      throw new Error("Recorder child output:\n" + output.join(""), { cause });
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("retains JSON or HTML and reports interrupted or unlaunchable runners", async () => {
    const directory = await Deno.makeTempDir();
    const previous = Deno.cwd();
    // Deno's parallel workers share the OS cwd. Stub this worker's Node API
    // instead, so another worker cannot inherit a directory we later remove.
    using _cwd = stub(process, "cwd", () => directory);
    let outcome: number | null | Error = 0;
    using log = stub(console, "log");
    using fail = stub(console, "error");
    // Model native process boundaries that ordinary successful subprocesses
    // cannot exercise deterministically: launch failure and signal termination.
    using spawn = stub(
      childProcess,
      "spawn",
      ((_command, args, options) => {
        assertEquals(options?.stdio, "inherit");
        const child = new EventEmitter();
        queueMicrotask(() => {
          if (outcome instanceof Error) child.emit("error", outcome);
          else child.emit("close", outcome);
        });
        assertEquals(args?.[0], "test");
        return child;
      }) as typeof childProcess.spawn,
    );
    try {
      for (
        const output of [
          { html: true },
          { json: { directory: "json" } },
          undefined,
        ]
      ) {
        const config = join(directory, crypto.randomUUID() + ".ts");
        await Deno.writeTextFile(
          config,
          "export const recorder=" + JSON.stringify({ options: { output } }) +
            ";",
        );
        assertEquals(await main(["run", "--config=" + config]), 0);
      }
      assertEquals(log.calls.length, 2);
      assertStringIncludes(log.calls[0].args[0], "report.html");
      assertStringIncludes(log.calls[1].args[0], "report.json");
      assertStringIncludes(
        log.calls[0].args[0],
        join(directory, "artifacts", "colibri"),
      );
      assertStringIncludes(log.calls[1].args[0], join(directory, "json"));
      assertEquals(Deno.cwd(), previous);
      const config = join(directory, "interrupted.ts");
      await Deno.writeTextFile(config, "export const recorder={options:{}};");
      outcome = null;
      assertEquals(await runTests(config, []), 1);
      outcome = new Error("spawn denied");
      assertEquals(await runTests(config, []), 1);
      assertEquals(fail.calls.length, 1);
      assertEquals(fail.calls[0].args[1], outcome);
      assertEquals(spawn.calls.length, 5);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("returns a nonzero CLI status for invalid arguments", async () => {
    const command = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", new URL("./index.ts", import.meta.url).pathname],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(command.code, 1);
    assertStringIncludes(
      new TextDecoder().decode(command.stderr),
      "Usage: recorder",
    );
  });
});
