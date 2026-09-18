import { diagnosticMessage } from "@/recorder/runtime/diagnostic.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  Attribution,
  Evidence,
  EvidenceRecord,
  JournalEvent,
  RecorderOptions,
  RecorderReport,
} from "@/recorder/types.ts";
import { snapshot } from "@/recorder/serialization/index.ts";
import * as ERROR from "@/recorder/error.ts";

/** In-memory collection shared by observers in this runtime. */
export class Collector {
  readonly context: AsyncLocalStorage<Attribution> = new AsyncLocalStorage();
  readonly records: Map<string, EvidenceRecord> = new Map();
  readonly diagnostics: string[] = [];
  readonly fragmentId: string = crypto.randomUUID();
  readonly pending: JournalEvent[] = [];
  readonly attached: WeakSet<object> = new WeakSet();
  journalEnabled: boolean = false;
  private sequence = 0;
  private limited = false;
  constructor(
    readonly options: RecorderOptions = {},
    readonly runId: string = crypto.randomUUID(),
  ) {
    for (const value of Object.values(options.limits ?? {})) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new ERROR.INVALID_CONFIGURATION(
          "Recorder limits must be positive safe integers.",
        );
      }
    }
  }
  /** Recorder failures are diagnostics and never replace application errors. */
  guard(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.diagnostic(
        `Observation failed: ${diagnosticMessage(error)}`,
      );
    }
  }
  safe(value: unknown): Evidence {
    const normalized = snapshot(value, this.options);
    return this.options.sanitize
      ? snapshot(this.options.sanitize(normalized), this.options)
      : normalized;
  }
  emit(record: EvidenceRecord): void {
    if (
      !this.records.has(record.id) &&
      this.records.size >= (this.options.limits?.records ?? 10000)
    ) {
      if (!this.limited) {
        this.limited = true;
        this.diagnostic("Record limit reached; evidence is incomplete.");
      }
      return;
    }
    // Own records contain only normalized evidence; clone before later lifecycle updates.
    const copy = structuredClone(record);
    this.records.set(record.id, copy);
    if (this.journalEnabled) {
      this.pending.push({
        schemaVersion: 1,
        runId: this.runId,
        fragmentId: this.fragmentId,
        sequence: ++this.sequence,
        record: copy,
      });
    }
  }
  diagnostic(message: string): void {
    if (this.diagnostics.includes(message) || this.diagnostics.length >= 100) {
      return;
    }
    this.diagnostics.push(message);
    if (this.journalEnabled) {
      this.pending.push({
        schemaVersion: 1,
        runId: this.runId,
        fragmentId: this.fragmentId,
        sequence: ++this.sequence,
        diagnostic: message,
      });
    }
  }
  record(
    kind: EvidenceRecord["kind"],
    name: string,
    fallback: Attribution,
  ): EvidenceRecord {
    return {
      id: crypto.randomUUID(),
      kind,
      name,
      ...(this.context.getStore() ?? fallback),
      status: "running",
      startedAt: new Date().toISOString(),
    };
  }
  report(): RecorderReport {
    return {
      schemaVersion: 1,
      runId: this.runId,
      records: [...this.records.values()],
      diagnostics: [...this.diagnostics],
      complete: false,
    };
  }
}
