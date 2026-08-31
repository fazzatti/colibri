import type {
  ContainerImageDetails,
  ContainerImagePolicy,
  ContainerImageReference,
  PolicyCheck,
  PolicyDecision,
} from "@/core/policy/types.ts";

/** Trust roots used by the default official Stellar image policy. */
export type OfficialStellarImagePolicyOptions = {
  readonly registry?: string;
  readonly repository?: string;
  readonly sourceRepository?: string;
};

/** Stable identifier of the official Stellar CLI image policy. */
export const OFFICIAL_STELLAR_IMAGE_POLICY_ID =
  "colibri.official-stellar-cli-image";

const normalizeRepository = (value: string): string =>
  value.toLowerCase().replace(/\/$/, "");

/** Evaluates digest-pinned images against explicit official trust roots. */
export class OfficialStellarImagePolicy implements ContainerImagePolicy {
  readonly #registry: string;
  readonly #repository: string;
  readonly #sourceRepository: string;

  /** Creates a policy with configurable image and source trust roots. */
  constructor(options: OfficialStellarImagePolicyOptions = {}) {
    this.#registry = options.registry ?? "docker.io";
    this.#repository = options.repository ?? "stellar/stellar-cli";
    this.#sourceRepository = normalizeRepository(
      options.sourceRepository ??
        "https://github.com/stellar/stellar-cli-docker",
    );
  }

  /** Rejects untrusted registries and repositories before registry I/O. */
  evaluateReference(reference: ContainerImageReference): PolicyDecision {
    const checks: PolicyCheck[] = [
      {
        name: "image-trust-root",
        passed: reference.registry === this.#registry &&
          reference.repository === this.#repository,
      },
      {
        name: "digest-pinned",
        passed: /^sha256:[0-9a-f]{64}$/.test(reference.digest),
      },
    ];
    const accepted = checks.every(({ passed }) => passed);
    return {
      accepted,
      policy: OFFICIAL_STELLAR_IMAGE_POLICY_ID,
      version: "1",
      checks,
      reasons: accepted ? [] : [
        "The image reference does not satisfy the configured official Stellar CLI trust root.",
      ],
      warnings: [],
    };
  }

  /** Evaluates already resolved OCI, runtime, provenance, and SBOM facts. */
  evaluate(details: ContainerImageDetails): PolicyDecision {
    const referenceDecision = this.evaluateReference({
      reference: details.reference,
      registry: details.registry,
      repository: details.repository,
      digest: details.requestedDigest,
    });
    const digestResolved = details.requestedDigest === details.manifestDigest;
    const singlePlatform = !details.resolvedThroughIndex &&
      !!details.architecture && !!details.os;
    const entrypoint = details.entrypoint?.length === 1 &&
      details.entrypoint[0] === "stellar";
    const workingDirectory = details.workingDirectory === "/source";
    const provenanceParsed = !details.provenance.present ||
      details.provenance.parsed;
    const normalizedSubjects = details.provenance.subjectDigests.map((value) =>
      value.startsWith("sha256:") ? value : `sha256:${value}`
    );
    const provenanceSubject = !details.provenance.present ||
      normalizedSubjects.includes(details.manifestDigest);
    const provenanceSource = !details.provenance.present ||
      details.provenance.sourceRepositories.some((value) =>
        normalizeRepository(value) === this.#sourceRepository
      );
    const checks: PolicyCheck[] = [
      ...referenceDecision.checks,
      { name: "digest-resolved", passed: digestResolved },
      { name: "single-platform-manifest", passed: singlePlatform },
      { name: "stellar-entrypoint", passed: entrypoint },
      { name: "source-workdir", passed: workingDirectory },
      { name: "provenance-parsed", passed: provenanceParsed },
      { name: "provenance-subject", passed: provenanceSubject },
      { name: "provenance-source", passed: provenanceSource },
    ];
    const accepted = checks.every(({ passed }) => passed);
    const warnings = [
      ...(!details.provenance.present
        ? ["No OCI provenance referrer was observed for the selected manifest."]
        : []),
      ...(details.provenance.present && !details.provenance.signatureVerified
        ? [
          "OCI provenance was observed and parsed, but its signature was not cryptographically verified by this package.",
        ]
        : []),
      ...(!details.sbom.present
        ? ["No OCI SBOM referrer was observed for the selected manifest."]
        : []),
    ];
    return {
      accepted,
      policy: OFFICIAL_STELLAR_IMAGE_POLICY_ID,
      version: "1",
      checks,
      reasons: accepted ? [] : [
        "The resolved image does not satisfy the configured official Stellar CLI trust and runtime contract.",
      ],
      warnings,
    };
  }
}
