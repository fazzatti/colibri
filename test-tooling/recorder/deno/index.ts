/**
 * @module
 * Deno BDD recording and per-runtime artifact journals.
 */
import { join } from "node:path";
import { Collector } from "@/recorder/runtime/collector.ts";
import { Observer } from "@/recorder/runtime/observer.ts";
import { type RecordedTests, recordTests } from "@/recorder/deno/bdd.ts";
import { environment, Journal } from "@/recorder/deno/journal.ts";
import type { RecorderOptions, RecorderReport } from "@/recorder/types.ts";

/** Configure once, import per test file, then call recordTests(import.meta.url). */
export class TestRecorder {
  private readonly collector: Collector;
  /** Shared configuration loaded by the runner. */
  readonly options: RecorderOptions;
  /** Fragment output directory, when configured. */
  readonly directory?: string;
  private readonly journal: Journal;
  private readonly files = new Map<string, RecordedTests>();
  /** Create a recorder with optional output and profiling settings. */
  constructor(options: RecorderOptions = {}) {
    this.collector = new Collector(
      options,
      environment("COLIBRI_RECORDER_RUN_ID"),
    );
    this.options = options;
    const root = options.output?.json?.directory;
    this.directory = environment("COLIBRI_RECORDER_DIRECTORY") ??
      (root ? join(root, this.collector.runId) : undefined);
    this.journal = new Journal(this.collector, this.directory);
  }
  /** Preserve the std/testing BDD API and expose automatically attributed observers. */
  recordTests(file: string): RecordedTests {
    let tests = this.files.get(file);
    if (!tests) {
      tests = recordTests(
        this.collector,
        new Observer(this.collector, file, () => this.flush()),
        () => this.journal.flushSync(),
      );
      this.files.set(file, tests);
    }
    return tests;
  }
  /** Return a defensive snapshot of current observations. */
  report(): RecorderReport {
    return structuredClone(this.collector.report());
  }
  /** Flush pending records; the CLI aggregates files and writes final JSON/HTML. */
  flush(): Promise<void> {
    return this.journal.flush();
  }
}
export type {
  RecordedDescribe,
  RecordedHook,
  RecordedIt,
  RecordedTests,
} from "@/recorder/deno/bdd.ts";
export { aggregate } from "@/recorder/deno/aggregate.ts";
export type * from "@/recorder/types.ts";

export type { DescribeArgs, ItArgs, TestSuite } from "@std/testing/bdd";
export type { TestObserver } from "@/recorder/types.ts";
