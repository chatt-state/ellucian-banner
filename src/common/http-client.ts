/**
 * Thin HTTP client wrapper around native fetch.
 *
 * Provides automatic auth header injection, configurable timeouts,
 * JSON serialization, and opt-in debug logging. Used by both the
 * Ethos proxy client and native Banner REST clients.
 */

import { fromResponse } from "./errors.js";
import type { RequestOptions } from "./types.js";

/** Function that returns an Authorization header value (e.g., "Bearer xxx" or "Basic xxx"). */
export type AuthProvider = () => string | Promise<string>;

/** Configuration for HttpClient. */
export interface HttpClientConfig {
  /** Base URL for all requests. */
  baseUrl: string;
  /** Function that provides the Authorization header value. */
  authProvider: AuthProvider;
  /** Default request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /** Enable debug logging to stderr (default: false). Respects DEBUG env var. */
  debug?: boolean;
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

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authProvider = config.authProvider;
    this.timeout = config.timeout ?? 30_000;
    this.debug = config.debug ?? !!process.env["DEBUG"];
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
  ) {
    return this.request("POST", path, body, headers, options);
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

  /** Send a DELETE request. */
  async delete(path: string, headers?: Record<string, string>, options?: RequestOptions) {
    return this.request("DELETE", path, undefined, headers, options);
  }

  /**
   * Core request method. Adds auth headers, applies timeout,
   * serializes JSON body, and maps error responses.
   */
  async request(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const authHeader = await this.authProvider();

    const headers: Record<string, string> = {
      Authorization: authHeader,
      ...extraHeaders,
      ...options?.headers,
    };

    if (body !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Timeout via AbortController — respects caller's signal too
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    this.log(method, url);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      this.log(method, url, response.status);

      if (response.ok) return response;

      throw await fromResponse(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Log request/response to stderr when debug is enabled. */
  private log(method: string, url: string, status?: number) {
    if (!this.debug) return;
    if (status !== undefined) {
      console.error(`[banner-sdk] ${method} ${url} -> ${status}`);
    } else {
      console.error(`[banner-sdk] ${method} ${url}`);
    }
  }
}
