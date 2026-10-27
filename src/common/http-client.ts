/**
 * Thin HTTP client wrapper around native fetch.
 *
 * Provides automatic auth header injection, per-attempt timeouts,
 * JSON serialization, retry with backoff, a one-shot re-authentication
 * hook for 401 responses, and opt-in debug logging. Used by both the
 * Ethos proxy client and native Banner REST clients.
 */

import { fromResponse, TimeoutError } from "./errors.js";
import { withRetry } from "./retry.js";
import type { RetryOptions } from "./retry.js";
import type { RequestOptions } from "./types.js";

/** Function that returns an Authorization header value (e.g., "Bearer xxx" or "Basic xxx"). */
export type AuthProvider = () => string | Promise<string>;

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
   * enabled if the DEBUG env var is `1`, `true`, `*`, or mentions `ellucian-banner`.
   * Logged URLs never include query strings, which can carry student PII.
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

/** True when the DEBUG env var asks for this library's logs. */
function debugFromEnv(): boolean {
  const value = process.env["DEBUG"];
  if (!value) return false;
  return /^(1|true|\*)$/i.test(value.trim()) || /ellucian-banner|banner-sdk/i.test(value);
}

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
  private readonly authProvider: AuthProvider;
  private readonly timeout: number;
  private readonly debug: boolean;
  private readonly retryOptions: RetryOptions | undefined;
  private readonly onUnauthorized: UnauthorizedHandler | undefined;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
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
    const url = `${this.baseUrl}${path}`;
    const idempotent = behavior?.idempotent ?? IDEMPOTENT_METHODS.has(method.toUpperCase());
    const serializedBody = body !== undefined ? JSON.stringify(body) : undefined;

    const send = async (): Promise<{ response: Response; authHeader: string }> => {
      const authHeader = await this.authProvider();
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

  /** One fetch attempt with its own timeout, linked to the caller's AbortSignal. */
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
      return await fetch(url, { method, headers, body, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  /** Log request/response to stderr when debug is enabled. Query strings are redacted. */
  private log(method: string, url: string, status?: number) {
    if (!this.debug) return;
    const queryIndex = url.indexOf("?");
    const safeUrl = queryIndex === -1 ? url : `${url.slice(0, queryIndex)}?[redacted]`;
    if (status !== undefined) {
      console.error(`[banner-sdk] ${method} ${safeUrl} -> ${status}`);
    } else {
      console.error(`[banner-sdk] ${method} ${safeUrl}`);
    }
  }
}
