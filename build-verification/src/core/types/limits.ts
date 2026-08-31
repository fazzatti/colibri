/** Resource limits applied to source ingestion and build execution. */
export type BuildVerificationLimits = {
  readonly maxArchiveBytes: number;
  readonly maxExtractedBytes: number;
  readonly maxFileBytes: number;
  readonly maxArtifactBytes: number;
  readonly maxFiles: number;
  readonly maxPathLength: number;
  readonly maxLogBytes: number;
  readonly maxLogEvents: number;
  readonly maxRedirects: number;
  readonly downloadTimeoutMs: number;
  readonly timeoutMs: number;
  readonly memoryBytes: number;
  readonly cpus: number;
  readonly pids: number;
};

/** Default conservative limits used by contract build verification. */
export const DEFAULT_BUILD_VERIFICATION_LIMITS: BuildVerificationLimits = Object
  .freeze({
    maxArchiveBytes: 50 * 1024 * 1024,
    maxExtractedBytes: 512 * 1024 * 1024,
    maxFileBytes: 128 * 1024 * 1024,
    maxArtifactBytes: 64 * 1024 * 1024,
    maxFiles: 20_000,
    maxPathLength: 512,
    maxLogBytes: 1024 * 1024,
    maxLogEvents: 256,
    maxRedirects: 5,
    downloadTimeoutMs: 30_000,
    timeoutMs: 10 * 60 * 1000,
    memoryBytes: 4 * 1024 * 1024 * 1024,
    cpus: 2,
    pids: 512,
  });
