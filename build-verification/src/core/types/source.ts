/** Archive encodings supported by the default source boundary. */
export type VerificationArchiveFormat = "tar" | "tarGzip" | "zip";

/** Supported source-code inputs for contract rebuilds. */
export type VerificationSource =
  | {
    readonly type: "archive";
    readonly bytes: Uint8Array;
    readonly name: string;
    readonly format?: VerificationArchiveFormat;
  }
  | { readonly type: "path"; readonly path: string }
  | {
    readonly type: "url";
    readonly url: string;
  }
  | {
    readonly type: "githubArchive";
    readonly owner: string;
    readonly repository: string;
    readonly revision: string;
    readonly format?: "tarGzip" | "zip";
  }
  | {
    readonly type: "githubReleaseAsset";
    readonly owner: string;
    readonly repository: string;
    readonly tag: string;
    readonly asset: string;
  };

/** Exact source material returned by a source provider. */
export type ResolvedVerificationSource =
  | {
    readonly content: "archive";
    readonly kind: VerificationSource["type"] | "metadataUrl";
    readonly bytes: Uint8Array;
    readonly name: string;
    readonly format: VerificationArchiveFormat;
    readonly requestedLocator?: string;
    readonly resolvedLocator?: string;
    readonly requestedRevision?: string;
    readonly resolvedRevision?: string;
    readonly contentType?: string;
    readonly retrievalPolicy?: import("@/core/policy/types.ts").PolicyDecision;
    readonly size: number;
    readonly sha256: string;
  }
  | {
    readonly content: "directory";
    readonly kind: "path";
    readonly path: string;
    readonly requestedLocator: string;
  };

/** Serializable source facts retained in verification evidence. */
export type VerificationSourceEvidence = {
  readonly kind: VerificationSource["type"] | "metadataUrl";
  readonly content: "archive" | "directory";
  readonly requestedLocator?: string;
  readonly resolvedLocator?: string;
  readonly requestedRevision?: string;
  readonly resolvedRevision?: string;
  readonly format?: VerificationArchiveFormat;
  readonly contentType?: string;
  readonly size?: number;
  readonly sha256?: string;
};
