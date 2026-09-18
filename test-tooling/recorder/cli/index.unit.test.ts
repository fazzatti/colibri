import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { join } from "node:path";
import { main } from "@/recorder/cli/index.ts";
import { runTests } from "@/recorder/cli/runner.ts";
import { RecorderError } from "@/recorder/error.ts";
import { stub } from "@std/testing/mock";

const { describe, it } = recordColibriTests(import.meta.url);

describe("recorder command", () => {
  it("rejects invalid configuration and preserves a successful memory-only test exit", async () => {
    const directory = await Deno.makeTempDir();
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
        await main(["run", `--config=${config}`, "--", "--no-check", test]),
        0,
      );
      assertEquals(log.calls.length, 1);
      using fail = stub(console, "error");
      // A failing report write still fails the command even after a successful child.
      using write = stub(
        Deno,
        "writeTextFile",
        (_path, _data, _options) =>
          Promise.reject(new TypeError("write failed")),
      );
      assertEquals(await runTests(config, [test]), 1);
      assertEquals(write.calls.length, 1);
      assertEquals(fail.calls.length, 1);
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
