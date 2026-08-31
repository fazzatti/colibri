import type {
  BuildVerificationLimits,
  VerificationLogEvent,
} from "@/core/types/index.ts";

/** Boundary receiving live structured verification log events. */
export interface VerificationLogger {
  /** Receives one already redacted and bounded event. */
  log(event: VerificationLogEvent): void | Promise<void>;
}

/** Logging behavior injected into processes and the pipeline. */
export type VerificationLogging = {
  readonly logger?: VerificationLogger;
  readonly strict?: boolean;
};

/** Arguments used to record one event and update accumulated logs. */
export type RecordVerificationLogInput = {
  readonly event: VerificationLogEvent;
  readonly logs: readonly VerificationLogEvent[];
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
};

/** Output format supported by {@link writeVerificationLogs}. */
export type VerificationLogFormat = "jsonl" | "text";
