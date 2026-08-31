import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when no source can be derived or was supplied. */
export class MissingVerificationSourceError
  extends BuildVerificationError<Code.MISSING_VERIFICATION_SOURCE> {
  /** Creates a missing source error. */
  constructor() {
    super({
      code: Code.MISSING_VERIFICATION_SOURCE,
      source: "@colibri/build-verification/providers/source",
      message: "Missing verification source",
      details:
        "Provide an archive, path, URL, GitHub source, or source_uri in strict metadata.",
    });
  }
}

/** Raised when source bytes cannot be downloaded. */
export class SourceDownloadFailedError
  extends BuildVerificationError<Code.SOURCE_DOWNLOAD_FAILED> {
  /** Creates a source transport-status error. */
  constructor(url: string, cause: unknown, status?: number) {
    super({
      code: Code.SOURCE_DOWNLOAD_FAILED,
      source: "@colibri/build-verification/providers/source/http",
      message: "Failed to download verification source",
      details: "The source endpoint did not return a successful response.",
      data: { url, status },
      cause,
    });
  }
}

/** Raised when exact source bytes do not match the recipe commitment. */
export class SourceHashMismatchError
  extends BuildVerificationError<Code.SOURCE_HASH_MISMATCH> {
  /** Creates a source hash-mismatch error. */
  constructor(expected: string, actual: string) {
    super({
      code: Code.SOURCE_HASH_MISMATCH,
      source: "@colibri/build-verification/processes/resolve-source-archive",
      message: "Source archive hash mismatch",
      details:
        "The supplied or retrieved source archive is not the archive committed to by the build recipe.",
      data: { expected, actual },
    });
  }
}

/** Raised for a source form unsupported in the selected mode. */
export class UnsupportedSourceError
  extends BuildVerificationError<Code.UNSUPPORTED_SOURCE> {
  /** Creates an unsupported source error. */
  constructor(details: string, data: Readonly<Record<string, unknown>> = {}) {
    super({
      code: Code.UNSUPPORTED_SOURCE,
      source: "@colibri/build-verification/providers/source",
      message: "Unsupported verification source",
      details,
      data,
    });
  }
}

/** Raised when an existing local source archive cannot be read. */
export class LocalSourceArchiveReadFailedError
  extends BuildVerificationError<Code.LOCAL_SOURCE_ARCHIVE_READ_FAILED> {
  /** Creates a local source-read error. */
  constructor(path: string, cause: unknown) {
    super({
      code: Code.LOCAL_SOURCE_ARCHIVE_READ_FAILED,
      source: "@colibri/build-verification/providers/source/file",
      message: "Failed to read local source archive",
      details:
        "The selected local archive exists but its bytes could not be read.",
      data: { path },
      cause,
    });
  }
}

/** Raised when a source retrieval policy rejects a request or redirect. */
export class SourcePolicyRejectedError
  extends BuildVerificationError<Code.SOURCE_POLICY_REJECTED> {
  /** Creates a source-policy rejection error. */
  constructor(url: string, reasons: readonly string[]) {
    super({
      code: Code.SOURCE_POLICY_REJECTED,
      source: "@colibri/build-verification/providers/source/http",
      message: "Source retrieval rejected by policy",
      details: reasons.join(" ") || "The source request was not accepted.",
      data: { url, reasons },
    });
  }
}

/** Raised when an HTTP source exceeds the configured redirect count. */
export class SourceRedirectLimitExceededError
  extends BuildVerificationError<Code.SOURCE_REDIRECT_LIMIT_EXCEEDED> {
  /** Creates a redirect-limit error. */
  constructor(url: string, maximum: number) {
    super({
      code: Code.SOURCE_REDIRECT_LIMIT_EXCEEDED,
      source: "@colibri/build-verification/providers/source/http",
      message: "Source redirect limit exceeded",
      details: "The source request exceeded its bounded redirect policy.",
      data: { url, maximum },
    });
  }
}

/** Raised when a source hostname cannot be resolved before policy evaluation. */
export class SourceDnsResolutionFailedError
  extends BuildVerificationError<Code.SOURCE_DNS_RESOLUTION_FAILED> {
  /** Creates a DNS-resolution error. */
  constructor(hostname: string, cause: unknown) {
    super({
      code: Code.SOURCE_DNS_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/source/http",
      message: "Failed to resolve source hostname",
      details:
        "The source hostname could not be resolved for address-policy enforcement.",
      data: { hostname },
      cause,
    });
  }
}

/** Raised when a bounded source request exceeds its deadline. */
export class SourceRequestTimedOutError
  extends BuildVerificationError<Code.SOURCE_REQUEST_TIMED_OUT> {
  /** Creates a source timeout error. */
  constructor(url: string, timeoutMs: number) {
    super({
      code: Code.SOURCE_REQUEST_TIMED_OUT,
      source: "@colibri/build-verification/providers/source/http",
      message: "Source request timed out",
      details:
        "The source endpoint did not complete within the configured timeout.",
      data: { url, timeoutMs },
    });
  }
}

/** Raised when a successful source response body cannot be read safely. */
export class SourceResponseReadFailedError
  extends BuildVerificationError<Code.SOURCE_RESPONSE_READ_FAILED> {
  /** Creates a bounded response-read error. */
  constructor(url: string, cause: unknown) {
    super({
      code: Code.SOURCE_RESPONSE_READ_FAILED,
      source: "@colibri/build-verification/providers/source/http",
      message: "Failed to read source response",
      details:
        "The successful source response body could not be read within limits.",
      data: { url },
      cause,
    });
  }
}

/** Raised when a redirect response omits a usable `Location` header. */
export class SourceRedirectLocationMissingError
  extends BuildVerificationError<Code.SOURCE_REDIRECT_LOCATION_MISSING> {
  /** Creates a malformed redirect error. */
  constructor(url: string, status: number) {
    super({
      code: Code.SOURCE_REDIRECT_LOCATION_MISSING,
      source: "@colibri/build-verification/providers/source/http",
      message: "Source redirect is missing a location",
      details:
        "A redirect response did not identify its next absolute or relative URL.",
      data: { url, status },
    });
  }
}

/** Raised when GitHub cannot resolve an exact revision archive. */
export class GitHubRevisionResolutionFailedError
  extends BuildVerificationError<Code.GITHUB_REVISION_RESOLUTION_FAILED> {
  /** Creates a GitHub revision-resolution error. */
  constructor(repository: string, revision: string, cause: unknown) {
    super({
      code: Code.GITHUB_REVISION_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/source/github",
      message: "Failed to resolve GitHub revision source",
      details:
        "GitHub did not resolve or return the requested revision archive.",
      data: { repository, revision },
      cause,
    });
  }
}

/** Raised when GitHub cannot resolve an exact release asset. */
export class GitHubReleaseAssetResolutionFailedError
  extends BuildVerificationError<Code.GITHUB_RELEASE_ASSET_RESOLUTION_FAILED> {
  /** Creates a GitHub release-asset error. */
  constructor(repository: string, tag: string, asset: string, cause: unknown) {
    super({
      code: Code.GITHUB_RELEASE_ASSET_RESOLUTION_FAILED,
      source: "@colibri/build-verification/providers/source/github",
      message: "Failed to resolve GitHub release asset",
      details:
        "GitHub did not resolve or return the exact named release asset.",
      data: { repository, tag, asset },
      cause,
    });
  }
}
