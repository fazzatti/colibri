import type { RecorderReport } from "@/recorder/types.ts";
/** Descriptive statistics over available samples only. Variance uses the population divisor. */
export interface Statistics {
  /** Number of available finite samples. */
  count: number;
  /** Smallest observed sample. */
  min: number;
  /** Largest observed sample. */
  max: number;
  /** Arithmetic mean of available samples. */
  mean: number;
  /** Nearest-rank median. */
  p50: number;
  /** Nearest-rank 95th percentile. */
  p95: number;
  /** Population variance in squared metric units. */
  variance: number;
  /** Population standard deviation in metric units. */
  standardDeviation: number;
}
/** Stable online variance and nearest-rank percentiles. */
export function statistics(samples: number[]): Statistics | undefined {
  const values = samples.filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return;
  let mean = 0, m2 = 0;
  values.forEach((value, i) => {
    const delta = value - mean;
    mean += delta / (i + 1);
    m2 += delta * (value - mean);
  });
  const variance = m2 / values.length;
  return {
    count: values.length,
    min: values[0],
    max: values.at(-1)!,
    mean,
    p50: values[Math.ceil(values.length * .5) - 1],
    p95: values[Math.ceil(values.length * .95) - 1],
    variance,
    standardDeviation: Math.sqrt(variance),
  };
}
/** Comparable samples grouped by network, client label, contract, method and execution kind. */
export interface ProfileGroup {
  /** Network identity supplied for standalone pipelines. */
  network?: string;
  /** Optional client label supplied at attachment. */
  client?: string;
  /** Invoked Stellar contract address, when available. */
  contract?: string;
  /** Invoked contract method, when available. */
  method?: string;
  /** Kind of observation or execution. */
  kind: string;
  /** Number of executions in this comparable group. */
  executions: number;
  /** Elapsed monotonic time in milliseconds when timing is enabled. */
  durationMs?: Statistics;
  /** Simulated instruction budget, not actual consumption. */
  instructions?: Statistics;
  /** Simulated disk read budget in bytes. */
  diskReadBytes?: Statistics;
  /** Simulated write budget in bytes. */
  writeBytes?: Statistics;
}
/** Uses the final simulation budget per execution; simulation phases remain in its evidence. */
export function profileGroups(report: RecorderReport): ProfileGroup[] {
  const groups = new Map<string, typeof report.records>();
  for (const record of report.records) {
    const e = record.execution;
    if (!e) continue;
    const key = JSON.stringify([
      e.network,
      e.client,
      e.contract,
      e.method,
      e.kind,
    ]);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return [...groups.values()].map((records) => {
    const e = records[0].execution!;
    const samples = (metric: "instructions" | "diskReadBytes" | "writeBytes") =>
      records.map((r) => r.execution!.simulations.at(-1)?.[metric]).filter((
        n,
      ): n is number => n !== undefined);
    return {
      network: e.network,
      client: e.client,
      contract: e.contract,
      method: e.method,
      kind: e.kind,
      executions: records.length,
      durationMs: statistics(
        records.flatMap((r) =>
          r.durationMs === undefined ? [] : [r.durationMs]
        ),
      ),
      instructions: statistics(samples("instructions")),
      diskReadBytes: statistics(samples("diskReadBytes")),
      writeBytes: statistics(samples("writeBytes")),
    };
  });
}
