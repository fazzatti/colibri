import type { Collector } from "@/recorder/runtime/collector.ts";
import { capture } from "@/recorder/runtime/capture.ts";
import {
  attachPipeline,
  type ObservablePipeline,
} from "@/recorder/runtime/plugins.ts";
import { object } from "@/recorder/profiling/extract.ts";
import type { ObservationOptions } from "@/recorder/types.ts";

/** File-bound helpers. Client attachment persists; test attribution follows async execution. */
export class Observer {
  constructor(
    readonly collector: Collector,
    readonly file: string,
    private readonly drain: () => Promise<void> = () => Promise.resolve(),
  ) {}
  /** Observe a factory, then attach the returned client without changing its identity. */
  create<T>(factory: () => T, options: ObservationOptions = {}): T {
    return capture(
      this.collector,
      { file: this.file },
      "create",
      factory,
      options,
      (value) => this.attach(value, options),
    );
  }
  /** Attach to a pipeline or a client exposing readPipe/invokePipe/transactionPipe. */
  attach<T>(target: T, options: ObservationOptions = {}): T {
    this.collector.guard(() => {
      const outer = object(target);
      // SAC and SEP-41 clients expose their underlying Core client publicly.
      const data = object(outer.contract ?? target);
      const network = options.network ?? object(data.networkConfig);
      const candidates = typeof data.use === "function"
        ? [target]
        : [data.readPipe, data.invokePipe, data.transactionPipe].filter(
          Boolean,
        );
      if (candidates.length === 0) {
        this.collector.diagnostic(
          `No supported pipeline extension points in ${this.file} (${
            options.name ?? "unnamed client"
          }); execution observation is unavailable.`,
        );
      }
      for (const candidate of candidates) {
        const pipe = candidate as ObservablePipeline;
        if (this.collector.attached.has(pipe)) continue;
        attachPipeline(pipe, this.collector, { file: this.file }, {
          ...options,
          network,
        });
        this.collector.attached.add(pipe);
      }
    });
    return target;
  }
  /** Optional exact caller boundary, including errors before/after pipeline execution. */
  capture<T>(callback: () => T, options: ObservationOptions = {}): T {
    return capture(
      this.collector,
      { file: this.file },
      "call",
      callback,
      options,
    );
  }
  /** Explicit evidence log; does not replace or intercept console methods. */
  log(message: string, data?: unknown): void {
    this.collector.guard(() => {
      const record = this.collector.record("log", message, { file: this.file });
      record.status = "passed";
      record.data = this.collector.safe(data);
      this.collector.emit(record);
    });
  }
  /** Drain pending journal entries without closing the observer. */
  flush(): Promise<void> {
    return this.drain();
  }
}
