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
import { ArchiveLimitExceededError } from "@/archive/error.ts";
import { detectArchiveFormat } from "@/archive/detect.ts";
import { sha256Hex } from "@/core/comparison/compare-wasm.ts";
import {
  isCredentialBearingName,
  redactUrlCredentials,
} from "@/core/types/redaction.ts";
import type { ResolvedVerificationSource } from "@/core/types/index.ts";
import type { VerificationSourceProvider } from "@/providers/source/types.ts";
import type {
  HttpVerificationSourceProviderOptions,
  SourceAddressResolver,
  SourceHttpResponse,
  SourceHttpTransport,
  SourceHttpTransportInput,
  VerificationSourceProviderInput,
} from "@/providers/source/types.ts";
import { BuildVerificationError } from "@/error/base.ts";
import {
  HttpSourceProviderInputMismatchError,
  SourceDnsEmptyError,
  SourceDownloadFailedError,
  SourcePolicyRejectedError,
  SourceRedirectLimitExceededError,
  SourceRedirectLocationMissingError,
  SourceRequestTimedOutError,
  SourceResponseReadFailedError,
} from "@/providers/source/error.ts";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Removes embedded URL credentials before a locator reaches errors/evidence. */
export const redactSourceUrl = (value: string): string => {
  return redactUrlCredentials(value) ?? "<invalid-url>";
};

const withoutCredentialHeaders = (
  headers: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(headers).filter(([name]) => !isCredentialBearingName(name)),
  );

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
    const [ipv4, ipv6] = await Promise.all([
      Deno.resolveDns(normalized, "A").catch(() => [] as string[]),
      Deno.resolveDns(normalized, "AAAA").catch(() => [] as string[]),
    ]);
    const addresses = [...new Set([...ipv4, ...ipv6])];
    if (addresses.length === 0) throw new SourceDnsEmptyError(normalized);
    return addresses;
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
  readonly policy: import("@/core/policy/types.ts").PolicyDecision;
};

type RetrievePinnedHttpResourceArgs = {
  readonly url: string;
  readonly limits: VerificationSourceProviderInput["limits"];
  readonly policy: HttpVerificationSourceProviderOptions["policy"];
  readonly transport: SourceHttpTransport;
  readonly addressResolver: SourceAddressResolver;
  readonly headers?:
    | Readonly<Record<string, string>>
    | ((url: URL) => Readonly<Record<string, string>>);
  readonly maxBytes?: number;
  readonly acceptStatus?: (status: number) => boolean;
};

const parseSourceUrl = (current: string, requested: string): URL => {
  try {
    return new URL(current);
  } catch (cause) {
    throw new SourceDownloadFailedError(requested, cause);
  }
};

const sourceRequestHeaders = (
  args: RetrievePinnedHttpResourceArgs,
  parsed: URL,
  allowStaticCredentials: boolean,
): Readonly<Record<string, string>> => {
  if (typeof args.headers === "function") return args.headers(parsed);
  if (allowStaticCredentials && parsed.protocol === "https:") {
    return args.headers ?? {};
  }
  return withoutCredentialHeaders(args.headers ?? {});
};

const requestApprovedSource = async (
  args: RetrievePinnedHttpResourceArgs,
  current: string,
  parsed: URL,
  addresses: readonly string[],
  allowStaticCredentials: boolean,
): Promise<SourceHttpResponse> => {
  try {
    return await args.transport.request({
      url: current,
      headers: sourceRequestHeaders(args, parsed, allowStaticCredentials),
      approvedAddresses: addresses,
      timeoutMs: args.limits.downloadTimeoutMs,
      maxBytes: args.maxBytes ?? args.limits.maxArchiveBytes,
    });
  } catch (cause) {
    if (cause instanceof BuildVerificationError) throw cause;
    throw new SourceDownloadFailedError(redactSourceUrl(current), cause);
  }
};

const sourceRedirect = (
  args: RetrievePinnedHttpResourceArgs,
  response: SourceHttpResponse,
  current: string,
  redirect: number,
): URL | undefined => {
  if (!REDIRECT_STATUSES.has(response.status)) return;
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
  return new URL(location, current);
};

const assertSourceResponseAccepted = (
  args: RetrievePinnedHttpResourceArgs,
  response: SourceHttpResponse,
  current: string,
): void => {
  const successful = response.status >= 200 && response.status < 300;
  if (successful || args.acceptStatus?.(response.status)) return;
  throw new SourceDownloadFailedError(
    redactSourceUrl(current),
    undefined,
    response.status,
  );
};

const resolveHttpArchiveFormat = (
  response: Pick<PinnedHttpResource, "finalUrl" | "requestedUrl">,
): ReturnType<typeof detectArchiveFormat> => {
  try {
    return detectArchiveFormat(new URL(response.finalUrl).pathname);
  } catch (finalUrlCause) {
    try {
      return detectArchiveFormat(new URL(response.requestedUrl).pathname);
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
};

/** Retrieves bytes while revalidating policy and DNS pinning per redirect. */
export const retrievePinnedHttpResource = async (
  args: RetrievePinnedHttpResourceArgs,
): Promise<PinnedHttpResource> => {
  const requested = redactSourceUrl(args.url);
  const retrieve = async (
    current: string,
    redirect: number,
    allowStaticCredentials: boolean,
  ): Promise<PinnedHttpResource> => {
    const parsed = parseSourceUrl(current, requested);
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
    const response = await requestApprovedSource(
      args,
      current,
      parsed,
      addresses,
      allowStaticCredentials,
    );
    const redirected = sourceRedirect(args, response, current, redirect);
    if (redirected) {
      return await retrieve(
        redirected.toString(),
        redirect + 1,
        allowStaticCredentials && redirected.origin === parsed.origin,
      );
    }
    assertSourceResponseAccepted(args, response, current);
    return {
      requestedUrl: requested,
      finalUrl: redactSourceUrl(current),
      status: response.status,
      headers: response.headers,
      bytes: response.bytes,
      policy: policyDecision,
    };
  };
  return await retrieve(args.url, 0, true);
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
      throw new HttpSourceProviderInputMismatchError(input.source.type);
    }
    const response = await retrievePinnedHttpResource({
      url: input.source.url,
      limits: input.limits,
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      headers: this.#headers,
    });
    const format = resolveHttpArchiveFormat(response);
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
