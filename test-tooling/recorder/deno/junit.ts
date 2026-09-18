import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RecorderReport } from "@/recorder/types.ts";
import * as ERROR from "@/recorder/error.ts";

function decode(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, entity: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      };
      return named[entity] ?? String.fromCodePoint(
        entity.startsWith("#x")
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1)),
      );
    },
  );
}
function attributes(value: string): Record<string, string> {
  return Object.fromEntries(
    [...value.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((
      match,
    ) => [match[1], decode(match[2] ?? match[3])]),
  );
}
function filePath(file: string, cwd: string): string {
  return file.startsWith("file:")
    ? resolve(fileURLToPath(file))
    : resolve(cwd, file);
}
interface RunnerResult {
  status: "passed" | "failed" | "skipped";
  detail?: string;
}
type Results = Map<string, RunnerResult[]>;
function parseResults(xml: string, cwd: string): Results {
  if (
    !xml.includes("<testsuites") || !xml.includes("</testsuites>") ||
    /<!DOCTYPE|<!ENTITY/i.test(xml)
  ) throw new ERROR.INVALID_ARTIFACT("Invalid Deno JUnit report.");
  const results: Results = new Map();
  for (
    const match of xml.matchAll(
      /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g,
    )
  ) {
    const attr = attributes(match[1]);
    const body = match[2] ?? "";
    if (!attr.classname || !attr.name) {
      throw new ERROR.INVALID_ARTIFACT(
        "JUnit testcase requires a name and classname.",
      );
    }
    const key = JSON.stringify([filePath(attr.classname, cwd), attr.name]);
    const entries = results.get(key) ?? [];
    const failed = /<(?:failure|error)\b/.test(body);
    entries.push({
      status: failed
        ? "failed"
        : /<skipped\b/.test(body)
        ? "skipped"
        : "passed",
      detail: failed ? decode(body.replace(/<[^>]*>/g, "").trim()) : undefined,
    });
    results.set(key, entries);
  }
  return results;
}
function fullName(record: RecorderReport["records"][number]): string {
  return record.path?.join(" > ") ?? record.name;
}
function nameIndex(results: Results): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const key of results.keys()) {
    const name = JSON.parse(key)[1] as string;
    const keys = index.get(name) ?? [];
    keys.push(key);
    index.set(name, keys);
  }
  return index;
}
function resolveResult(
  record: RecorderReport["records"][number],
  registrations: RecorderReport["records"],
  results: Results,
  index: Map<string, string[]>,
  cwd: string,
): { key: string; result: RunnerResult } | undefined {
  const name = fullName(record);
  let key = JSON.stringify([filePath(record.file, cwd), name]);
  let entries = results.get(key);
  const matchingNames = registrations.filter((r) => fullName(r) === name);
  // std/testing introduces a synthetic global suite for file-level hooks.
  const runnerName = index.has(name) ? name : `global > ${name}`;
  // Deno sometimes reports wrapper locations. Fall back only to globally unique
  // full test paths, never registration order across concurrent files.
  if (
    !entries && matchingNames.length === 1 &&
    index.get(runnerName)?.length === 1 &&
    (runnerName === name ||
      !registrations.some((r) => fullName(r) === runnerName))
  ) {
    key = index.get(runnerName)![0];
    entries = results.get(key);
  }
  if (
    entries?.length !== 1 ||
    matchingNames.filter((r) => r.file === record.file).length !== 1
  ) return;
  return { key, result: entries[0] };
}
/** Reconcile Deno's JUnit results without counting suite failures as additional tests. */
export function reconcileJUnit(
  report: RecorderReport,
  xml: string,
  cwd: string,
): void {
  const results = parseResults(xml, cwd);
  const registrations = report.records.filter((r) =>
    r.kind === "test" || r.kind === "suite"
  );
  const index = nameIndex(results);
  const used = new Set<string>();
  for (const record of registrations) {
    const match = resolveResult(record, registrations, results, index, cwd);
    if (!match) {
      record.runnerStatus = "unknown";
      report.diagnostics.push(
        `No unique runner result for ${record.file}: ${
          fullName(record)
        }. It may be filtered, interrupted, or ambiguously named.`,
      );
      continue;
    }
    used.add(match.key);
    record.runnerStatus = match.result.status;
    if (match.result.detail) {
      record.data = {
        callback: record.data ?? null,
        runnerFailure: match.result.detail,
      };
    }
  }
  for (const [key, entries] of results) {
    if (!used.has(key) && entries.some((entry) => entry.status === "failed")) {
      report.diagnostics.push(
        `Runner failure outside a uniquely recorded test: ${key}`,
      );
    }
  }
}
