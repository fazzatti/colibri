import type {
  PolicyCheck,
  PolicyDecision,
  SourceRetrievalFacts,
  SourceRetrievalPolicy,
} from "./types.ts";

/** Options controlling the default host-side source retrieval policy. */
export type DefaultSourceRetrievalPolicyOptions = {
  readonly allowHttp?: boolean;
  readonly allowPrivateNetwork?: boolean;
  readonly allowedHosts?: readonly string[];
};

/** Stable identifier of the default source retrieval policy. */
export const DEFAULT_SOURCE_RETRIEVAL_POLICY_ID = "colibri.https-public-source";

const isPrivateIpv4 = (address: string): boolean => {
  const values = address.split(".").map(Number);
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) return true;
  const [first, second] = values;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224;
};

const isPrivateAddress = (address: string): boolean => {
  if (address.includes(".")) {
    const mapped = address.toLowerCase().match(
      /(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/,
    );
    return isPrivateIpv4(mapped?.[1] ?? address);
  }
  const normalized = address.toLowerCase();
  try {
    new URL(`http://[${normalized}]/`);
  } catch {
    return true;
  }
  return normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
    normalized.startsWith("fea") || normalized.startsWith("feb") ||
    normalized.startsWith("ff") || normalized.startsWith("2001:db8:");
};

/** Evaluates URL, credential, redirect, and destination-address safety. */
export class DefaultSourceRetrievalPolicy implements SourceRetrievalPolicy {
  readonly #allowHttp: boolean;
  readonly #allowPrivateNetwork: boolean;
  readonly #allowedHosts: ReadonlySet<string>;

  /** Creates a policy with explicit local-development exceptions. */
  constructor(options: DefaultSourceRetrievalPolicyOptions = {}) {
    this.#allowHttp = options.allowHttp ?? false;
    this.#allowPrivateNetwork = options.allowPrivateNetwork ?? false;
    this.#allowedHosts = new Set(
      (options.allowedHosts ?? []).map((host) => host.toLowerCase()),
    );
  }

  /** Evaluates one request or redirect before its transport is opened. */
  evaluate(facts: SourceRetrievalFacts): PolicyDecision {
    let url: URL | undefined;
    try {
      url = new URL(facts.url);
    } catch {
      // Invalid URLs are represented as a rejected policy decision.
    }
    const protocol = url?.protocol === "https:" ||
      (url?.protocol === "http:" && this.#allowHttp);
    const credentials = !!url && !url.username && !url.password;
    const hostAllowed = !!url && (this.#allowPrivateNetwork ||
      this.#allowedHosts.has(url.hostname.toLowerCase()) ||
      facts.resolvedAddresses.every((address) => !isPrivateAddress(address)));
    const addressesPresent = !!url && facts.resolvedAddresses.length > 0;
    const checks: PolicyCheck[] = [
      { name: "absolute-url", passed: !!url },
      { name: "https-or-explicit-http", passed: !!protocol },
      { name: "no-embedded-credentials", passed: credentials },
      { name: "resolved-addresses", passed: addressesPresent },
      { name: "public-or-explicit-destination", passed: hostAllowed },
    ];
    const accepted = checks.every(({ passed }) => passed);
    return {
      accepted,
      policy: DEFAULT_SOURCE_RETRIEVAL_POLICY_ID,
      version: "1",
      checks,
      reasons: accepted ? [] : [
        "The source URL, credentials, scheme, or resolved destination is not permitted by the active retrieval policy.",
      ],
      warnings: facts.redirect > 0
        ? [`Source retrieval followed redirect ${facts.redirect}.`]
        : [],
    };
  }
}
