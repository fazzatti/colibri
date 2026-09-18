/** JSON-safe evidence. Integers exceeding Number precision are decimal strings. */
export type Evidence = null | boolean | number | string | Evidence[] | {
  [key: string]: Evidence;
};
/** Detail retained for each observed execution. */
export type CaptureLevel = "summary" | "results" | "details" | "trace";
/** Recorder configuration; collection is in memory unless output is requested. */
export interface RecorderOptions {
  /** Amount of execution evidence to retain; results by default. */
  capture?: CaptureLevel;
  /** Authorization details to collect independently of capture level. */
  authorization?: { level: "none" | "summary" | "full"; signatures?: boolean };
  /** Event counts by default; full adds bounded, sanitized event payloads. */
  events?: "none" | "summary" | "full";
  /** Optional timing, resource budget and fee collection. */
  profiling?: { timings?: boolean; resources?: boolean; fees?: boolean };
  /** Positive bounds for retained evidence. */
  limits?: {
    records?: number;
    depth?: number;
    entries?: number;
    stringLength?: number;
  };
  /** Runs after built-in redaction. Exceptions are retained as diagnostics. */
  sanitize?: (value: Evidence) => Evidence;
  /** Optional summary, journal directory and HTML report. */
  output?: { summary?: boolean; json?: { directory: string }; html?: boolean };
}
/** Optional display name and application metadata; never required for correlation. */
export interface ObservationOptions {
  /** Human-readable label; never used as a unique execution identity. */
  name?: string;
  /** Application metadata normalized with the configured sanitizer. */
  metadata?: Record<string, unknown>;
  /** Network identity supplied for standalone pipelines. */
  network?: { networkPassphrase?: string; rpcUrl?: string };
}
/** Async-local attribution, independent from the lifetime of an attached client. */
export interface Attribution {
  /** Source test file URL or application-provided label. */
  file: string;
  /** Associated test or hook observation ID. */
  testId?: string;
  /** Associated optional caller observation ID. */
  callId?: string;
}
/** One test, suite, hook, client construction, call, execution, or explicit log. */
export interface EvidenceRecord {
  /** Unique observation ID within this run. */
  id: string;
  /** Kind of observation or execution. */
  kind: "suite" | "test" | "hook" | "create" | "call" | "execution" | "log";
  /** Source test file URL or application-provided label. */
  file: string;
  /** Parent suite or enclosing observation ID. */
  parentId?: string;
  /** Associated test or hook observation ID. */
  testId?: string;
  /** Associated optional caller observation ID. */
  callId?: string;
  /** Human-readable label; never used as a unique execution identity. */
  name: string;
  /** Full suite and test name path used for runner reconciliation. */
  path?: string[];
  /** Outcome seen at the observation boundary. */
  status:
    | "registered"
    | "running"
    | "passed"
    | "failed"
    | "skipped"
    | "unknown";
  /** Runner result is separate from callback/pipeline status. */
  runnerStatus?: "passed" | "failed" | "skipped" | "unknown";
  /** UTC ISO timestamp when this observation started. */
  startedAt: string;
  /** UTC ISO timestamp when this observation ended, if available. */
  endedAt?: string;
  /** Elapsed monotonic time in milliseconds when timing is enabled. */
  durationMs?: number;
  /** Normalized input, result or application context. */
  data?: Evidence;
  /** Normalized observed failure, with bounded causes. */
  error?: Evidence;
  /** Transaction pipeline evidence, when applicable. */
  execution?: ExecutionEvidence;
}
/** A single observed pipeline invocation; stages are not additional transactions. */
export interface ExecutionEvidence {
  /** Kind of observation or execution. */
  kind: "read" | "invoke" | "classic" | "custom";
  /** Optional client label supplied at attachment. */
  client?: string;
  /** Network identity supplied for standalone pipelines. */
  network?: string;
  /** Invoked Stellar contract address, when available. */
  contract?: string;
  /** Invoked contract method, when available. */
  method?: string;
  /** Operation types in this transaction. */
  operations: string[];
  /** Operation subtypes and targets, in transaction order. */
  operationDetails?: OperationEvidence[];
  /** Chain outcome; unknown does not imply failure or success. */
  chain: "not-submitted" | "unknown" | "confirmed-success" | "confirmed-failed";
  /** Observed outer transaction hash, independent of confirmation. */
  hash?: string;
  /** Inner transaction hash for a fee-bump envelope. */
  innerHash?: string;
  /** Observed direct pipeline step executions. */
  stages: StageEvidence[];
  /** Distinct observed simulation resource estimates. */
  simulations: ResourceProfile[];
  /** Safe metadata captured at the send step boundary. */
  submitted?: Evidence;
  /** Authorization details to collect independently of capture level. */
  authorization?: Evidence;
  /** Confirmed total fee charged, in decimal stroops. */
  feeCharged?: string;
  /** Confirmed resource fee components; rent is a subset. */
  resourceFees?: Evidence;
  /** Events from confirmed metadata, separately from simulation and diagnostics. */
  events?: EventEvidence;
  /** Confirmed ledger mutations across transaction and operation metadata. */
  ledgerChanges?: LedgerChangesEvidence;
}
/** One Stellar operation, including its Soroban host function when applicable. */
export interface OperationEvidence {
  /** Stellar operation type, such as invokeHostFunction or restoreFootprint. */
  type: string;
  /** Soroban host function discriminator. */
  hostFunction?: string;
  /** Invoked contract address. */
  contract?: string;
  /** Invoked contract method. */
  method?: string;
  /** Requested TTL extension, in ledgers from the current ledger. */
  extendTo?: number;
}
/** Counts cover all observed events; payloads are optional and bounded. */
export interface EventEvidence {
  /** Contract plus system events; excludes diagnostics and unsuccessful calls. */
  count: number;
  /** Contract events from successful calls. Simulation does not imply commitment. */
  contractCount: number;
  /** System events, including transaction-level events when available. */
  systemCount: number;
  /** Diagnostic events and events from unsuccessful contract calls. */
  diagnosticCount: number;
  /** Bounded decoded payloads, passed through the configured sanitizer. */
  items?: Evidence;
  /** Number of payloads omitted by the event entry limit or summary mode. */
  omitted: number;
}
/** Counts of transaction/operation mutation records, not distinct ledger keys. */
export interface LedgerChangesEvidence {
  /** Created-entry records, including TTL entries. */
  created: number;
  /** Updated-entry records. STATE baselines are excluded. */
  updated: number;
  /** Removed-entry records. */
  removed: number;
  /** Explicit restored-entry records. */
  restored: number;
  /** TTL updates with a known baseline and a larger live-until ledger. */
  ttlExtended: number;
  /** TTL updates without a baseline; never assumed to be extensions. */
  ttlUnknown: number;
  /** Bounded mutation details and TTL before/after values when captured. */
  items?: Evidence;
}
/** Timing measures the observed hook boundary, not preceding plugins or RPC polling counts. */
export interface StageEvidence {
  /** Human-readable label; never used as a unique execution identity. */
  name: string;
  /** UTC ISO timestamp when this observation started. */
  startedAt: string;
  /** Elapsed monotonic time in milliseconds when timing is enabled. */
  durationMs?: number;
  /** Outcome seen at the observation boundary. */
  status: "running" | "passed" | "failed";
  /** Bounded step input snapshot in trace mode. */
  input?: Evidence;
  /** Optional summary, journal directory and HTML report. */
  output?: Evidence;
  /** Normalized observed failure, with bounded causes. */
  error?: Evidence;
}
/** Simulation resource budgets, not actual instruction consumption. Fees are stroops. */
export interface ResourceProfile {
  /** Name of the step producing this estimate. */
  stage: string;
  /** Simulated instruction budget, not actual consumption. */
  instructions?: number;
  /** Simulated disk read budget in bytes. */
  diskReadBytes?: number;
  /** Simulated write budget in bytes. */
  writeBytes?: number;
  /** Number of read-only ledger footprint entries. */
  readOnlyEntries?: number;
  /** Number of read-write ledger footprint entries. */
  readWriteEntries?: number;
  /** Simulation minimum resource fee in decimal stroops. */
  minResourceFee?: string;
  /** Separate restoration estimate when required. */
  restoration?: Evidence;
  /** Simulated events, not committed emissions. */
  events?: EventEvidence;
  /** Simulated ledger mutations when the RPC provides stateChanges. */
  ledgerChanges?: LedgerChangesEvidence;
}
/** Independent file fragment, persisted with monotonically increasing event sequence numbers. */
export interface JournalEvent {
  /** Artifact schema version. */
  schemaVersion: 1;
  /** Shared run identity, supplied to child test runtimes by the CLI. */
  runId: string;
  /** Random writer identity, unique across runtimes. */
  fragmentId: string;
  /** Monotonic event sequence within the fragment. */
  sequence: number;
  /** Observation snapshot replacing its previous revision. */
  record?: EvidenceRecord;
  /** Recorder limitation or collection failure. */
  diagnostic?: string;
}
/** Portable aggregate used by JSON and HTML renderers. */
export interface RecorderReport {
  /** Artifact schema version. */
  schemaVersion: 1;
  /** Shared run identity, supplied to child test runtimes by the CLI. */
  runId: string;
  /** Latest revision of each retained observation. */
  records: EvidenceRecord[];
  /** Collection and reconciliation limitations. */
  diagnostics: string[];
  /** Absent for memory-only/manual reports; never inferred from callback success. */
  exitCode?: number;
  /** Whether runner completion and evidence reconciliation are available. */
  complete: boolean;
}

/** File-bound helpers returned by a recorder. */
export interface TestObserver {
  /** Source file used when there is no active test. */
  readonly file: string;
  /** Observe construction and automatically attach the returned client. */
  create<T>(factory: () => T, options?: ObservationOptions): T;
  /** Observe an existing client or pipeline; return it unchanged. */
  attach<T>(target: T, options?: ObservationOptions): T;
  /** Optional exact caller result/error boundary. */
  capture<T>(callback: () => T, options?: ObservationOptions): T;
  /** Append explicitly supplied diagnostic data. */
  log(message: string, data?: unknown): void;
  /** Await pending artifact writes without closing collection. */
  flush(): Promise<void>;
}
