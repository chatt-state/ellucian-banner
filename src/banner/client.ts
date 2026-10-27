/**
 * Client for native Banner REST APIs (StudentApi, BannerAdminBPAPI).
 *
 * Uses HTTP Basic Auth via BannerAuth and the shared HttpClient.
 * Provides typed sub-clients for each API surface area.
 */

import { BannerAuth } from "../auth/banner-auth.js";
import { HttpClient } from "../common/http-client.js";
import { readJson } from "../common/json.js";
import type { BannerAuthConfig } from "../auth/types.js";
import type { RetryOptions } from "../common/retry.js";
import type { RequestOptions } from "../common/types.js";

/** Configuration for BannerClient. */
export interface BannerClientConfig extends BannerAuthConfig {
  /** Per-attempt request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /** Enable debug logging to stderr. */
  debug?: boolean;
  /** Enable retry with exponential backoff. Pass true for defaults, or RetryOptions to customize. */
  retry?: boolean | RetryOptions;
}

/** Query-string values accepted by {@link BannerApiClient.withQuery}. */
export type QueryValue = string | number | boolean | null | undefined;

/** Constructor shape of BannerApiClient subclasses (e.g. codegen output). */
export interface BannerApiClientConstructor<T extends BannerApiClient> {
  new (http: HttpClient, basePath: string): T;
  /** Default base path baked in by the code generator. */
  readonly basePath?: string;
}

/**
 * Client for native Banner REST APIs.
 *
 * Provides access to StudentApi and BannerAdminBPAPI endpoints
 * using HTTP Basic Auth.
 *
 * @example
 * ```ts
 * const banner = new BannerClient({ baseUrl: "https://banner.example.edu" });
 * const data = await banner.studentApi.get("/student/v1/students");
 * ```
 */
export class BannerClient {
  private readonly auth: BannerAuth;
  private readonly http: HttpClient;

  /** Sub-client for /StudentApi/api/ endpoints. */
  readonly studentApi: BannerApiClient;
  /** Sub-client for /BannerAdminBPAPI/api/ endpoints. */
  readonly adminBpapi: BannerApiClient;

  constructor(config: BannerClientConfig = {}) {
    this.auth = new BannerAuth(config);

    this.http = new HttpClient({
      baseUrl: this.auth.baseUrl,
      authProvider: () => this.auth.getAuthHeader(),
      timeout: config.timeout,
      debug: config.debug,
      retry: config.retry,
    });

    this.studentApi = new BannerApiClient(this.http, "/StudentApi/api");
    this.adminBpapi = new BannerApiClient(this.http, "/BannerAdminBPAPI/api");
  }

  /** Create a sub-client for a custom API base path. */
  api(basePath: string): BannerApiClient {
    return new BannerApiClient(this.http, normalizeBasePath(basePath));
  }

  /**
   * Instantiate a generated (codegen) client bound to this connection.
   *
   * @example
   * ```ts
   * import { StudentApiClient } from "./generated/client.js";
   * const students = banner.use(StudentApiClient); // uses the spec's basePath
   * ```
   */
  use<T extends BannerApiClient>(ctor: BannerApiClientConstructor<T>, basePath?: string): T {
    return new ctor(this.http, normalizeBasePath(basePath ?? ctor.basePath ?? ""));
  }
}

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.replace(/\/+$/, "");
  if (trimmed === "") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Sub-client for a specific Banner API surface area.
 *
 * All paths are relative to the configured basePath
 * (e.g., `/StudentApi/api`). JSON bodies are parsed; empty bodies
 * (204 No Content) resolve to `undefined`.
 */
export class BannerApiClient {
  constructor(
    protected readonly http: HttpClient,
    protected readonly basePath: string,
  ) {}

  /** GET a resource. */
  async get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    const response = await this.http.get(this.url(path), { Accept: "application/json" }, options);
    return readJson<T>(response);
  }

  /** POST a resource. */
  async post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.http.post(
      this.url(path),
      body,
      { Accept: "application/json" },
      options,
    );
    return readJson<T>(response);
  }

  /** PUT a resource. */
  async put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.http.put(
      this.url(path),
      body,
      { Accept: "application/json" },
      options,
    );
    return readJson<T>(response);
  }

  /** PATCH a resource. */
  async patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.http.patch(
      this.url(path),
      body,
      { Accept: "application/json" },
      options,
    );
    return readJson<T>(response);
  }

  /** DELETE a resource. */
  async delete(path: string, options?: RequestOptions): Promise<void> {
    const response = await this.http.delete(
      this.url(path),
      { Accept: "application/json" },
      options,
    );
    await response.body?.cancel().catch(() => undefined);
  }

  /** GET raw Response (for custom parsing). */
  async getRaw(path: string, options?: RequestOptions): Promise<Response> {
    return this.http.get(this.url(path), { Accept: "application/json" }, options);
  }

  /**
   * Append a query string built from `query` to `path`. `undefined` and
   * `null` values are skipped; everything else is URL-encoded.
   */
  protected withQuery(path: string, query?: Record<string, QueryValue>): string {
    if (!query) return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (!qs) return path;
    return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
  }

  private url(path: string): string {
    return `${this.basePath}${path}`;
  }
}
