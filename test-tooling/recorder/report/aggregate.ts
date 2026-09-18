import type {
  EvidenceRecord,
  JournalEvent,
  RecorderReport,
} from "@/recorder/types.ts";
import * as ERROR from "@/recorder/error.ts";

/** Merge independent append-only journals. A truncated final line is reported, not hidden. */
export function mergeFragments(
  runId: string,
  fragments: string[],
): RecorderReport {
  const records = new Map<string, EvidenceRecord>();
  const diagnostics = new Set<string>();
  const sequences = new Map<string, number>();
  for (const fragment of fragments) {
    const lines = fragment.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line.trim()) continue;
      let event: JournalEvent;
      try {
        event = JSON.parse(line);
      } catch (error) {
        if (index === lines.length - 1) {
          diagnostics.add(
            "Truncated final journal entry; evidence is incomplete.",
          );
          continue;
        }
        throw new ERROR.INVALID_ARTIFACT("Malformed journal entry.", {
          cause: error,
        });
      }
      if (
        event.schemaVersion !== 1 || event.runId !== runId ||
        typeof event.fragmentId !== "string" ||
        !Number.isSafeInteger(event.sequence)
      ) throw new ERROR.INVALID_ARTIFACT("Journal schema or run ID mismatch.");
      const previous = sequences.get(event.fragmentId) ?? 0;
      if (event.sequence !== previous + 1) {
        throw new ERROR.INVALID_ARTIFACT(
          "Duplicate or missing journal sequence.",
        );
      }
      sequences.set(event.fragmentId, event.sequence);
      if (event.record) records.set(event.record.id, event.record);
      if (event.diagnostic) diagnostics.add(event.diagnostic);
    }
  }
  return {
    schemaVersion: 1,
    runId,
    records: [...records.values()],
    diagnostics: [...diagnostics],
    complete: false,
  };
}
/** Summary counts leaf tests, not nested suite totals reported by JUnit. */
export function summarize(report: RecorderReport): Record<string, number> {
  const tests = report.records.filter((record) => record.kind === "test");
  const executions = report.records.filter((record) =>
    record.kind === "execution"
  );
  const count = (status: string) =>
    tests.filter((test) => (test.runnerStatus ?? "unknown") === status).length;
  return {
    tests: tests.length,
    passed: count("passed"),
    failed: count("failed"),
    skipped: count("skipped"),
    unknown: count("unknown"),
    executions: executions.length,
    executionErrors:
      executions.filter((record) => record.status === "failed").length,
  };
}
