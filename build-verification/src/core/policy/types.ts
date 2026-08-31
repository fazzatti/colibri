/** JSON-safe scalar or nested value used by logs and evidence. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** One named check made by a verification policy. */
export type PolicyCheck = {
  readonly name: string;
  readonly passed: boolean;
  readonly observed?: JsonValue;
};

/** Structured, serializable decision returned by every policy. */
export type PolicyDecision = {
  readonly accepted: boolean;
  readonly policy: string;
  readonly version: string;
  readonly checks: readonly PolicyCheck[];
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
};

/** Parsed provenance facts attached to a resolved OCI image. */
export type ContainerImageProvenance = {
  readonly present: boolean;
  readonly parsed: boolean;
  readonly signatureVerified: boolean;
  readonly predicateTypes: readonly string[];
  readonly subjectDigests: readonly string[];
  readonly sourceRepositories: readonly string[];
};

/** Parsed software-bill-of-materials facts attached to an OCI image. */
export type ContainerImageSbom = {
  readonly present: boolean;
  readonly formats: readonly string[];
};

/** One OCI referrer observed for a resolved image manifest. */
export type ContainerImageReferrer = {
  readonly digest: string;
  readonly mediaType: string;
  readonly artifactType?: string;
  readonly annotations: Readonly<Record<string, string>>;
};

/** Digest-pinned image reference facts available without registry I/O. */
export type ContainerImageReference = {
  readonly reference: string;
  readonly registry: string;
  readonly repository: string;
  readonly digest: string;
};

/** Image facts resolved before an image policy makes its decision. */
export type ContainerImageDetails = {
  readonly reference: string;
  readonly registry: string;
  readonly repository: string;
  readonly requestedDigest: string;
  readonly manifestDigest: string;
  readonly manifestMediaType: string;
  readonly resolvedThroughIndex: boolean;
  readonly architecture?: string;
  readonly os?: string;
  readonly configDigest?: string;
  readonly entrypoint?: readonly string[];
  readonly workingDirectory?: string;
  readonly environment: readonly string[];
  readonly user?: string;
  readonly rustupToolchain?: string;
  readonly referrers: readonly ContainerImageReferrer[];
  readonly provenance: ContainerImageProvenance;
  readonly sbom: ContainerImageSbom;
};

/** Policy boundary used to accept or reject one resolved container image. */
export interface ContainerImagePolicy {
  /** Evaluates reference trust roots before any registry request is made. */
  evaluateReference(
    reference: ContainerImageReference,
  ): PolicyDecision | Promise<PolicyDecision>;
  /** Evaluates resolved facts without performing registry or Docker I/O. */
  evaluate(
    details: ContainerImageDetails,
  ): PolicyDecision | Promise<PolicyDecision>;
}

/** Policy boundary used to approve an ordered build command. */
export interface BuildCommandPolicy {
  /** Evaluates the effective entrypoint argument vector. */
  evaluate(
    arguments_: readonly string[],
  ): PolicyDecision | Promise<PolicyDecision>;
}

/** Policy boundary used to approve complete build-option arguments. */
export interface BuildOptionPolicy {
  /** Evaluates options in the context of the approved build command. */
  evaluate(
    options: readonly string[],
    arguments_: readonly string[],
  ): PolicyDecision | Promise<PolicyDecision>;
}

/** Facts evaluated before an HTTP source request or redirect is followed. */
export type SourceRetrievalFacts = {
  readonly url: string;
  readonly redirect: number;
  readonly resolvedAddresses: readonly string[];
};

/** Policy boundary used to approve host-side source retrieval. */
export interface SourceRetrievalPolicy {
  /** Evaluates a URL and its resolved addresses before transport I/O. */
  evaluate(
    facts: SourceRetrievalFacts,
  ): PolicyDecision | Promise<PolicyDecision>;
}

/** Composite policy set used by the default verification pipeline. */
export type VerificationPolicy = {
  readonly image: ContainerImagePolicy;
  readonly command: BuildCommandPolicy;
  readonly options: BuildOptionPolicy;
  readonly source: SourceRetrievalPolicy;
};
