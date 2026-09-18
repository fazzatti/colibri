import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Collector } from "@/recorder/runtime/collector.ts";
import { Observer } from "@/recorder/runtime/observer.ts";
import { recordTests } from "@/recorder/node/bdd.ts";
import { TestRecorder } from "@/recorder/node/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
type Callback = (this: unknown, ...args: unknown[]) => unknown;
function setup(timings = true) {
  const c = new Collector({ profiling: { timings } });
  const observer = new Observer(c, "file.mjs");
  const calls: { kind: string; args: unknown[] }[] = [];
  const register = (kind: string) => (...args: unknown[]) => {
    calls.push({ kind, args });
    return "native return";
  };
  const registration = (kind: string) =>
    Object.assign(register(kind), {
      only: register(kind + ".only"),
      skip: register(kind + ".skip"),
      todo: register(kind + ".todo"),
    });
  const runner = {
    describe: registration("suite"),
    it: registration("test"),
    before: register("before"),
    after: register("after"),
    beforeEach: register("beforeEach"),
    afterEach: register("afterEach"),
  };
  let registered = 0;
  const api = recordTests(
    c,
    observer,
    () => registered++,
    runner as unknown as Parameters<typeof recordTests>[3],
  );
  const callback = (index: number) =>
    calls[index].args.find((v) => typeof v === "function") as Callback;
  return { c, observer, calls, api, callback, registered: () => registered };
}
describe("Node BDD observation boundaries", () => {
  it("preserves native arguments, return values and callback attribution during overlapping calls", async () => {
    const s = setup(), opts = { concurrency: true };
    let callbackThis: unknown, callbackContext: unknown;
    assertEquals(
      s.api.describe("suite", opts, () => {
        s.api.it("one", async function (this: unknown, context) {
          // Native Node test callbacks return void; observe the receiver and
          // context separately to verify that the adapter forwards them.
          callbackThis = this;
          callbackContext = context;
          s.observer.log("one start");
          await Promise.resolve();
          s.observer.log("one end");
        });
        s.api.it("two", () => {
          s.observer.log("two");
        });
      }) as unknown,
      "native return",
    );
    assertStrictEquals(s.calls[0].args[1], opts);
    await s.callback(0)();
    const receiver = { identity: 1 }, context = { name: "one" };
    const [one, two] = await Promise.all([
      s.callback(1).call(receiver, context),
      s.callback(2)(),
    ]);
    assertStrictEquals(callbackThis, receiver);
    assertStrictEquals(callbackContext, context);
    assertEquals([one, two], [undefined, undefined]);
    const records = s.c.report().records,
      tests = records.filter((r) => r.kind === "test");
    assertEquals(tests.map((r) => r.path), [["suite", "one"], [
      "suite",
      "two",
    ]]);
    for (const r of records.filter((r) => r.kind === "log")) {
      assertEquals(
        tests.find((t) => t.id === r.testId)?.name,
        r.name.split(" ")[0],
      );
    }
    assertEquals(s.registered(), 3);
  });
  it("records hook callbacks separately and preserves completion-style behavior and options", async () => {
    const s = setup(false), options = { timeout: 100 };
    s.api.beforeAll(function () {
      s.observer.log("setup");
    }, options);
    s.api.afterEach((_ctx, done) => {
      s.observer.log("cleanup");
      done();
    }, options);
    assertStrictEquals(s.calls[0].args[1], options);
    await s.callback(0)();
    assertEquals(s.callback(1).length, 2);
    await new Promise<void>((resolve) => s.callback(1)({}, resolve));
    const hooks = s.c.report().records.filter((r) => r.kind === "hook");
    assertEquals(hooks.map((r) => r.status), ["passed", "passed"]);
    assert(hooks.every((r) => r.durationMs === undefined));
    assertStrictEquals(s.api.before, s.api.beforeAll);
    assertStrictEquals(s.api.after, s.api.afterAll);
    s.api.beforeAll();
    assertEquals(s.calls.at(-1)?.args, [undefined, undefined]);
  });
  it("preserves error identity, falsy throws and callback throws/rejections", async () => {
    const s = setup(), error = new TypeError("expected");
    s.api.it("throws", () => {
      throw error;
    });
    assertStrictEquals(
      await assertRejects(() => Promise.resolve(s.callback(0)())),
      error,
    );
    s.api.it("falsy", () => {
      throw undefined;
    });
    try {
      await s.callback(1)();
      throw Error("must fail");
    } catch (e) {
      assertEquals(e, undefined);
    }
    s.api.it("callback throws", (_ctx, _done) => {
      throw error;
    });
    assertStrictEquals(assertThrows(() => s.callback(2)({}, () => {})), error);
    s.api.it("callback rejects", (_ctx, done) => done(error));
    const returned = await new Promise((resolve) => s.callback(3)({}, resolve));
    assertStrictEquals(returned, error);
    assert(s.c.report().records.every((r) => r.status === "failed"));
  });
  it("forwards only, skip, ignore, todo, unnamed tests and suite hook ancestry", async () => {
    const s = setup();
    s.api.describe.only("exclusive", () => {
      s.api.beforeEach(() => {});
    });
    await s.callback(0)();
    await s.callback(1)();
    s.api.describe.skip("skipped", () => {});
    s.api.describe.ignore("ignored", () => {});
    s.api.describe.todo("future", () => {});
    s.api.it.only("only", () => {});
    s.api.it.skip("skip", () => {});
    s.api.it.ignore("ignore", () => {});
    s.api.it.todo("todo");
    s.api.it({ skip: true }, function named() {});
    s.api.it();
    const records = s.c.report().records;
    assertEquals(records.find((r) => r.kind === "hook")?.path, [
      "exclusive",
      "beforeEach",
    ]);
    assertEquals(records.filter((r) => r.status === "skipped").length, 5);
    assert(records.some((r) => r.name === "named"));
    assertEquals(records.at(-1)?.name, "<anonymous>");
  });
  it("reuses file observers, creates defensive snapshots and flushes configured Node journals", async () => {
    const directory = await Deno.makeTempDir(),
      old = Deno.env.get("COLIBRI_RECORDER_DIRECTORY");
    Deno.env.delete("COLIBRI_RECORDER_DIRECTORY");
    try {
      const memory = new TestRecorder();
      await memory.flush();
      assertEquals(memory.directory, undefined);
      const recorder = new TestRecorder({ output: { json: { directory } } });
      const a = recorder.recordTests("file.mjs");
      assertStrictEquals(a, recorder.recordTests("file.mjs"));
      a.observer.log("hello");
      await recorder.flush();
      const snapshot = recorder.report();
      snapshot.records.length = 0;
      assertEquals(recorder.report().records.length, 1);
      assertEquals(
        Array.from(Deno.readDirSync(recorder.directory + "/fragments")).length,
        1,
      );
    } finally {
      if (old) Deno.env.set("COLIBRI_RECORDER_DIRECTORY", old);
      await Deno.remove(directory, { recursive: true });
    }
  });
});
