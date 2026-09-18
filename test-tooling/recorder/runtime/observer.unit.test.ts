import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { createRunContext, pipe, plugin, step } from "convee";
import { ExecutionRecorder } from "@/recorder/index.ts";
import { Collector } from "@/recorder/runtime/collector.ts";
import { Observer } from "@/recorder/runtime/observer.ts";
import { RecorderError } from "@/recorder/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("execution recording", () => {
  it("observes the existing pipeline without changing values or identity", async () => {
    const recorder = new ExecutionRecorder({
      capture: "trace",
      profiling: { timings: true },
    });
    const observer = recorder.observer("client.test.ts");
    const output = { balance: 9n };
    const pipeline = pipe([step(() => output, { id: "balance" })], {
      id: "ReadFromContractPipeline",
    });
    const client = observer.create(() => ({ readPipe: pipeline }));
    assertStrictEquals(client.readPipe, pipeline);
    recorder.observer("other.ts").attach(pipeline);
    assertStrictEquals(await pipeline(), output);
    const report = recorder.report();
    const executions = report.records.filter((r) => r.execution);
    assertEquals(executions.length, 1);
    assertEquals(executions[0].status, "passed");
    assertEquals(executions[0].execution?.kind, "read");
    assertEquals(executions[0].execution?.stages[0].status, "passed");
    assert(executions[0].durationMs! >= 0);
    assertEquals(executions[0].data, {
      input: { parameters: null, metadata: null },
      result: { balance: "9" },
    });
    report.records.length = 0;
    assert(recorder.report().records.length > 0);
  });
  it("observes public contract wrappers without replacing their identity", async () => {
    const recorder = new ExecutionRecorder();
    const pipeline = pipe([step(() => 17)], { id: "ReadFromContractPipeline" });
    const wrapper = { contract: { readPipe: pipeline } };
    assertStrictEquals(recorder.observer().attach(wrapper), wrapper);
    assertEquals(await wrapper.contract.readPipe(), 17);
    assertEquals(
      recorder.report().records.filter((r) => r.execution).length,
      1,
    );
  });
  it("preserves synchronous construction errors and expected async rejections", async () => {
    const recorder = new ExecutionRecorder();
    const observer = recorder.observer();
    const error = new TypeError("expected");
    assertStrictEquals(
      assertThrows(() =>
        observer.create(() => {
          throw error;
        })
      ),
      error,
    );
    assertStrictEquals(
      await assertRejects(() => observer.capture(() => Promise.reject(error))),
      error,
    );
    assertEquals(observer.capture(() => 42), 42);
    const target = {};
    assertStrictEquals(
      await observer.create(() => Promise.resolve(target)),
      target,
    );
    assertEquals(recorder.report().records.map((r) => r.status), [
      "failed",
      "failed",
      "passed",
      "passed",
    ]);
    assertEquals(recorder.report().diagnostics.length, 1);
  });
  it("does not recover a pipeline error and keeps recovered outputs distinct", async () => {
    const error = new TypeError("boom");
    const recorder = new ExecutionRecorder();
    const failed = pipe([step(() => {
      throw error;
    }, { id: "throws" })]);
    recorder.observer().attach(failed);
    assertStrictEquals(await assertRejects(() => failed()), error);
    const recover = pipe([step((): string => {
      throw error;
    })]);
    recover.use(plugin().onError(() => "recovered"));
    recorder.observer().attach(recover);
    assertEquals(await recover(), "recovered");
    assertEquals(recorder.report().records.map((r) => r.status), [
      "failed",
      "passed",
    ]);
  });
  it("attributes concurrent calls without a shared mutable current test", async () => {
    const collector = new Collector({ capture: "results" });
    const observer = new Observer(collector, "tests.ts");
    const pipeline = pipe([step(async (value: string) => {
      await Promise.resolve();
      return value;
    })]);
    observer.attach(pipeline);
    await Promise.all(
      ["one", "two"].map((testId) =>
        collector.context.run(
          { file: "tests.ts", testId },
          () => observer.capture(() => pipeline(testId)),
        )
      ),
    );
    assertEquals(
      collector.report().records.filter((r) => r.execution).map((r) => r.testId)
        .sort(),
      ["one", "two"],
    );
    assert(
      collector.report().records.filter((r) => r.execution).every((r) =>
        r.callId
      ),
    );
  });
  it("keeps sanitizer failures and record truncation out of application behavior", async () => {
    const recorder = new ExecutionRecorder({
      sanitize: () => {
        throw new TypeError("redactor failed");
      },
    });
    const observer = recorder.observer();
    assertEquals(observer.capture(() => "ok"), "ok");
    observer.log("log", { data: 1 });
    assertEquals(recorder.report().diagnostics, [
      "Observation failed: redactor failed",
    ]);
    const small = new ExecutionRecorder({
      limits: { records: 1 },
      capture: "summary",
    });
    small.observer().log("one");
    small.observer().log("two");
    small.observer().log("three");
    assertEquals(small.report().records.length, 1);
    assertEquals(small.report().diagnostics.length, 1);
    await small.observer().flush();
    assertThrows(
      () => new ExecutionRecorder({ limits: { records: 0 } }),
      RecorderError,
    );
  });
  it("does not corrupt execution when observation fails before root registration", async () => {
    const recorder = new ExecutionRecorder({
      capture: "trace",
      sanitize: () => {
        throw new TypeError("snapshot failed");
      },
    });
    const succeeds = pipe([step(() => 42)]);
    recorder.observer().attach(succeeds);
    assertEquals(await succeeds(), 42);
    const original = new TypeError("original");
    const fails = pipe([step(() => {
      throw original;
    })]);
    recorder.observer().attach(fails);
    assertStrictEquals(await assertRejects(() => fails()), original);
    assert(
      recorder.report().diagnostics.some((d) => d.includes("snapshot failed")),
    );
  });
  it("marks an outcome unknown if an earlier error hook prevents observing it", async () => {
    const recorder = new ExecutionRecorder();
    const pipeline = pipe([step(() => {
      throw new TypeError("body");
    })]);
    const original = new TypeError("error hook");
    pipeline.use(
      plugin().onError(() => {
        throw original;
      }),
    );
    recorder.observer().attach(pipeline);
    assertStrictEquals(await assertRejects(() => pipeline()), original);
    assertEquals(recorder.report().records[0].status, "unknown");
  });
  it("diagnoses overlapping shared parent contexts instead of mixing stage evidence", async () => {
    const recorder = new ExecutionRecorder({ profiling: { timings: true } });
    const pipeline = pipe([step(async (value: string) => {
      await Promise.resolve();
      return value;
    })]);
    recorder.observer().attach(pipeline);
    const parent = createRunContext();
    const values = await Promise.all([
      pipeline.runWith({ context: { parent } }, "one"),
      pipeline.runWith({ context: { parent } }, "two"),
    ]);
    assertEquals(values, ["one", "two"]);
    assertEquals(recorder.report().records.length, 2);
    assert(
      recorder.report().diagnostics.some((d) => d.includes("Convee contexts")),
    );
  });
});
