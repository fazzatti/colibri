import {
  WebAuthCode,
  WebAuthError,
  type WebAuthErrorOptions,
} from "@/error.ts";
import type { WebAuthProtocol, WebAuthSubmissionFormat } from "@/types.ts";

const MAX_ERROR_BODY = 2_048;

/** Internal transport response with a parsed JSON body. */
export interface JsonResponse {
  /** HTTP response status. */
  status: number;
  /** Parsed JSON object body. */
  body: Record<string, unknown>;
}

/** Configuration for the shared WebAuth HTTP transport. */
export interface WebAuthTransportOptions {
  /** Optional fetch implementation. */
  fetch?: typeof fetch;
  /** Request timeout, including response body consumption, in milliseconds. @default 30000 */
  timeout?: number;
}

/** Small HTTP boundary shared by both protocol clients. */
export class WebAuthTransport {
  readonly #fetch: typeof fetch;
  readonly #timeout: number;

  /** Creates a transport with an injectable fetch implementation. */
  constructor(options: WebAuthTransportOptions = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeout = options.timeout ?? 30_000;
  }

  /** Sends a GET request and parses its JSON object response. */
  async get(
    endpoint: string,
    params: URLSearchParams,
    protocol: WebAuthProtocol,
  ): Promise<JsonResponse> {
    const url = new URL(endpoint);
    for (const [key, value] of params) {
      url.searchParams.set(key, value);
    }
    return await this.#request(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    }, protocol);
  }

  /** Sends a non-retried POST request in the selected wire encoding. */
  async post(
    endpoint: string,
    field: string,
    value: string,
    format: WebAuthSubmissionFormat,
    protocol: WebAuthProtocol,
  ): Promise<JsonResponse> {
    const body = format === "json"
      ? JSON.stringify({ [field]: value })
      : new URLSearchParams({ [field]: value }).toString();
    const contentType = format === "json"
      ? "application/json"
      : "application/x-www-form-urlencoded";
    return await this.#request(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": contentType,
      },
      body,
    }, protocol);
  }

  async #receive(
    endpoint: string,
    init: RequestInit,
    protocol: WebAuthProtocol,
  ): Promise<{ response: Response; text: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.#timeout);
    let response: Response | undefined;
    let text: string;
    try {
      response = await this.#fetch(endpoint, {
        ...init,
        signal: controller.signal,
      });
      text = await response.text();
    } catch (cause) {
      const aborted = controller.signal.aborted ||
        (cause instanceof DOMException &&
          cause.name === "AbortError");
      const options: WebAuthErrorOptions = {
        code: aborted
          ? WebAuthCode.TIMEOUT
          : response
          ? WebAuthCode.RESPONSE_BODY_FAILED
          : WebAuthCode.TRANSPORT,
        message: aborted
          ? "WebAuth request timed out"
          : "WebAuth request failed",
        details: aborted
          ? `The request exceeded ${this.#timeout} milliseconds.`
          : response
          ? "The WebAuth response body could not be read."
          : "The WebAuth endpoint could not be reached.",
        protocol,
        endpoint,
        cause,
        data: aborted ? { timeout: this.#timeout } : undefined,
      };
      throw new WebAuthError(options);
    } finally {
      clearTimeout(timeoutId);
    }
    return { response, text };
  }

  async #request(
    endpoint: string,
    init: RequestInit,
    protocol: WebAuthProtocol,
  ): Promise<JsonResponse> {
    const { response, text } = await this.#receive(endpoint, init, protocol);

    if (!response.ok) {
      throw new WebAuthError({
        code: WebAuthCode.TRANSPORT,
        message: "WebAuth endpoint rejected the request",
        details: text.slice(0, MAX_ERROR_BODY) || response.statusText,
        protocol,
        endpoint,
        data: {
          status: response.status,
          statusText: response.statusText,
          body: text.slice(0, MAX_ERROR_BODY),
        },
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (cause) {
      throw new WebAuthError({
        code: WebAuthCode.INVALID_RESPONSE,
        message: "WebAuth endpoint returned invalid JSON",
        protocol,
        endpoint,
        cause,
      });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new WebAuthError({
        code: WebAuthCode.INVALID_RESPONSE,
        message: "WebAuth endpoint returned an invalid response object",
        protocol,
        endpoint,
      });
    }
    return { status: response.status, body: body as Record<string, unknown> };
  }
}
