import { xdr } from "stellar-sdk";
import type { Collector } from "@/recorder/runtime/collector.ts";
import type { LedgerChangesEvidence } from "@/recorder/types.ts";

type Mutation = {
  kind: "created" | "updated" | "removed" | "restored";
  entry: xdr.LedgerEntry | xdr.LedgerKey;
  before?: xdr.LedgerEntry;
  operationIndex?: number;
  phase?: "before" | "operation" | "after";
};
function ttl(entry: xdr.LedgerEntry | undefined): xdr.TtlEntry | undefined {
  return entry?.data.type === "ttl" ? entry.data.ttl : undefined;
}
function collect(
  mutations: Mutation[],
  collector: Collector,
): LedgerChangesEvidence | undefined {
  if (!collector.options.profiling?.resources) return;
  const summary: LedgerChangesEvidence = {
    created: 0,
    updated: 0,
    removed: 0,
    restored: 0,
    ttlExtended: 0,
    ttlUnknown: 0,
  };
  const details: unknown[] = [];
  const captureDetails = ["details", "trace"].includes(
    collector.options.capture ?? "results",
  );
  for (const item of mutations) {
    summary[item.kind]++;
    const after = item.entry instanceof xdr.LedgerEntry
      ? ttl(item.entry)
      : undefined;
    const before = ttl(item.before);
    if (item.kind === "updated" && after) {
      if (!before) summary.ttlUnknown++;
      else if (after.liveUntilLedgerSeq > before.liveUntilLedgerSeq) {
        summary.ttlExtended++;
      }
    }
    if (
      captureDetails &&
      details.length < (collector.options.limits?.entries ?? 100)
    ) {
      details.push({
        kind: item.kind,
        operationIndex: item.operationIndex,
        phase: item.phase,
        entry: item.entry.toJson(),
        ttlBefore: before?.liveUntilLedgerSeq,
        ttlAfter: after?.liveUntilLedgerSeq,
      });
    }
  }
  if (captureDetails) {
    summary.items = collector.safe(details);
  }
  return summary;
}
/** Preserve RPC state-change estimates separately from confirmed operation effects. */
export function simulationChanges(
  value: unknown,
  collector: Collector,
): LedgerChangesEvidence | undefined {
  if (!Array.isArray(value)) return;
  const mutations: Mutation[] = [];
  for (const change of value) {
    const before = change?.before, after = change?.after;
    if (after instanceof xdr.LedgerEntry) {
      mutations.push({
        kind: before instanceof xdr.LedgerEntry ? "updated" : "created",
        entry: after,
        before,
      });
    } else if (before instanceof xdr.LedgerEntry) {
      mutations.push({ kind: "removed", entry: before });
    }
  }
  return collect(mutations, collector);
}
/** Capture transaction and operation mutations, keeping their origin and excluding STATE baselines. */
export function confirmedChanges(
  meta: xdr.TransactionMeta,
  collector: Collector,
): LedgerChangesEvidence | undefined {
  const groups: {
    changes: xdr.LedgerEntryChange[];
    phase: Mutation["phase"];
    operationIndex?: number;
  }[] = [];
  const operations = meta.type === "operations"
    ? meta.operations
    : meta.value.operations;
  if (meta.type === "v1") {
    groups.push({ changes: meta.v1.txChanges, phase: "before" });
  }
  if (meta.type === "v2" || meta.type === "v3" || meta.type === "v4") {
    groups.push({ changes: meta.value.txChangesBefore, phase: "before" });
  }
  operations.forEach((op, operationIndex) =>
    groups.push({ changes: op.changes, phase: "operation", operationIndex })
  );
  if (meta.type === "v2" || meta.type === "v3" || meta.type === "v4") {
    groups.push({ changes: meta.value.txChangesAfter, phase: "after" });
  }
  const mutations: Mutation[] = [];
  const baselines = new Map<string, xdr.LedgerEntry>();
  for (const group of groups) {
    mutations.push(
      ...decodeChanges(group.changes, baselines).map((item) => ({
        ...item,
        phase: group.phase,
        operationIndex: group.operationIndex,
      })),
    );
  }
  return collect(mutations, collector);
}
function decodeChanges(
  changes: xdr.LedgerEntryChange[],
  baselines: Map<string, xdr.LedgerEntry>,
): Mutation[] {
  const mutations: Mutation[] = [];
  for (const change of changes) {
    if (change.type === "ledgerEntryState") {
      const value = ttl(change.state);
      if (value) baselines.set(value.keyHash.toString(), change.state);
      continue;
    }
    const kind = {
      ledgerEntryCreated: "created",
      ledgerEntryUpdated: "updated",
      ledgerEntryRemoved: "removed",
      ledgerEntryRestored: "restored",
    }[change.type] as Mutation["kind"];
    const entry = change.value;
    const value = entry instanceof xdr.LedgerEntry ? ttl(entry) : undefined;
    const key = value ? value.keyHash.toString() : undefined;
    mutations.push({
      kind,
      entry,
      before: key ? baselines.get(key) : undefined,
    });
    if (key && entry instanceof xdr.LedgerEntry) baselines.set(key, entry);
    if (change.type === "ledgerEntryRemoved" && change.removed.type === "ttl") {
      baselines.delete(change.removed.ttl.keyHash.toString());
    }
  }
  return mutations;
}
