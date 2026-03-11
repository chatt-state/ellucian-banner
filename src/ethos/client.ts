import { EthosAuth } from "../auth/ethos-auth.js";
import { HttpClient } from "../common/http-client.js";
import { parsePaginatedResponse, paginateAll, DEFAULT_PAGE_SIZE } from "../common/pagination.js";
import type { EthosClientConfig } from "./types.js";
import type { PaginatedResponse, RequestOptions } from "../common/types.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";

/**
 * Client for Ellucian Ethos Integration proxy API.
 * Provides CRUD operations on EEDM resources via the Ethos proxy.
 */
export class EthosClient {
  private readonly http: HttpClient;

  constructor(config: EthosClientConfig) {
    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const auth = new EthosAuth({ apiKey: config.apiKey, baseUrl });

    this.http = new HttpClient({
      baseUrl,
      authProvider: () => auth.getToken().then((t) => `Bearer ${t}`),
      timeout: config.timeout,
      debug: config.debug,
    });
  }

  /** GET a single resource by ID. */
  async get<T = unknown>(
    resource: string,
    id: string,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.get(
      `/api/${resource}/${id}`,
      this.eedmHeaders(version),
      options,
    );
    return response.json() as Promise<T>;
  }

  /** GET a page of resources. */
  async getPage<T = unknown>(
    resource: string,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const response = await this.http.get(
      `/api/${resource}?offset=${offset}&limit=${limit}`,
      this.eedmHeaders(version),
      options,
    );
    return parsePaginatedResponse<T>(response, offset);
  }

  /** Async generator that yields all pages of a resource. */
  async *getAll<T = unknown>(
    resource: string,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* paginateAll<T>(
      (off, lim) => this.getPage<T>(resource, off, lim, version, options),
      pageSize,
    );
  }

  /** POST (create) a new resource. */
  async create<T = unknown>(
    resource: string,
    body: unknown,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.post(
      `/api/${resource}`,
      body,
      this.eedmHeaders(version, true),
      options,
    );
    return response.json() as Promise<T>;
  }

  /** PUT (update) a resource by ID. */
  async update<T = unknown>(
    resource: string,
    id: string,
    body: unknown,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.put(
      `/api/${resource}/${id}`,
      body,
      this.eedmHeaders(version, true),
      options,
    );
    return response.json() as Promise<T>;
  }

  /** DELETE a resource by ID. */
  async delete(
    resource: string,
    id: string,
    version?: number,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.delete(`/api/${resource}/${id}`, this.eedmHeaders(version), options);
  }

  /** Build EEDM versioned Accept/Content-Type headers. */
  private eedmHeaders(version?: number, includeContentType = false): Record<string, string> {
    if (!version) {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (includeContentType) headers["Content-Type"] = "application/json";
      return headers;
    }
    const mediaType = `application/vnd.hedtech.integration.v${version}+json`;
    const headers: Record<string, string> = { Accept: mediaType };
    if (includeContentType) headers["Content-Type"] = mediaType;
    return headers;
  }
}
