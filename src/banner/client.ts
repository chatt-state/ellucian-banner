/**
 * Client for native Banner REST APIs (StudentApi, BannerAdminBPAPI).
 *
 * Uses HTTP Basic Auth via BannerAuth and the shared HttpClient.
 * Provides typed sub-clients for each API surface area.
 */

import { BannerAuth } from "../auth/banner-auth.js";
import { HttpClient } from "../common/http-client.js";
import type { BannerAuthConfig } from "../auth/types.js";
import type { RequestOptions } from "../common/types.js";

/** Configuration for BannerClient. */
export interface BannerClientConfig extends BannerAuthConfig {
  /** Request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /** Enable debug logging to stderr. */
  debug?: boolean;
  /** Enable retry with exponential backoff. */
  retry?: boolean;
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
    return new BannerApiClient(this.http, basePath.replace(/\/+$/, ""));
  }
}

/**
 * Sub-client for a specific Banner API surface area.
 *
 * All paths are relative to the configured basePath
 * (e.g., `/StudentApi/api`).
 */
export class BannerApiClient {
  constructor(
    private readonly http: HttpClient,
    private readonly basePath: string,
  ) {}

  /** GET a resource. */
  async get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    const response = await this.http.get(
      `${this.basePath}${path}`,
      { Accept: "application/json" },
      options,
    );
    return response.json() as Promise<T>;
  }

  /** POST a resource. */
  async post<T = unknown>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.http.post(
      `${this.basePath}${path}`,
      body,
      { Accept: "application/json" },
      options,
    );
    return response.json() as Promise<T>;
  }

  /** PUT a resource. */
  async put<T = unknown>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const response = await this.http.put(
      `${this.basePath}${path}`,
      body,
      { Accept: "application/json" },
      options,
    );
    return response.json() as Promise<T>;
  }

  /** DELETE a resource. */
  async delete(path: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(
      `${this.basePath}${path}`,
      { Accept: "application/json" },
      options,
    );
  }

  /** GET raw Response (for custom parsing). */
  async getRaw(path: string, options?: RequestOptions): Promise<Response> {
    return this.http.get(
      `${this.basePath}${path}`,
      { Accept: "application/json" },
      options,
    );
  }
}
