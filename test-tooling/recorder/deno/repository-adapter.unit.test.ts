import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { stub } from "@std/testing/mock";
import {
  recordColibriTests,
  recorder,
} from "colibri-internal/tests/recorder/suite.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("repository recording opt-in", () => {
  it("preserves values and errors without collecting when recording is disabled", async () => {
    using env = stub(Deno.env, "get", () => undefined);
    const { observer } = recordColibriTests("inactive.ts");
    const value = {};
    assertEquals(observer.file, "inactive.ts");
    assertStrictEquals(observer.create(() => value), value);
    assertStrictEquals(observer.capture(() => value), value);
    assertStrictEquals(observer.attach(value), value);
    const failure = new Error("test failure");
    assertStrictEquals(
      assertThrows(() =>
        observer.capture(() => {
          throw failure;
        })
      ),
      failure,
    );
    observer.log("ignored");
    await observer.flush();
    assertEquals(env.calls.length, 1);
  });
  it("works without environment permission and delegates only when explicitly enabled", () => {
    let enabled = false;
    using env = stub(Deno.env, "get", () => {
      if (!enabled) throw new Deno.errors.NotCapable("env denied");
      return "/recording";
    });
    const inactive = recordColibriTests("denied.ts");
    using recorded = stub(recorder, "recordTests", () => inactive);
    enabled = true;
    assertStrictEquals(recordColibriTests("enabled.ts"), inactive);
    assertEquals(recorded.calls[0].args, ["enabled.ts"]);
    assertEquals(env.calls.length, 2);
  });
});
