import * as bdd from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type { EvidenceRecord, TestObserver } from "@/recorder/types.ts";

/** Node's native test overloads, with the same ignore alias as the Deno adapter. */
export type RecordedIt = typeof bdd.it & {
  /** Alias for skip. */ ignore: typeof bdd.it.skip;
};
/** Node's native suite overloads, including asynchronous suite registration. */
export type RecordedDescribe = typeof bdd.describe & {
  /** Alias for skip. */ ignore: typeof bdd.describe.skip;
};
/** Native hook callback and timeout options. */
export type RecordedHook = typeof bdd.before;
/** Native Node BDD helpers plus the same observer API as the Deno adapter. */
export interface RecordedTests {
  /** Register suites with node:test semantics. */
  describe: RecordedDescribe;
  /** Register and observe tests. */
  it: RecordedIt;
  /** Record setup before a suite. */
  beforeAll: RecordedHook;
  /** Record teardown after a suite. */
  afterAll: RecordedHook;
  /** Record setup before each test. */
  beforeEach: RecordedHook;
  /** Record teardown after each test. */
  afterEach: RecordedHook;
  /** Native alias for beforeAll. */
  before: RecordedHook;
  /** Native alias for afterAll. */
  after: RecordedHook;
  /** File-bound observation helpers. */
  observer: TestObserver;
}
type Callback = (this: unknown, ...args: unknown[]) => unknown;
type Register = (...args: unknown[]) => unknown;

/** Record callback outcomes without replacing Node's final runner outcomes. */
function observed(
  collector: Collector,
  observer: TestObserver,
  record: EvidenceRecord,
  fn: Callback,
): Callback {
  const begin = () => {
    record.status = "running";
    record.startedAt = new Date().toISOString();
    collector.guard(() => collector.emit(record));
    return performance.now();
  };
  const end = (start: number, error?: unknown, failed = Boolean(error)) => {
    collector.guard(() => {
      record.status = failed ? "failed" : "passed";
      if (failed) record.error = collector.safe(error);
      record.endedAt = new Date().toISOString();
      if (collector.options.profiling?.timings) {
        record.durationMs = performance.now() - start;
      }
      collector.emit(record);
    });
    return observer.flush();
  };
  const attribution = { file: observer.file, testId: record.id };
  // Preserve callback arity: Node uses it to decide whether to provide done().
  if (fn.length > 1) {
    return function (context, done) {
      const start = begin();
      return collector.context.run(attribution, () => {
        try {
          return fn.call(this, context, (error?: unknown) => {
            void end(start, error).then(() =>
              (done as (error?: unknown) => void)(error)
            );
          });
        } catch (error) {
          void end(start, error, true);
          throw error;
        }
      });
    };
  }
  return async function (...args) {
    const start = begin();
    return await collector.context.run(attribution, async () => {
      try {
        const value = await fn.apply(this, args);
        await end(start);
        return value;
      } catch (error) {
        await end(start, error, true);
        throw error;
      }
    });
  };
}

/** Keep registration and scheduling owned by the native Node test runner. */
export function recordTests(
  collector: Collector,
  observer: TestObserver,
  registered: () => void,
  runner: Pick<
    typeof bdd,
    "describe" | "it" | "before" | "after" | "beforeEach" | "afterEach"
  > = bdd,
): RecordedTests {
  const parents = new AsyncLocalStorage<EvidenceRecord>();
  const register =
    (kind: "suite" | "test", original: Register, skipped = false): Register =>
    (...args) => {
      const fn = args.find((v) => typeof v === "function") as
        | Callback
        | undefined;
      const options = args.find((v) => typeof v === "object" && v !== null) as
        | bdd.TestOptions
        | undefined;
      const name = String(
        args.find((v) => typeof v === "string") ?? fn?.name ?? "<anonymous>",
      );
      const parent = parents.getStore();
      const record = collector.record(kind, name, { file: observer.file });
      record.parentId = parent?.id;
      record.path = [...(parent?.path ?? []), name];
      record.status = skipped || options?.skip ? "skipped" : "registered";
      collector.guard(() => collector.emit(record));
      registered();
      const wrap = (callback: Callback): Callback =>
        kind === "test"
          ? observed(collector, observer, record, callback)
          : function (...params) {
            return parents.run(record, () => callback.apply(this, params));
          };
      return original(
        ...args.map((value) =>
          typeof value === "function" ? wrap(value as Callback) : value
        ),
      );
    };
  const make = (
    kind: "suite" | "test",
    original: typeof bdd.it | typeof bdd.describe,
  ) =>
    Object.assign(
      register(kind, original as Register),
      {
        only: register(kind, original.only as Register),
        skip: register(kind, original.skip as Register, true),
        ignore: register(kind, original.skip as Register, true),
        todo: register(kind, original.todo as Register),
      },
    );
  const hook =
    (name: string, original: typeof bdd.before): RecordedHook =>
    (fn, options) => {
      if (!fn) {
        original(fn, options);
        return;
      }
      const parent = parents.getStore();
      const callback: Callback = function (...args) {
        const record = collector.record("hook", name, { file: observer.file });
        record.parentId = parent?.id;
        record.path = [...(parent?.path ?? []), name];
        return observed(collector, observer, record, fn as Callback).apply(
          this,
          args,
        );
      };
      // Hooks, like tests, may use either promises or a completion callback.
      const wrapped = fn.length > 1
        ? function (this: unknown, context: unknown, done: unknown) {
          return callback.call(this, context, done);
        }
        : callback;
      original(wrapped as Parameters<typeof bdd.before>[0], options);
    };
  const beforeAll = hook("beforeAll", runner.before),
    afterAll = hook("afterAll", runner.after);
  return {
    describe: make("suite", runner.describe) as RecordedDescribe,
    it: make("test", runner.it) as RecordedIt,
    beforeAll,
    afterAll,
    before: beforeAll,
    after: afterAll,
    beforeEach: hook("beforeEach", runner.beforeEach),
    afterEach: hook("afterEach", runner.afterEach),
    observer,
  };
}
