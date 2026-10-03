const metrics = [
  ["lines", "LF", "LH", "DA"],
  ["branches", "BRF", "BRH", "BRDA"],
  ["functions", "FNF", "FNH", "FNDA"],
] as const;

export interface CoverageSummary {
  files: number;
  lines: number;
  branches: number;
  functions: number;
}

/** Require complete, internally consistent LCOV with every measured counter hit. */
export function verifyCoverage(lcov: string): CoverageSummary {
  const summary: CoverageSummary = {
    files: 0,
    lines: 0,
    branches: 0,
    functions: 0,
  };
  const sources = new Set<string>();
  const failures: string[] = [];
  const records = lcov.trim().split(/^end_of_record\r?$/m);
  if (records.pop() !== "") throw new Error("Incomplete LCOV record.");
  for (const record of records) {
    const rows = record.trim().split(/\r?\n/);
    const sourcesInRecord = rows.filter((row) => row.startsWith("SF:"));
    if (sourcesInRecord.length !== 1 || !sourcesInRecord[0].slice(3)) {
      throw new Error("Each LCOV record must name exactly one source file.");
    }
    const source = sourcesInRecord[0].slice(3);
    if (sources.has(source)) {
      throw new Error(`Duplicate source record: ${source}`);
    }
    sources.add(source);
    summary.files++;
    for (const [name, foundKey, hitKey, entryKey] of metrics) {
      const count = (key: string): number => {
        const values = rows.filter((row) => row.startsWith(key + ":"));
        const text = values[0]?.slice(key.length + 1);
        if (values.length !== 1 || !/^(0|[1-9]\d*)$/.test(text ?? "")) {
          throw new Error(`${source}: missing or invalid ${key} counter.`);
        }
        const value = Number(text);
        if (!Number.isSafeInteger(value)) {
          throw new Error(`${source}: invalid ${key} counter.`);
        }
        return value;
      };
      const found = count(foundKey);
      const hit = count(hitKey);
      const entries = rows.filter((row) => row.startsWith(entryKey + ":"));
      const hits = entries.map((entry) => {
        const match = entryKey === "DA"
          ? /^DA:\d+,(\d+)(?:,[^,]+)?$/.exec(entry)
          : entryKey === "BRDA"
          ? /^BRDA:\d+,\d+,\d+,(\d+|-)$/.exec(entry)
          : /^FNDA:(\d+),.*$/.exec(entry);
        if (!match) throw new Error(`${source}: invalid ${entryKey} entry.`);
        return match[1] !== "-" && Number(match[1]) > 0;
      });
      if (found !== entries.length || hit !== hits.filter(Boolean).length) {
        throw new Error(
          `${source}: ${name} counters disagree with recorded hits.`,
        );
      }
      summary[name] += found;
      if (hit !== found) failures.push(`${source}: ${name} ${hit}/${found}`);
    }
  }
  if (!summary.files || metrics.some(([name]) => summary[name] === 0)) {
    throw new Error(
      "LCOV must contain measured lines, branches and functions.",
    );
  }
  if (failures.length) {
    throw new Error("Coverage must be exactly 100%:\n" + failures.join("\n"));
  }
  return summary;
}

if (import.meta.main) {
  const path = Deno.args[0] ?? "coverage.lcov";
  try {
    if (Deno.args.length > 1) {
      throw new Error("Usage: deno task check:coverage [coverage.lcov]");
    }
    const result = verifyCoverage(await Deno.readTextFile(path));
    console.log(
      `100% coverage: ${result.files} files, ${result.lines} lines, ` +
        `${result.branches} branches and ${result.functions} functions.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode = 1;
  }
}
