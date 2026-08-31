import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when an archive extension or encoding is unsupported. */
export class UnsupportedArchiveError
  extends BuildVerificationError<Code.UNSUPPORTED_ARCHIVE> {
  /** Creates an unsupported archive error. */
  constructor(name: string) {
    super({
      code: Code.UNSUPPORTED_ARCHIVE,
      source: "@colibri/build-verification/archive",
      message: "Unsupported source archive",
      details: "Supported source archives are .tar, .tar.gz, .tgz, and .zip.",
      data: { name },
    });
  }
}

/** Raised when a tar or gzip archive cannot be decoded. */
export class ArchiveDecodingFailedError
  extends BuildVerificationError<Code.ARCHIVE_DECODING_FAILED> {
  /** Creates a general archive-decoding error. */
  constructor(name: string, cause: unknown) {
    super({
      code: Code.ARCHIVE_DECODING_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to decode source archive",
      details: "The supported archive encoding could not be decoded safely.",
      data: { name },
      cause,
    });
  }
}

/** Raised when a ZIP archive cannot be decoded. */
export class ZipDecodingFailedError
  extends BuildVerificationError<Code.ZIP_DECODING_FAILED> {
  /** Creates a ZIP-specific decoding error. */
  constructor(name: string, cause: unknown) {
    super({
      code: Code.ZIP_DECODING_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to decode ZIP source archive",
      details:
        "The ZIP central directory or one compressed entry is malformed.",
      data: { name },
      cause,
    });
  }
}

/** Raised when an archive entry could escape or mutate extraction boundaries. */
export class UnsafeArchiveEntryError
  extends BuildVerificationError<Code.UNSAFE_ARCHIVE_ENTRY> {
  /** Creates an unsafe archive-entry error. */
  constructor(path: string, reason: string) {
    super({
      code: Code.UNSAFE_ARCHIVE_ENTRY,
      source: "@colibri/build-verification/archive",
      message: "Unsafe source archive entry",
      details: reason,
      data: { path },
    });
  }
}

/** Raised when an archive exceeds one configured ingestion limit. */
export class ArchiveLimitExceededError
  extends BuildVerificationError<Code.ARCHIVE_LIMIT_EXCEEDED> {
  /** Creates an archive limit error. */
  constructor(limit: string, actual: number, maximum: number) {
    super({
      code: Code.ARCHIVE_LIMIT_EXCEEDED,
      source: "@colibri/build-verification/archive",
      message: "Source archive limit exceeded",
      details: `The archive exceeded the configured ${limit} limit.`,
      data: { limit, actual, maximum },
    });
  }
}

/** Raised when an archive lacks one unambiguous source root. */
export class InvalidArchiveTopologyError
  extends BuildVerificationError<Code.INVALID_ARCHIVE_TOPOLOGY> {
  /** Creates an invalid archive-topology error. */
  constructor(entries: readonly string[]) {
    super({
      code: Code.INVALID_ARCHIVE_TOPOLOGY,
      source: "@colibri/build-verification/archive",
      message: "Invalid source archive topology",
      details:
        "A source archive must contain exactly one top-level directory and no top-level files.",
      data: { entries },
    });
  }
}

/** Raised when a temporary extraction boundary cannot be created. */
export class SourceExtractionInitializationFailedError
  extends BuildVerificationError<Code.SOURCE_EXTRACTION_INITIALIZATION_FAILED> {
  /** Creates an extraction initialization error. */
  constructor(cause: unknown) {
    super({
      code: Code.SOURCE_EXTRACTION_INITIALIZATION_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to initialize source extraction",
      details: "The temporary extraction directory could not be created.",
      cause,
    });
  }
}

/** Raised when validated archive entries cannot be materialized. */
export class SourceExtractionFailedError
  extends BuildVerificationError<Code.SOURCE_EXTRACTION_FAILED> {
  /** Creates an extraction-write error. */
  constructor(cause: unknown) {
    super({
      code: Code.SOURCE_EXTRACTION_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to extract source archive",
      details:
        "A validated archive entry could not be written into the workspace.",
      cause,
    });
  }
}

/** Raised when cleanup after failed extraction also fails. */
export class SourceExtractionCleanupFailedError
  extends BuildVerificationError<Code.SOURCE_EXTRACTION_CLEANUP_FAILED> {
  /** Creates an extraction cleanup error retaining both causes. */
  constructor(extractionCause: unknown, cleanupCause: unknown) {
    super({
      code: Code.SOURCE_EXTRACTION_CLEANUP_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to clean partial source extraction",
      details:
        "Extraction failed and its partially materialized tree remained.",
      cause: cleanupCause,
      data: { extractionCause: String(extractionCause) },
    });
  }
}

/** Compatibility error for a prepared source tree cleanup failure. */
export class SourceCleanupFailedError
  extends BuildVerificationError<Code.SOURCE_CLEANUP_FAILED> {
  /** Creates a prepared-source cleanup error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.SOURCE_CLEANUP_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to clean prepared verification source",
      details: "The temporary prepared source tree could not be removed.",
      data: { path },
      cause,
    });
  }
}

/** Raised when an archive repeats the same normalized path. */
export class DuplicateArchiveEntryError
  extends BuildVerificationError<Code.DUPLICATE_ARCHIVE_ENTRY> {
  /** Creates a duplicate archive-entry error. */
  constructor(path: string) {
    super({
      code: Code.DUPLICATE_ARCHIVE_ENTRY,
      source: "@colibri/build-verification/archive",
      message: "Duplicate source archive entry",
      details: "An archive cannot materialize the same normalized path twice.",
      data: { path },
    });
  }
}

/** Raised when duplicate paths disagree about file versus directory type. */
export class ArchiveEntryTypeConflictError
  extends BuildVerificationError<Code.ARCHIVE_ENTRY_TYPE_CONFLICT> {
  /** Creates an archive entry-type conflict error. */
  constructor(path: string) {
    super({
      code: Code.ARCHIVE_ENTRY_TYPE_CONFLICT,
      source: "@colibri/build-verification/archive",
      message: "Source archive entry type conflict",
      details: "The same normalized path appears as both a file and directory.",
      data: { path },
    });
  }
}

/** Raised when a ZIP entry uses a feature outside the supported safe subset. */
export class UnsupportedZipFeatureError
  extends BuildVerificationError<Code.UNSUPPORTED_ZIP_FEATURE> {
  /** Creates an unsupported ZIP-feature error. */
  constructor(path: string, feature: string) {
    super({
      code: Code.UNSUPPORTED_ZIP_FEATURE,
      source: "@colibri/build-verification/archive",
      message: "Unsupported ZIP archive feature",
      details:
        "The ZIP entry uses an encoding or file type that is not safely supported.",
      data: { path, feature },
    });
  }
}

/** Raised when a decompressed ZIP entry fails its CRC-32 commitment. */
export class ArchiveCrcMismatchError
  extends BuildVerificationError<Code.ARCHIVE_CRC_MISMATCH> {
  /** Creates a ZIP CRC mismatch error. */
  constructor(path: string, expected: number, actual: number) {
    super({
      code: Code.ARCHIVE_CRC_MISMATCH,
      source: "@colibri/build-verification/archive",
      message: "ZIP source archive CRC mismatch",
      details:
        "A decompressed ZIP entry does not match its central-directory CRC-32.",
      data: { path, expected, actual },
    });
  }
}

/** Raised when an out-of-band local directory cannot be copied safely. */
export class SourceDirectoryCopyFailedError
  extends BuildVerificationError<Code.SOURCE_DIRECTORY_COPY_FAILED> {
  /** Creates a local source-directory copy error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.SOURCE_DIRECTORY_COPY_FAILED,
      source: "@colibri/build-verification/archive",
      message: "Failed to copy source directory",
      details:
        "The out-of-band local source directory could not be copied into the disposable workspace.",
      data: { path },
      cause,
    });
  }
}
