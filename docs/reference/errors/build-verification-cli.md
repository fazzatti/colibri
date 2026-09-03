# build-verification/cli

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                          | Source                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `BLDV_106` | `CLI_POSITIONAL_ARGUMENT_UNSUPPORTED` — Raised when the CLI receives an unsupported positional argument.           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L115) |
| `BLDV_107` | `CLI_UNKNOWN_FLAG` — Raised when the CLI receives an unknown named flag.                                           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L116) |
| `BLDV_108` | `CLI_DUPLICATE_FLAG` — Raised when one CLI flag is repeated.                                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L117) |
| `BLDV_109` | `CLI_FLAG_VALUE_MISSING` — Raised when a value-bearing CLI flag has no value.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L118) |
| `BLDV_110` | `CLI_HELP_CONFLICT` — Raised when help is combined with an executable option.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L119) |
| `BLDV_111` | `CLI_LOG_FORMAT_INVALID` — Raised when the requested CLI log format is unsupported.                                | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L120) |
| `BLDV_112` | `CLI_LOG_FORMAT_REQUIRES_LOGS` — Raised when a log format is selected without a log destination.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L121) |
| `BLDV_113` | `CLI_TARGET_SELECTION_INVALID` — Raised when the CLI target flags do not identify exactly one target.              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L122) |
| `BLDV_114` | `CLI_TARGET_FILE_READ_FAILED` — Raised when a local Wasm target cannot be read.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L123) |
| `BLDV_115` | `CLI_NETWORK_CONFIGURATION_CONFLICT` — Raised when preset and granular network flags are combined.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L124) |
| `BLDV_116` | `CLI_NETWORK_PRESET_INVALID` — Raised when a network preset is not supported.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L125) |
| `BLDV_117` | `CLI_NETWORK_CONFIGURATION_INCOMPLETE` — Raised when granular RPC configuration is incomplete.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L126) |
| `BLDV_118` | `CLI_ALLOW_HTTP_REQUIRES_NETWORK` — Raised when HTTP permission is requested without a granular RPC URL.           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L127) |
| `BLDV_119` | `CLI_SOURCE_SELECTION_INVALID` — Raised when multiple source groups are selected.                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L128) |
| `BLDV_120` | `CLI_GITHUB_SOURCE_INCOMPLETE` — Raised when a GitHub source omits its owner or repository.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L129) |
| `BLDV_121` | `CLI_GITHUB_REVISION_CONFLICT` — Raised when GitHub revision and release flags are mixed.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L130) |
| `BLDV_122` | `CLI_GITHUB_FORMAT_INVALID` — Raised when the selected GitHub archive format is unsupported.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L131) |
| `BLDV_123` | `CLI_GITHUB_RELEASE_INVALID` — Raised when GitHub release flags do not form one complete source.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L132) |
| `BLDV_124` | `CLI_OUT_OF_BAND_SOURCE_REQUIRED` — Raised when out-of-band mode has no caller-supplied source.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L133) |
| `BLDV_125` | `CLI_RECIPE_FILE_READ_FAILED` — Raised when an out-of-band recipe file cannot be read.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L134) |
| `BLDV_126` | `CLI_RECIPE_JSON_INVALID` — Raised when an out-of-band recipe is not valid JSON.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L135) |
| `BLDV_127` | `CLI_ENVIRONMENT_READ_FAILED` — Raised when the CLI cannot read an explicitly selected environment value.          | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L136) |
| `BLDV_128` | `CLI_ENVIRONMENT_VALUE_MISSING` — Raised when an explicitly selected environment value is absent.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L137) |
| `BLDV_129` | `CLI_GITHUB_TOKEN_SOURCE_REQUIRED` — Raised when a GitHub token is configured without a GitHub source.             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L138) |
| `BLDV_130` | `CLI_UNEXPECTED_FAILURE` — Raised when an unexpected value escapes the CLI boundary.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L139) |
| `BLDV_131` | `CLI_RUNTIME_INITIALIZATION_FAILED` — Raised when the default verifier runtime cannot be loaded or initialized.    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L140) |
| `BLDV_134` | `CLI_EXTERNAL_REFERENCE_INCOMPLETE` — Raised when external-reference target flags do not form one complete target. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L143) |
| `BLDV_135` | `CLI_EXTERNAL_REFERENCE_TAG_INVALID` — Raised when an external-reference tag is not valid base64.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L144) |
