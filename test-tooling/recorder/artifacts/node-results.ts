import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvidenceRecord, RecorderReport } from "@/recorder/types.ts";
import * as ERROR from "@/recorder/error.ts";

interface Result {
  file: string;
  path: string[];
  status: "passed" | "failed" | "skipped";
  detail?: string;
}
const key = (file: string, path: string[], cwd: string): string =>
  JSON.stringify([
    resolve(cwd, file.startsWith("file:") ? fileURLToPath(file) : file),
    path,
  ]);
function validateResult(result: Result): void {
  if (
    typeof result.file !== "string" || !Array.isArray(result.path) ||
    !result.path.every((v) => typeof v === "string") ||
    !["passed", "failed", "skipped"].includes(result.status)
  ) {
    throw new ERROR.INVALID_ARTIFACT("Invalid Node test result.");
  }
}
function parseResults(text: string, cwd: string): {
  results: Map<string, Result[]>;
  complete: boolean;
} {
  const results = new Map<string, Result[]>();
  let complete = false;
  for (const line of text.trim().split("\n")) {
    const chunk = JSON.parse(line);
    if (chunk.complete === true) {
      complete = true;
      continue;
    }
    if (!Array.isArray(chunk.results)) {
      throw new ERROR.INVALID_ARTIFACT("Invalid Node runner results.");
    }
    for (const value of chunk.results) {
      const result = { ...value, file: chunk.file ?? value.file } as Result;
      validateResult(result);
      const id = key(result.file, result.path, cwd);
      results.set(id, [...(results.get(id) ?? []), result]);
    }
  }
  return { results, complete };
}

function applyResult(record: EvidenceRecord, match: Result): void {
  record.runnerStatus = match.status;
  if (match.detail) {
    record.data = {
      callback: record.data ?? null,
      runnerFailure: match.detail,
    };
  }
}
/** Reconcile native runner results, including teardown failures after a passing callback. */
export function reconcileNodeResults(
  report: RecorderReport,
  text: string,
  cwd: string,
): void {
  const { results, complete } = parseResults(text, cwd);
  if (!complete) report.diagnostics.push("Node runner results are incomplete.");
  const records = report.records.filter((r) =>
    r.kind === "test" || r.kind === "suite"
  );
  const counts = new Map<string, number>();
  for (const r of records) {
    const id = key(r.file, r.path ?? [r.name], cwd);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const record of records) {
    const id = key(record.file, record.path ?? [record.name], cwd),
      matches = results.get(id);
    if (counts.get(id) !== 1 || matches?.length !== 1) {
      record.runnerStatus = "unknown";
      report.diagnostics.push(
        `No unique Node runner result for ${record.file}: ${
          (record.path ?? [record.name]).join(" > ")
        }. It may be filtered, interrupted, or ambiguously named.`,
      );
      continue;
    }
    applyResult(record, matches[0]);
    results.delete(id);
  }
  for (const [id, matches] of results) {
    if (matches.some((r) => r.status === "failed")) {
      report.diagnostics.push(
        `Runner failure outside a uniquely recorded test: ${id}`,
      );
    }
  }
}
