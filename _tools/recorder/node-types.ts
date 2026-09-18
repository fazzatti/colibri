/** Compile the installed Node recorder's BDD API with each supported TypeScript version. */
import { TestRecorder } from "@colibri/test-tooling/recorder/node";
import type { describe as nativeDescribe, it as nativeIt } from "node:test";

const recorder = new TestRecorder({
  capture: "details",
  profiling: { timings: true, resources: true, fees: true },
  events: "full",
  output: { json: { directory: "./evidence" }, html: true },
});
const { describe, it, beforeAll, afterAll, observer } = recorder.recordTests(
  import.meta.url,
);
const test: typeof nativeIt = it;
const suite: typeof nativeDescribe = describe;
suite("native overloads", { concurrency: true }, async (context) => {
  const name: string = context.name;
  beforeAll((context) => observer.log(context.name), { timeout: 1000 });
  afterAll((_context, done) => done());
  test(name, async (context) => {
    const value: number = await observer.capture(async () => 7);
    observer.log(context.name, { value });
  });
  it("callback", { timeout: 1000 }, (_context, done) => done());
  it.skip("skipped", () => {});
  it.ignore("ignored", () => {});
  it.todo("todo");
});
