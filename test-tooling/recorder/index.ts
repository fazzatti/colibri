/**
 * @module
 * Portable in-memory Colibri execution recording, independent of Docker.
 */
import { Collector } from "@/recorder/runtime/collector.ts";
import { Observer } from "@/recorder/runtime/observer.ts";
import type {
  RecorderOptions,
  RecorderReport,
  TestObserver,
} from "@/recorder/types.ts";
/** In-memory recorder for custom test runners. Use /recorder/deno for recordTests. */
export class ExecutionRecorder {
  private readonly collector: Collector;
  /** Start a new in-memory recording run. */
  constructor(options: RecorderOptions = {}, runId?: string) {
    this.collector = new Collector(options, runId);
  }
  /** Create an observer with optional file attribution. */
  observer(file = "unattributed"): TestObserver {
    return new Observer(this.collector, file);
  }
  /** Return a defensive snapshot; runner completion must be supplied by an adapter. */
  report(): RecorderReport {
    return structuredClone(this.collector.report());
  }
}

export {
  Code as RecorderErrorCode,
  ERROR_TTO_REC,
  INVALID_ARTIFACT,
  INVALID_CONFIGURATION,
  RecorderError,
} from "@/recorder/error.ts";
export type * from "@/recorder/types.ts";
