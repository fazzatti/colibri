import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { connect as connectTls } from "node:tls";
import type {
  ClientRequest,
  IncomingHttpHeaders,
  RequestOptions,
} from "node:http";

type PinnedSourceRequestOptions = RequestOptions & {
  readonly servername?: string;
};
import { ArchiveLimitExceededError } from "../../archive/error.ts";
import { detectArchiveFormat } from "../../archive/detect.ts";
import { sha256Hex } from "../../core/comparison/compare-wasm.ts";
import type { ResolvedVerificationSource } from "../../core/types/index.ts";
import type { VerificationSourceProvider } from "./types.ts";
import type {
  HttpVerificationSourceProviderOptions,
  SourceAddressResolver,
  SourceHttpResponse,
  SourceHttpTransport,
  SourceHttpTransportInput,
  VerificationSourceProviderInput,
} from "./types.ts";
import { BuildVerificationError } from "../../error/base.ts";
import {
  SourceDnsResolutionFailedError,
  SourceDownloadFailedError,
  SourcePolicyRejectedError,
  SourceRedirectLimitExceededError,
  SourceRedirectLocationMissingError,
  SourceRequestTimedOutError,
  SourceResponseReadFailedError,
} from "./error.ts";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Removes embedded URL credentials before a locator reaches errors/evidence. */
export const redactSourceUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        /^(?:sig|jwt)$/i.test(key) ||
        /(?:^|[_-])(?:token|key|auth|signature|secret|credential)(?:$|[_-])/i
          .test(key)
      ) {
        url.searchParams.set(key, "<redacted>");
      }
    }
    return url.toString();
  } catch {
    return "<invalid-url>";
  }
};

const stripIpv6Brackets = (hostname: string): string =>
  hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

const tlsServerName = (hostname: string): string | undefined => {
  const normalized = stripIpv6Brackets(hostname);
  return isIP(normalized) === 0 ? normalized : undefined;
};

/** Default DNS resolver used before each request and redirect. */
export class DenoSourceAddressResolver implements SourceAddressResolver {
  /** Resolves literal, IPv4, and IPv6 destinations without retaining DNS state. */
  async resolve(hostname: string): Promise<readonly string[]> {
    const normalized = stripIpv6Brackets(hostname);
    if (isIP(normalized)) return [normalized];
    try {
      const [ipv4, ipv6] = await Promise.all([
        Deno.resolveDns(normalized, "A").catch(() => [] as string[]),
        Deno.resolveDns(normalized, "AAAA").catch(() => [] as string[]),
      ]);
      const addresses = [...new Set([...ipv4, ...ipv6])];
      if (addresses.length === 0) throw new Error("No A or AAAA records");
      return addresses;
    } catch (cause) {
      throw new SourceDnsResolutionFailedError(normalized, cause);
    }
  }
}

/** Normalizes Node response headers into stable lowercase string values. */
export const normalizeSourceResponseHeaders = (
  headers: IncomingHttpHeaders,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [[key.toLowerCase(), Array.isArray(value) ? value.join(", ") : value]]
    ),
  );

/** Builds the direct-IP request options while preserving HTTP and TLS identity. */
export const buildPinnedSourceRequestOptions = (
  input: SourceHttpTransportInput,
  address: string,
): {
  readonly useHttps: boolean;
  readonly options: PinnedSourceRequestOptions;
} => {
  const url = new URL(input.url);
  const useHttps = url.protocol === "https:";
  const headers = Object.fromEntries(
    Object.entries(input.headers).filter(([name]) =>
      name.toLowerCase() !== "host"
    ),
  );
  headers.host = url.host;
  return {
    useHttps,
    options: {
      protocol: url.protocol,
      hostname: useHttps
        ? stripIpv6Brackets(url.hostname)
        : stripIpv6Brackets(address),
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers,
      ...(useHttps && tlsServerName(url.hostname)
        ? { servername: tlsServerName(url.hostname) }
        : {}),
    },
  };
};

/** Collects a streamed source response without exceeding its byte limit. */
export const collectBoundedSourceResponse = async (
  chunks: AsyncIterable<Uint8Array>,
  maximum: number,
): Promise<Uint8Array> => {
  const collected: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of chunks) {
    const bytes = new Uint8Array(chunk);
    total += bytes.length;
    if (total > maximum) {
      throw new ArchiveLimitExceededError("archive byte", total, maximum);
    }
    collected.push(Uint8Array.from(bytes));
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of collected) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const requestAtAddress = (
  input: SourceHttpTransportInput,
  address: string,
): Promise<SourceHttpResponse> =>
  new Promise((resolve, reject) => {
    const { useHttps, options } = buildPinnedSourceRequestOptions(
      input,
      address,
    );
    const requester = useHttps ? httpsRequest : httpRequest;
    const requestOptions: PinnedSourceRequestOptions = useHttps
      ? {
        ...options,
        createConnection: () => {
          const url = new URL(input.url);
          return connectTls({
            host: stripIpv6Brackets(address),
            port: Number(url.port || 443),
            servername: tlsServerName(url.hostname),
          });
        },
      }
      : options;
    let timedOut = false;
    const request: ClientRequest = requester(
      requestOptions,
      async (response) => {
        try {
          const headers = normalizeSourceResponseHeaders(response.headers);
          const status = response.statusCode!;
          const declared = Number(headers["content-length"]);
          if (Number.isFinite(declared) && declared > input.maxBytes) {
            const error = new ArchiveLimitExceededError(
              "archive byte",
              declared,
              input.maxBytes,
            );
            reject(error);
            response.destroy();
            return;
          }
          if (REDIRECT_STATUSES.has(status)) {
            response.resume();
            resolve({
              status,
              headers,
              bytes: new Uint8Array(),
            });
            return;
          }
          const bytes = await collectBoundedSourceResponse(
            response,
            input.maxBytes,
          );
          resolve({ status, headers, bytes });
        } catch (cause) {
          if (cause instanceof ArchiveLimitExceededError) response.destroy();
          reject(cause);
        }
      },
    );
    request.setTimeout(input.timeoutMs, () => {
      timedOut = true;
      request.destroy(new Error("source request timed out"));
    });
    request.on("error", (cause) => {
      reject(
        timedOut
          ? new SourceRequestTimedOutError(
            redactSourceUrl(input.url),
            input.timeoutMs,
          )
          : cause,
      );
    });
    request.end();
  });

/** Node-compatible transport that pins every request to approved DNS results. */
export class PinnedAddressHttpTransport implements SourceHttpTransport {
  /** Tries approved addresses in order without performing another DNS lookup. */
  async request(input: SourceHttpTransportInput): Promise<SourceHttpResponse> {
    let lastError: unknown;
    for (const address of input.approvedAddresses) {
      try {
        return await requestAtAddress(input, address);
      } catch (cause) {
        if (
          cause instanceof ArchiveLimitExceededError ||
          cause instanceof SourceRequestTimedOutError
        ) throw cause;
        lastError = cause;
      }
    }
    throw new SourceDownloadFailedError(
      redactSourceUrl(input.url),
      lastError ?? new Error("No approved source address was available"),
    );
  }
}

/** Result returned by a policy-checked, DNS-pinned HTTP retrieval. */
export type PinnedHttpResource = {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly bytes: Uint8Array;
  readonly policy: import("../../core/policy/types.ts").PolicyDecision;
};

/** Retrieves bytes while revalidating policy and DNS pinning per redirect. */
export const retrievePinnedHttpResource = async (args: {
  readonly url: string;
  readonly limits: VerificationSourceProviderInput["limits"];
  readonly policy: HttpVerificationSourceProviderOptions["policy"];
  readonly transport: SourceHttpTransport;
  readonly addressResolver: SourceAddressResolver;
  readonly headers?:
    | Readonly<Record<string, string>>
    | ((url: URL) => Readonly<Record<string, string>>);
  readonly maxBytes?: number;
}): Promise<PinnedHttpResource> => {
  const requested = redactSourceUrl(args.url);
  const retrieve = async (
    current: string,
    redirect: number,
  ): Promise<PinnedHttpResource> => {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch (cause) {
      throw new SourceDownloadFailedError(requested, cause);
    }
    const addresses = await args.addressResolver.resolve(parsed.hostname);
    const policyDecision = await args.policy.evaluate({
      url: current,
      redirect,
      resolvedAddresses: addresses,
    });
    if (!policyDecision.accepted) {
      throw new SourcePolicyRejectedError(
        redactSourceUrl(current),
        policyDecision.reasons,
      );
    }
    let response: SourceHttpResponse;
    try {
      response = await args.transport.request({
        url: current,
        headers: typeof args.headers === "function"
          ? args.headers(parsed)
          : args.headers ?? {},
        approvedAddresses: addresses,
        timeoutMs: args.limits.downloadTimeoutMs,
        maxBytes: args.maxBytes ?? args.limits.maxArchiveBytes,
      });
    } catch (cause) {
      if (cause instanceof BuildVerificationError) throw cause;
      throw new SourceDownloadFailedError(redactSourceUrl(current), cause);
    }
    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirect === args.limits.maxRedirects) {
        throw new SourceRedirectLimitExceededError(
          redactSourceUrl(current),
          args.limits.maxRedirects,
        );
      }
      const location = response.headers.location;
      if (!location) {
        throw new SourceRedirectLocationMissingError(
          redactSourceUrl(current),
          response.status,
        );
      }
      return await retrieve(
        new URL(location, current).toString(),
        redirect + 1,
      );
    }
    if (response.status < 200 || response.status >= 300) {
      throw new SourceDownloadFailedError(
        redactSourceUrl(current),
        undefined,
        response.status,
      );
    }
    return {
      requestedUrl: requested,
      finalUrl: redactSourceUrl(current),
      status: response.status,
      headers: response.headers,
      bytes: response.bytes,
      policy: policyDecision,
    };
  };
  return await retrieve(args.url, 0);
};

/** HTTP source provider with redirect revalidation and DNS-pinned transport. */
export class HttpVerificationSourceProvider
  implements VerificationSourceProvider {
  readonly #policy: HttpVerificationSourceProviderOptions["policy"];
  readonly #transport: SourceHttpTransport;
  readonly #addressResolver: SourceAddressResolver;
  readonly #headers: Readonly<Record<string, string>>;

  /** Creates an HTTP source provider with injectable security boundaries. */
  constructor(options: HttpVerificationSourceProviderOptions) {
    this.#policy = options.policy;
    this.#transport = options.transport ?? new PinnedAddressHttpTransport();
    this.#addressResolver = options.addressResolver ??
      new DenoSourceAddressResolver();
    this.#headers = options.headers ?? {};
  }

  /** Resolves an exact URL archive while revalidating every redirect. */
  async resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource> {
    if (input.source.type !== "url") {
      throw new TypeError("HTTP provider requires a URL source");
    }
    const response = await retrievePinnedHttpResource({
      url: input.source.url,
      limits: input.limits,
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      headers: this.#headers,
    });
    let format;
    try {
      format = detectArchiveFormat(new URL(response.finalUrl).pathname);
    } catch (finalUrlCause) {
      try {
        format = detectArchiveFormat(new URL(response.requestedUrl).pathname);
      } catch (requestedUrlCause) {
        throw new SourceResponseReadFailedError(
          response.finalUrl,
          new AggregateError(
            [finalUrlCause, requestedUrlCause],
            "Neither the resolved nor requested source URL identifies a supported archive format.",
          ),
        );
      }
    }
    return {
      content: "archive" as const,
      kind: input.provenanceKind ?? ("url" as const),
      bytes: response.bytes,
      name: new URL(response.finalUrl).pathname,
      format,
      requestedLocator: response.requestedUrl,
      resolvedLocator: response.finalUrl,
      contentType: response.headers["content-type"],
      retrievalPolicy: response.policy,
      size: response.bytes.length,
      sha256: await sha256Hex(response.bytes),
    };
  }
}
