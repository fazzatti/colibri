import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when a build image is not a fully qualified digest reference. */
export class InvalidImageReferenceError
  extends BuildVerificationError<Code.INVALID_IMAGE_REFERENCE> {
  /** Creates an invalid image-reference error. */
  constructor(reference: string) {
    super({
      code: Code.INVALID_IMAGE_REFERENCE,
      source: "@colibri/build-verification/providers/image",
      message: "Invalid build image reference",
      details: "Build images must use an explicit registry and sha256 digest.",
      data: { reference },
    });
  }
}

/** Raised when the pinned OCI manifest cannot be resolved. */
export class ImageManifestResolutionFailedError
  extends BuildVerificationError<Code.IMAGE_MANIFEST_RESOLUTION_FAILED> {
  /** Creates a manifest transport or decoding error. */
  constructor(reference: string, cause: unknown, status?: number) {
    super({
      code: Code.IMAGE_MANIFEST_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Failed to resolve build image manifest",
      details: "The registry did not return the pinned OCI/Docker manifest.",
      data: { reference, status },
      cause,
    });
  }
}

/** Raised when a resolved manifest's bytes do not match its requested digest. */
export class ImageManifestDigestMismatchError
  extends BuildVerificationError<Code.IMAGE_MANIFEST_DIGEST_MISMATCH> {
  /** Creates a manifest digest-mismatch error. */
  constructor(reference: string, expected: string, actual: string) {
    super({
      code: Code.IMAGE_MANIFEST_DIGEST_MISMATCH,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Build image manifest digest mismatch",
      details: "The registry manifest bytes do not match the requested digest.",
      data: { reference, expected, actual },
    });
  }
}

/** Raised when a digest points to a multi-platform image index. */
export class MultiArchImageError
  extends BuildVerificationError<Code.MULTI_ARCH_IMAGE> {
  /** Creates a multi-architecture image error. */
  constructor(reference: string, mediaType: string) {
    super({
      code: Code.MULTI_ARCH_IMAGE,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Multi-architecture image is not reproducible",
      details: "The selected image must be one concrete platform manifest.",
      data: { reference, mediaType },
    });
  }
}

/** Raised when an image-config blob cannot be resolved or decoded. */
export class ImageConfigResolutionFailedError
  extends BuildVerificationError<Code.IMAGE_CONFIG_RESOLUTION_FAILED> {
  /** Creates an image-config resolution error. */
  constructor(reference: string, cause: unknown, status?: number) {
    super({
      code: Code.IMAGE_CONFIG_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Failed to resolve build image configuration",
      details: "The selected manifest's image configuration could not be read.",
      data: { reference, status },
      cause,
    });
  }
}

/** Raised when image-config bytes differ from their descriptor digest. */
export class ImageConfigDigestMismatchError
  extends BuildVerificationError<Code.IMAGE_CONFIG_DIGEST_MISMATCH> {
  /** Creates an image-config digest mismatch error. */
  constructor(expected: string, actual: string) {
    super({
      code: Code.IMAGE_CONFIG_DIGEST_MISMATCH,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Build image configuration digest mismatch",
      details:
        "The downloaded image configuration does not match its descriptor.",
      data: { expected, actual },
    });
  }
}

/** Raised when OCI referrer discovery fails. */
export class ImageReferrersResolutionFailedError
  extends BuildVerificationError<Code.IMAGE_REFERRERS_RESOLUTION_FAILED> {
  /** Creates a referrer resolution error. */
  constructor(reference: string, cause: unknown, status?: number) {
    super({
      code: Code.IMAGE_REFERRERS_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Failed to resolve image attestations",
      details:
        "The registry's OCI referrer records could not be resolved safely.",
      data: { reference, status },
      cause,
    });
  }
}

/** Raised when referrer content differs from its descriptor digest. */
export class ImageReferrerDigestMismatchError
  extends BuildVerificationError<Code.IMAGE_REFERRER_DIGEST_MISMATCH> {
  /** Creates a referrer digest mismatch error. */
  constructor(expected: string, actual: string) {
    super({
      code: Code.IMAGE_REFERRER_DIGEST_MISMATCH,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Image attestation digest mismatch",
      details: "Downloaded OCI referrer content does not match its descriptor.",
      data: { expected, actual },
    });
  }
}

/** Raised when an observed attestation cannot be decoded. */
export class ImageAttestationDecodingFailedError
  extends BuildVerificationError<Code.IMAGE_ATTESTATION_DECODING_FAILED> {
  /** Creates an attestation decoding error. */
  constructor(digest: string, cause: unknown) {
    super({
      code: Code.IMAGE_ATTESTATION_DECODING_FAILED,
      source: "@colibri/build-verification/providers/image/oci",
      message: "Failed to decode image attestation",
      details: "An OCI provenance or SBOM payload was present but malformed.",
      data: { digest },
      cause,
    });
  }
}

/** Raised when the approved image does not declare a pinned Rust toolchain. */
export class ImageToolchainMissingError
  extends BuildVerificationError<Code.IMAGE_TOOLCHAIN_MISSING> {
  /** Creates a missing image toolchain error. */
  constructor(reference: string) {
    super({
      code: Code.IMAGE_TOOLCHAIN_MISSING,
      source: "@colibri/build-verification/processes/resolve-build-image",
      message: "Build image does not pin RUSTUP_TOOLCHAIN",
      details:
        "The approved image configuration must declare RUSTUP_TOOLCHAIN so source-local toolchain selectors cannot replace it.",
      data: { reference },
    });
  }
}
