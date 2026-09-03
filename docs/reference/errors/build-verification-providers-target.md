# build-verification/providers/target

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                     | Source                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BLDV_001` | `MISSING_TARGET_NETWORK` — Raised when a network-backed target lacks network configuration.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L11)  |
| `BLDV_002` | `TARGET_RESOLUTION_FAILED` — Compatibility error for a general Stellar RPC target-resolution failure.         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L12)  |
| `BLDV_042` | `TARGET_RPC_INITIALIZATION_FAILED` — Raised when network inputs cannot initialize a target RPC reader.        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L51)  |
| `BLDV_049` | `TARGET_HASH_MISMATCH` — Raised when a requested Wasm hash differs from RPC's returned code hash.             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L58)  |
| `BLDV_050` | `TARGET_INSTANCE_LOOKUP_FAILED` — Raised when a contract-instance lookup fails.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L59)  |
| `BLDV_051` | `TARGET_CODE_LOOKUP_FAILED` — Raised when a contract-code lookup fails after the target is known.             | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L60)  |
| `BLDV_052` | `TARGET_PROVIDER_UNEXPECTED` — Raised when a target provider throws an untyped value unexpectedly.            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L61)  |
| `BLDV_133` | `TARGET_EXTERNAL_REFERENCE_LOOKUP_FAILED` — Raised when an owner/tag executable reference cannot be resolved. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L142) |
