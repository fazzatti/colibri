# build-verification/archive

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                  | Source                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BLDV_012` | `UNSUPPORTED_ARCHIVE` — Raised when an archive extension or encoding is unsupported.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L22)  |
| `BLDV_013` | `UNSAFE_ARCHIVE_ENTRY` — Raised when an archive entry could escape or mutate extraction boundaries.        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L23)  |
| `BLDV_014` | `ARCHIVE_LIMIT_EXCEEDED` — Raised when an archive exceeds one configured ingestion limit.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L24)  |
| `BLDV_015` | `INVALID_ARCHIVE_TOPOLOGY` — Raised when an archive lacks one unambiguous source root.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L25)  |
| `BLDV_043` | `ARCHIVE_DECODING_FAILED` — Raised when a tar or gzip archive cannot be decoded.                           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L52)  |
| `BLDV_044` | `SOURCE_EXTRACTION_INITIALIZATION_FAILED` — Raised when a temporary extraction boundary cannot be created. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L53)  |
| `BLDV_045` | `SOURCE_EXTRACTION_FAILED` — Raised when validated archive entries cannot be materialized.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L54)  |
| `BLDV_046` | `SOURCE_EXTRACTION_CLEANUP_FAILED` — Raised when cleanup after failed extraction also fails.               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L55)  |
| `BLDV_048` | `SOURCE_CLEANUP_FAILED` — Compatibility error for a prepared source tree cleanup failure.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L57)  |
| `BLDV_061` | `ZIP_DECODING_FAILED` — Raised when a ZIP archive cannot be decoded.                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L70)  |
| `BLDV_062` | `DUPLICATE_ARCHIVE_ENTRY` — Raised when an archive repeats the same normalized path.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L71)  |
| `BLDV_063` | `ARCHIVE_ENTRY_TYPE_CONFLICT` — Raised when duplicate paths disagree about file versus directory type.     | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L72)  |
| `BLDV_065` | `SOURCE_DIRECTORY_COPY_FAILED` — Raised when an out-of-band local directory cannot be copied safely.       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L74)  |
| `BLDV_096` | `ARCHIVE_CRC_MISMATCH` — Raised when a decompressed ZIP entry fails its CRC-32 commitment.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L105) |
| `BLDV_097` | `UNSUPPORTED_ZIP_FEATURE` — Raised when a ZIP entry uses a feature outside the supported safe subset.      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L106) |
