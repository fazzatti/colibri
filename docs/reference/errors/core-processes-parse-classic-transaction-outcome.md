# core/processes/parse-classic-transaction-outcome

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                      | Source                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PCTO_000` | `UNEXPECTED_ERROR` — Raised when classic outcome parsing fails unexpectedly.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/parse-classic-transaction-outcome/error.ts#L6)  |
| `PCTO_001` | `UNEXPECTED_TRANSACTION_RESULT` — Raised when a successful RPC response has no successful result arm.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/parse-classic-transaction-outcome/error.ts#L7)  |
| `PCTO_002` | `UNEXPECTED_INNER_TRANSACTION_RESULT` — Raised when a successful fee bump contains no successful inner result. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/parse-classic-transaction-outcome/error.ts#L8)  |
| `PCTO_003` | `UNEXPECTED_OPERATION_RESULT` — Raised when an operation does not contain its protocol result payload.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/parse-classic-transaction-outcome/error.ts#L9)  |
| `PCTO_004` | `UNSUPPORTED_OPERATION_OUTCOME` — Raised when the SDK exposes an operation type unknown to this parser.        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/parse-classic-transaction-outcome/error.ts#L10) |
| `PCTO_005` | `UNSUCCESSFUL_OPERATION_OUTCOME` — Raised when an operation result is not its successful protocol arm.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/parse-classic-transaction-outcome/error.ts#L11) |
