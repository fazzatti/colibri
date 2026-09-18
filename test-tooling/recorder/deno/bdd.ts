import * as bdd from "@std/testing/bdd";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type { EvidenceRecord } from "@/recorder/types.ts";
import type { TestObserver } from "@/recorder/types.ts";
import type { DescribeArgs, ItArgs, TestSuite } from "@std/testing/bdd";

/** Familiar Deno BDD interface plus file-bound observation helpers. */
export interface RecordedTests {
  /** Register suites with the standard BDD semantics. */
  describe: RecordedDescribe;
  /** Register tests and automatically attribute their evidence. */
  it: RecordedIt;
  /** Record setup before a suite executes. */
  beforeAll: RecordedHook;
  /** Record teardown after a suite executes. */
  afterAll: RecordedHook;
  /** Record setup before each test. */
  beforeEach: RecordedHook;
  /** Record teardown after each test. */
  afterEach: RecordedHook;
  /** File-bound client, pipeline and caller observation helpers. */
  observer: TestObserver;
}
/** Test registration, including only/ignore/skip, with std/testing argument overloads. */
export interface RecordedIt {
  /** Register a test callback. */
  <T>(...args: ItArgs<T>): void;
  /** Register an exclusive test. */
  only<T>(...args: ItArgs<T>): void;
  /** Register an ignored test. */
  ignore<T>(...args: ItArgs<T>): void;
  /** Alias for ignore. */
  skip<T>(...args: ItArgs<T>): void;
}
/** Suite registration compatible with nested and flat std/testing suites. */
export interface RecordedDescribe {
  /** Register a suite. */
  <T>(...args: DescribeArgs<T>): TestSuite<T>;
  /** Register an exclusive suite. */
  only<T>(...args: DescribeArgs<T>): TestSuite<T>;
  /** Register an ignored suite. */
  ignore<T>(...args: DescribeArgs<T>): TestSuite<T>;
  /** Alias for ignore. */
  skip<T>(...args: DescribeArgs<T>): TestSuite<T>;
}
/** Register a setup or teardown callback, preserving the suite's this value. */
export type RecordedHook = <T>(
  callback: (this: T) => void | Promise<void>,
) => void;
type Callback = (this: unknown, ...args: unknown[]) => unknown;
type Register = (...args: unknown[]) => unknown;

/** Wrap execution only; registration and test semantics remain owned by std/testing. */
export function recordTests(
  collector: Collector,
  /** File-bound client, pipeline and caller observation helpers. */
  observer: TestObserver,
  registered: () => void,
): RecordedTests {
  let parent: EvidenceRecord | undefined;
  const suites = new WeakMap<object, EvidenceRecord>();
  const normalize = (
    args: unknown[],
  ): {
    args: unknown[];
    name: string;
    suite?: EvidenceRecord;
    ignored: boolean;
  } => {
    const first = args[0];
    const suite = typeof first === "object" && first !== null
      ? suites.get(first)
      : undefined;
    const values = suite ? args.slice(1) : args;
    const options = values.find((value) =>
      typeof value === "object" && value !== null
    ) as Record<string, unknown> | undefined;
    const callback =
      (values.find((value) => typeof value === "function") ?? options?.fn) as
        | Callback
        | undefined;
    return {
      args,
      name: String(
        values.find((value) => typeof value === "string") ?? options?.name ??
          callback?.name ?? "unnamed",
      ),
      suite: suite ??
        (options?.suite ? suites.get(options.suite as object) : parent),
      ignored: Boolean(options?.ignore),
    };
  };
  const execute = (record: EvidenceRecord, fn: Callback): Callback =>
    async function (...args) {
      const start = performance.now();
      record.status = "running";
      record.startedAt = new Date().toISOString();
      collector.guard(() => collector.emit(record));
      return await collector.context.run({
        file: observer.file,
        testId: record.id,
      }, async () => {
        try {
          const value = await fn.apply(this, args);
          record.status = "passed";
          return value;
        } catch (error) {
          record.status = "failed";
          collector.guard(() => {
            record.error = collector.safe(error);
          });
          throw error;
        } finally {
          collector.guard(() => {
            record.endedAt = new Date().toISOString();
            if (collector.options.profiling?.timings) {
              record.durationMs = performance.now() - start;
            }
            collector.emit(record);
          });
          await observer.flush();
        }
      });
    };
  const observedHook = (
    name: string,
    fn: Callback,
    suite?: EvidenceRecord,
  ): Callback =>
    function () {
      const record = collector.record("hook", name, { file: observer.file });
      record.parentId = suite?.id;
      record.path = [...(suite?.path ?? []), name];
      return execute(record, fn).call(this);
    };
  const mapOptions = (
    value: Record<string, unknown>,
    wrap: (fn: Callback) => Callback,
    record: EvidenceRecord,
  ): Record<string, unknown> => {
    const options = { ...value };
    if (typeof options.fn === "function") {
      options.fn = wrap(options.fn as Callback);
    }
    for (const name of ["beforeAll", "afterAll", "beforeEach", "afterEach"]) {
      const callbacks = options[name];
      if (typeof callbacks === "function") {
        options[name] = observedHook(name, callbacks as Callback, record);
      }
      if (Array.isArray(callbacks)) {
        options[name] = callbacks.map((fn) => observedHook(name, fn, record));
      }
    }
    return options;
  };
  const registration =
    (kind: "suite" | "test", register: Register, ignored = false): Register =>
    (...args) => {
      const info = normalize(args);
      const record = collector.record(kind, info.name, { file: observer.file });
      record.parentId = info.suite?.id;
      record.path = [...(info.suite?.path ?? []), info.name];
      record.status = ignored || info.ignored ? "skipped" : "registered";
      collector.guard(() => collector.emit(record));
      const wrap = (fn: Callback): Callback => {
        const wrapped = kind === "test"
          ? execute(record, fn)
          : function (this: unknown, ...params: unknown[]) {
            const previous = parent;
            parent = record;
            try {
              return fn.apply(this, params);
            } finally {
              parent = previous;
            }
          };
        // std/testing uses callback names in its unnamed overloads. Wrapping
        // must preserve those names so runner results and evidence agree.
        Object.defineProperty(wrapped, "name", {
          value: fn.name,
          configurable: true,
        });
        return wrapped;
      };
      const mapped = args.map((value) => {
        if (typeof value === "function") return wrap(value as Callback);
        if (typeof value !== "object" || value === null || suites.has(value)) {
          return value;
        }
        return mapOptions(value as Record<string, unknown>, wrap, record);
      });
      const suite = register(...mapped);
      registered();
      if (kind === "suite" && suite && typeof suite === "object") {
        suites.set(suite, record);
      }
      return suite;
    };
  const make = (
    kind: "suite" | "test",
    original: typeof bdd.describe | typeof bdd.it,
  ): typeof bdd.it & typeof bdd.describe => {
    const fn = registration(kind, original as unknown as Register);
    return Object.assign(fn, {
      only: registration(kind, original.only as Register),
      ignore: registration(kind, original.ignore as Register, true),
      skip: registration(kind, original.skip as Register, true),
    }) as typeof bdd.it & typeof bdd.describe;
  };
  const hook = (
    name: "beforeAll" | "afterAll" | "beforeEach" | "afterEach",
  ): typeof bdd.beforeAll =>
  (fn) => {
    bdd[name](
      observedHook(name, fn as Callback, parent) as (
        this: unknown,
      ) => Promise<void>,
    );
  };
  return {
    describe: make("suite", bdd.describe),
    it: make("test", bdd.it),
    beforeAll: hook("beforeAll"),
    afterAll: hook("afterAll"),
    beforeEach: hook("beforeEach"),
    afterEach: hook("afterEach"),
    observer,
  };
}
