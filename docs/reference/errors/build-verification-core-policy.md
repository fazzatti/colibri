# build-verification/core/policy

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                | Source                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BLDV_017` | `IMAGE_POLICY_REJECTED` — Raised when a configured image policy rejects resolved image facts.            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L27)  |
| `BLDV_053` | `COMMAND_POLICY_REJECTED` — Raised when a command policy rejects producer-controlled arguments.          | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L62)  |
| `BLDV_054` | `OPTION_POLICY_REJECTED` — Raised when an option policy rejects producer-controlled arguments.           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L63)  |
| `BLDV_099` | `IMAGE_REFERENCE_POLICY_REJECTED` — Raised before I/O when an image reference violates its trust policy. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L108) |
