# build-verification/providers/source

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                    | Source                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `BLDV_008` | `MISSING_VERIFICATION_SOURCE` — Raised when no source can be derived or was supplied.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L18)  |
| `BLDV_009` | `SOURCE_DOWNLOAD_FAILED` — Raised when source bytes cannot be downloaded.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L19)  |
| `BLDV_010` | `SOURCE_HASH_MISMATCH` — Raised when exact source bytes do not match the recipe commitment.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L20)  |
| `BLDV_011` | `UNSUPPORTED_SOURCE` — Raised for a source form unsupported in the selected mode.                            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L21)  |
| `BLDV_047` | `LOCAL_SOURCE_ARCHIVE_READ_FAILED` — Raised when an existing local source archive cannot be read.            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L56)  |
| `BLDV_055` | `SOURCE_POLICY_REJECTED` — Raised when a source retrieval policy rejects a request or redirect.              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L64)  |
| `BLDV_056` | `SOURCE_REDIRECT_LIMIT_EXCEEDED` — Raised when an HTTP source exceeds the configured redirect count.         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L65)  |
| `BLDV_057` | `SOURCE_DNS_RESOLUTION_FAILED` — Raised when a source hostname cannot be resolved before policy evaluation.  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L66)  |
| `BLDV_058` | `SOURCE_REQUEST_TIMED_OUT` — Raised when a bounded source request exceeds its deadline.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L67)  |
| `BLDV_059` | `GITHUB_REVISION_RESOLUTION_FAILED` — Raised when GitHub cannot resolve an exact revision archive.           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L68)  |
| `BLDV_060` | `GITHUB_RELEASE_ASSET_RESOLUTION_FAILED` — Raised when GitHub cannot resolve an exact release asset.         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L69)  |
| `BLDV_085` | `SOURCE_RESPONSE_READ_FAILED` — Raised when a successful source response body cannot be read safely.         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L94)  |
| `BLDV_092` | `SOURCE_REDIRECT_LOCATION_MISSING` — Raised when a redirect response omits a usable `Location` header.       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L101) |
| `BLDV_100` | `ARCHIVE_SOURCE_PROVIDER_INPUT_MISMATCH` — Raised when the archive provider receives another source variant. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L109) |
| `BLDV_101` | `FILE_SOURCE_PROVIDER_INPUT_MISMATCH` — Raised when the file provider receives another source variant.       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L110) |
| `BLDV_102` | `HTTP_SOURCE_PROVIDER_INPUT_MISMATCH` — Raised when the HTTP provider receives another source variant.       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L111) |
| `BLDV_103` | `GITHUB_SOURCE_PROVIDER_INPUT_MISMATCH` — Raised when the GitHub provider receives another source variant.   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L112) |
| `BLDV_136` | `GITHUB_COMMIT_SHA_MISSING` — GitHub returned no exact commit identifier.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L146) |
| `BLDV_137` | `GITHUB_RELEASE_ASSET_MISSING` — A GitHub release did not contain the requested named asset.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L148) |
| `BLDV_138` | `SOURCE_DNS_EMPTY` — DNS resolution completed without any IPv4 or IPv6 address.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L150) |
