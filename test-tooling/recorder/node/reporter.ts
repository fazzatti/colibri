interface Event {
  type: string;
  data: {
    file?: string;
    name?: string;
    nesting?: number;
    skip?: boolean | string;
    todo?: boolean | string;
    details?: { error?: { message?: string; cause?: { message?: string } } };
  };
}
interface Result {
  file?: string;
  path: string[];
  status: "passed" | "failed" | "skipped";
  detail?: string;
}
function result(type: string, data: Event["data"], path: string[]): Result {
  const error = data.details?.error;
  return {
    file: data.file,
    path: [...path.slice(0, data.nesting ?? 0), data.name ?? "<anonymous>"],
    status: data.skip || data.todo
      ? "skipped"
      : type === "test:pass"
      ? "passed"
      : "failed",
    detail: error
      ? [error.message, error.cause?.message].filter(Boolean).join(": ")
      : undefined,
  };
}
/** Machine-readable results alongside Node's normal reporter, never on test stdout. */
export async function* nodeReporter(
  events: AsyncIterable<Event>,
): AsyncGenerator<string> {
  let path: string[] = [];
  let pending: Result[] = [];
  for await (const { type, data } of events) {
    // Node emits start/pass/fail in report order, even for concurrent tests.
    // The per-file summary supplies the worker file instead of the adapter's callsite.
    if (type === "test:start") {
      path = path.slice(0, data.nesting ?? 0);
      path.push(data.name ?? "<anonymous>");
    }
    if (type === "test:pass" || type === "test:fail") {
      pending.push(result(type, data, path));
    }
    if (type === "test:summary" && data.file) {
      yield JSON.stringify({ file: data.file, results: pending }) + "\n";
      pending = [];
      path = [];
    }
  }
  // File-level import failures may have no worker summary. Retain them as failures.
  if (pending.length) yield JSON.stringify({ results: pending }) + "\n";
  yield JSON.stringify({ complete: true }) + "\n";
}
