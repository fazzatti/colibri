import { BuildVerificationError, Code } from "../error/base.ts";

/** Raised when verification evidence cannot be exported atomically. */
export class EvidenceWriteFailedError
  extends BuildVerificationError<Code.EVIDENCE_WRITE_FAILED> {
  /** Creates an evidence writer error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.EVIDENCE_WRITE_FAILED,
      source: "@colibri/build-verification/reporting/evidence-writer",
      message: "Failed to write verification evidence",
      details: "Completed evidence could not be written atomically.",
      data: { path },
      cause,
    });
  }
}

/** Raised when structured verification logs cannot be exported atomically. */
export class LogWriteFailedError
  extends BuildVerificationError<Code.LOG_WRITE_FAILED> {
  /** Creates a log writer error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.LOG_WRITE_FAILED,
      source: "@colibri/build-verification/reporting/log-writer",
      message: "Failed to write verification logs",
      details: "Structured verification logs could not be written atomically.",
      data: { path },
      cause,
    });
  }
}

/** Raised when a caller-selected strict logger fails. */
export class LoggerFailedError
  extends BuildVerificationError<Code.LOGGER_FAILED> {
  /** Creates a strict logger failure. */
  constructor(cause: unknown) {
    super({
      code: Code.LOGGER_FAILED,
      source: "@colibri/build-verification/reporting/logger",
      message: "Verification logger failed",
      details:
        "The caller selected strict logging and its logger rejected an event.",
      cause,
    });
  }
}
