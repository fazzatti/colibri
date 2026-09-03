# build-verification/providers/image

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                         | Source                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BLDV_016` | `INVALID_IMAGE_REFERENCE` — Raised when a build image is not a fully qualified digest reference.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L26)  |
| `BLDV_018` | `IMAGE_MANIFEST_RESOLUTION_FAILED` — Raised when the pinned OCI manifest cannot be resolved.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L28)  |
| `BLDV_019` | `MULTI_ARCH_IMAGE` — Raised when a digest points to a multi-platform image index.                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L29)  |
| `BLDV_068` | `IMAGE_CONFIG_RESOLUTION_FAILED` — Raised when an image-config blob cannot be resolved or decoded.                | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L77)  |
| `BLDV_069` | `IMAGE_REFERRERS_RESOLUTION_FAILED` — Raised when OCI referrer discovery fails.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L78)  |
| `BLDV_070` | `IMAGE_ATTESTATION_DECODING_FAILED` — Raised when an observed attestation cannot be decoded.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L79)  |
| `BLDV_071` | `IMAGE_TOOLCHAIN_MISSING` — Raised when the approved image does not declare a pinned Rust toolchain.              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L80)  |
| `BLDV_089` | `IMAGE_MANIFEST_DIGEST_MISMATCH` — Raised when a resolved manifest's bytes do not match its requested digest.     | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L98)  |
| `BLDV_090` | `IMAGE_CONFIG_DIGEST_MISMATCH` — Raised when image-config bytes differ from their descriptor digest.              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L99)  |
| `BLDV_091` | `IMAGE_REFERRER_DIGEST_MISMATCH` — Raised when referrer content differs from its descriptor digest.               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L100) |
| `BLDV_104` | `IMAGE_AUTHENTICATION_CHALLENGE_INVALID` — Raised when an OCI Bearer challenge does not contain a safe token URL. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L113) |
| `BLDV_105` | `IMAGE_REGISTRY_REQUEST_REJECTED` — Raised when host retrieval policy blocks a registry or token request.         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L114) |
