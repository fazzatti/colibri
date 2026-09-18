import type {
  Attribution,
  EvidenceRecord,
  ObservationOptions,
} from "@/recorder/types.ts";
import type { Collector } from "@/recorder/runtime/collector.ts";

/** Preserve synchronous values/throws and asynchronous rejection identity. */
export function capture<T>(
  collector: Collector,
  fallback: Attribution,
  kind: "create" | "call",
  callback: () => T,
  options: ObservationOptions = {},
  attach?: (value: unknown) => void,
): T {
  const record = collector.record(
    kind,
    options.name ?? (kind === "create" ? "create client" : "captured call"),
    fallback,
  );
  const started = performance.now();
  collector.guard(() => {
    record.data = collector.safe(options.metadata);
    collector.emit(record);
  });
  const finish = (status: EvidenceRecord["status"], value: unknown): void =>
    collector.guard(() => {
      record.status = status;
      record.endedAt = new Date().toISOString();
      if (collector.options.profiling?.timings) {
        record.durationMs = performance.now() - started;
      }
      if (collector.options.capture !== "summary") {
        if (status === "failed") record.error = collector.safe(value);
        else {record.data = collector.safe({
            metadata: options.metadata,
            result: value,
          });}
      }
      collector.emit(record);
    });
  const success = (value: unknown): unknown => {
    if (attach) collector.guard(() => attach(value));
    finish("passed", value);
    return value;
  };
  const failure = (error: unknown): never => {
    finish("failed", error);
    throw error;
  };
  return collector.context.run({
    ...(collector.context.getStore() ?? fallback),
    callId: record.id,
  }, () => {
    try {
      const value = callback();
      if (value instanceof Promise) return value.then(success, failure) as T;
      return success(value) as T;
    } catch (error) {
      return failure(error);
    }
  });
}
