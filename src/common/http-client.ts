/**
 * Thin HTTP client wrapper around native fetch.
 *
 * Provides automatic auth header injection, per-attempt timeouts,
 * JSON serialization, retry with backoff, a one-shot re-authentication
 * hook for 401 responses, and opt-in debug logging. Used by both the
 * Ethos proxy client and native Banner REST clients.
 */

import { raceAbort } from "./abort.js";
import { fromResponse, TimeoutError } from "./errors.js";
import { withRetry } from "./retry.js";
import type { RetryOptions } from "./retry.js";
import type { RequestOptions } from "./types.js";
import { checkRequestPath } from "./url.js";

/**
 * Function that returns an Authorization header value (e.g., "Bearer xxx" or
 * "Basic xxx"). Receives the caller's AbortSignal, if any, so a provider that
 * does network I/O (such as an Ethos token refresh) can stop waiting when the
 * request is cancelled. HttpClient also stops waiting on the provider when the
 * signal aborts.
 */
export type AuthProvider = (signal?: AbortSignal) => string | Promise<string>;

/**
 * Called when a request is rejected with 401. Receives the Authorization
 * header value that was rejected. Return true to have the request retried
 * once with a freshly obtained header from the AuthProvider.
 */
export type UnauthorizedHandler = (rejectedAuthHeader: string) => boolean | Promise<boolean>;

/** Configuration for HttpClient. */
export interface HttpClientConfig {
  /** Base URL for all requests. */
  baseUrl: string;
  /** Function that provides the Authorization header value. */
  authProvider: AuthProvider;
  /** Per-attempt request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /**
   * Enable debug logging to stderr (default: false). When unset, logging is
   * enabled only if the DEBUG env var explicitly names `ellucian-banner`
   * (generic values such as `1`, `true` or `*` do not turn it on).
   * Logs contain the method, a redacted path and the status: query strings are
   * dropped and path segments that look like identifiers are masked as `[id]`.
   */
  debug?: boolean;
  /** Enable retry with exponential backoff. Pass true for defaults, or RetryOptions to customize. Disabled by default. */
  retry?: boolean | RetryOptions;
  /** Hook invoked on 401 responses; return true to retry the request once with fresh credentials. */
  onUnauthorized?: UnauthorizedHandler;
}

/** Per-request transport hints (not part of the public RequestOptions). */
export interface RequestBehavior {
  /**
   * Whether the request is safe to repeat after a 5xx or network failure.
   * Defaults to true for GET/HEAD/PUT/DELETE/OPTIONS and false for POST/PATCH.
   * Read-only POSTs (QAPI, GraphQL) set this to true.
   */
  idempotent?: boolean;
}

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

/**
 * True when the DEBUG env var explicitly asks for this library's logs.
 * Broad values (`1`, `true`, `*`) are ignored so a production-wide debug
 * flag does not silently start writing request paths to service logs.
 */
function debugFromEnv(): boolean {
  const value = process.env["DEBUG"];
  if (!value) return false;
  return /ellucian-banner|banner-sdk/i.test(value);
}

/** Path segments that are safe to log verbatim: route words and version tokens. */
const SAFE_SEGMENT = /^(?:[A-Za-z][A-Za-z_-]*|v\d+(?:\.\d+)*)$/;

/**
 * Redact a request URL for logging: drop the query string and fragment, and
 * mask path segments that may identify a person (anything containing a digit,
 * "@", "%", "." or similar, e.g. GUIDs, Banner IDs, emails, encoded values).
 * Under `/api/{resource}/...` (Ethos) everything after the resource is masked.
 */
export function redactUrlForLog(url: string): string {
  let origin = "";
  let path = url;
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i.exec(url);
  if (match) {
    origin = match[1] ?? "";
    path = match[2] ?? "";
  }
  const cut = path.search(/[?#]/);
  const hadQuery = cut !== -1 && path[cut] === "?";
  const pathOnly = cut === -1 ? path : path.slice(0, cut);
  const segments = pathOnly.split("/");
  const ethosItem = segments[1] === "api";
  const masked = segments.map((segment, i) => {
    if (segment === "") return segment;
    if (ethosItem && i > 2) return "[id]";
    return SAFE_SEGMENT.test(segment) ? segment : "[id]";
  });
  return `${origin}${masked.join("/")}${hadQuery ? "?[redacted]" : ""}`;
}

/** Statuses whose responses never carry a body (the Response constructor rejects one). */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/** Network-level failures that are safe to retry for idempotent requests. */
function isTransientError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  // undici reports connection failures as TypeError("fetch failed")
  return error instanceof TypeError;
}

/**
 * HTTP client that wraps native fetch with auth, timeouts, and error handling.
 *
 * All requests automatically include the Authorization header from the
 * configured auth provider. Non-2xx responses are converted to the
 * appropriate BannerError subclass via `fromResponse()`.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly baseOrigin: string;
  private readonly basePathname: string;
  private readonly authProvider: AuthProvider;
  private readonly timeout: number;
  private readonly debug: boolean;
  private readonly retryOptions: RetryOptions | undefined;
  private readonly onUnauthorized: UnauthorizedHandler | undefined;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    let parsedBase: URL;
    try {
      parsedBase = new URL(this.baseUrl);
    } catch {
      throw new TypeError("HttpClient: baseUrl is not a valid absolute URL");
    }
    this.baseOrigin = parsedBase.origin;
    this.basePathname = parsedBase.pathname.replace(/\/+$/, "");
    this.authProvider = config.authProvider;
    this.timeout = config.timeout ?? 30_000;
    this.debug = config.debug ?? debugFromEnv();
    this.retryOptions = config.retry === true ? {} : config.retry || undefined;
    this.onUnauthorized = config.onUnauthorized;
  }

  /** Send a GET request. */
  async get(path: string, headers?: Record<string, string>, options?: RequestOptions) {
    return this.request("GET", path, undefined, headers, options);
  }

  /** Send a POST request with a JSON body. */
  async post(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    options?: RequestOptions,
    behavior?: RequestBehavior,
  ) {
    return this.request("POST", path, body, headers, options, behavior);
  }

  /** Send a PUT request with a JSON body. */
  async put(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    options?: RequestOptions,
  ) {
    return this.request("PUT", path, body, headers, options);
  }

  /** Send a PATCH request with a JSON body. */
  async patch(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
    options?: RequestOptions,
  ) {
    return this.request("PATCH", path, body, headers, options);
  }

  /** Send a DELETE request. */
  async delete(path: string, headers?: Record<string, string>, options?: RequestOptions) {
    return this.request("DELETE", path, undefined, headers, options);
  }

  /**
   * Core request method. Adds auth headers, applies a per-attempt timeout,
   * serializes the JSON body, retries transient failures, re-authenticates
   * once on 401, and maps error responses to BannerError subclasses.
   */
  async request(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
    options?: RequestOptions,
    behavior?: RequestBehavior,
  ): Promise<Response> {
    const url = this.resolveUrl(path);
    const idempotent = behavior?.idempotent ?? IDEMPOTENT_METHODS.has(method.toUpperCase());
    const serializedBody = body !== undefined ? JSON.stringify(body) : undefined;

    const send = async (): Promise<{ response: Response; authHeader: string }> => {
      const signal = options?.signal;
      const authHeader = await raceAbort(
        Promise.resolve().then(() => this.authProvider(signal)),
        signal,
      );
      const headers = this.buildHeaders(authHeader, body !== undefined, extraHeaders, options);
      const attempt = () => this.fetchOnce(url, method, headers, serializedBody, options?.signal);

      this.log(method, url);
      const response = this.retryOptions
        ? await withRetry(attempt, this.retryOptions, options?.signal, {
            retryServerErrors: idempotent,
            shouldRetryError: idempotent ? isTransientError : undefined,
          })
        : await attempt();
      this.log(method, url, response.status);
      return { response, authHeader };
    };

    const first = await send();
    let response = first.response;

    if (response.status === 401 && this.onUnauthorized) {
      const shouldRetry = await this.onUnauthorized(first.authHeader);
      if (shouldRetry) {
        await response.body?.cancel().catch(() => undefined);
        ({ response } = await send());
      }
    }

    if (response.ok) return response;
    throw await fromResponse(response);
  }

  /**
   * Join the base URL and a request path, refusing anything that could leave
   * the base URL: a path without a leading "/" (which would change the host,
   * e.g. ".evil.example" or "@evil.example"), protocol-relative "//" paths,
   * backslashes, control characters, and dot segments.
   *
   * The boundary is enforced on the *parsed* URL (origin + base path prefix)
   * and the normalized `href` is what gets fetched, so the URL validated here
   * and the URL sent on the wire can never diverge.
   */
  private resolveUrl(path: string): string {
    const problem = checkRequestPath(path);
    if (problem) throw new TypeError(`HttpClient: ${problem}`);
    const parsed = new URL(`${this.baseUrl}${path}`);
    const withinBase =
      this.basePathname === "" ||
      parsed.pathname === this.basePathname ||
      parsed.pathname.startsWith(`${this.basePathname}/`);
    if (parsed.origin !== this.baseOrigin || !withinBase) {
      throw new TypeError("HttpClient: request path resolves outside the configured baseUrl");
    }
    return parsed.href;
  }

  /** Merge auth, caller, and per-request headers. */
  private buildHeaders(
    authHeader: string,
    hasBody: boolean,
    extraHeaders?: Record<string, string>,
    options?: RequestOptions,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: authHeader,
      ...extraHeaders,
      ...options?.headers,
    };

    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
    if (hasBody && !hasContentType) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  /**
   * One fetch attempt with its own timeout, linked to the caller's AbortSignal.
   *
   * The response body is read inside the timed, abortable section and handed
   * back as a buffered Response, so a server that sends headers and then
   * stalls the body still hits `timeout` (TimeoutError) and still honors the
   * caller's AbortSignal.
   */
  private async fetchOnce(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    callerSignal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () =>
        controller.abort(
          new TimeoutError(`${method} request timed out after ${this.timeout}ms`, this.timeout),
        ),
      this.timeout,
    );

    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) onCallerAbort();
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      const response = await fetch(url, { method, headers, body, signal: controller.signal });
      const buffered = NULL_BODY_STATUSES.has(response.status)
        ? null
        : await response.arrayBuffer();
      return new Response(buffered, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      // Surface our TimeoutError / the caller's abort reason consistently,
      // whether the abort hit the request or the body read.
      if (controller.signal.aborted && controller.signal.reason !== undefined) {
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  /** Log request/response to stderr when debug is enabled. See {@link redactUrlForLog}. */
  private log(method: string, url: string, status?: number) {
    if (!this.debug) return;
    const safeUrl = redactUrlForLog(url);
    if (status !== undefined) {
      console.error(`[banner-sdk] ${method} ${safeUrl} -> ${status}`);
    } else {
      console.error(`[banner-sdk] ${method} ${safeUrl}`);
    }
  }
}
