import { EthosAuth } from "../auth/ethos-auth.js";
import { BannerError, NotFoundError, RateLimitError, AuthError } from "../common/errors.js";
import type { EthosClientConfig } from "./types.js";
import type { PaginatedResponse, RequestOptions } from "../common/types.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";
const DEFAULT_PAGE_SIZE = 25;

/**
 * Client for Ellucian Ethos Integration proxy API.
 * Provides CRUD operations on EEDM resources via the Ethos proxy.
 */
export class EthosClient {
  private readonly auth: EthosAuth;
  private readonly baseUrl: string;

  constructor(config: EthosClientConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.auth = new EthosAuth({ apiKey: config.apiKey, baseUrl: this.baseUrl });
  }

  /** GET a single resource by ID. */
  async get<T = unknown>(
    resource: string,
    id: string,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.request(
      "GET",
      `/api/${resource}/${id}`,
      version,
      undefined,
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
    const url = `/api/${resource}?offset=${offset}&limit=${limit}`;
    const response = await this.request("GET", url, version, undefined, options);
    const data = (await response.json()) as T[];
    const totalCount = parseInt(response.headers.get("x-total-count") ?? "0", 10);
    return {
      data,
      totalCount,
      offset,
      hasMore: offset + data.length < totalCount,
    };
  }

  /** Async generator that yields all pages of a resource. */
  async *getAll<T = unknown>(
    resource: string,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await this.getPage<T>(resource, offset, pageSize, version, options);
      yield page.data;
      hasMore = page.hasMore;
      offset += page.data.length;
    }
  }

  /** POST (create) a new resource. */
  async create<T = unknown>(
    resource: string,
    body: unknown,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.request("POST", `/api/${resource}`, version, body, options);
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
    const response = await this.request("PUT", `/api/${resource}/${id}`, version, body, options);
    return response.json() as Promise<T>;
  }

  /** DELETE a resource by ID. */
  async delete(
    resource: string,
    id: string,
    version?: number,
    options?: RequestOptions,
  ): Promise<void> {
    await this.request("DELETE", `/api/${resource}/${id}`, version, undefined, options);
  }

  private async request(
    method: string,
    path: string,
    version?: number,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<Response> {
    const token = await this.auth.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    };

    if (version) {
      const mediaType = `application/vnd.hedtech.integration.v${version}+json`;
      headers["Accept"] = mediaType;
      if (body) headers["Content-Type"] = mediaType;
    } else {
      headers["Accept"] = "application/json";
      if (body) headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    if (response.ok) return response;

    this.throwForStatus(response);
  }

  private throwForStatus(response: Response): never {
    const { status, statusText } = response;
    if (status === 401 || status === 403) {
      throw new AuthError(`${status} ${statusText}`, status);
    }
    if (status === 404) {
      throw new NotFoundError(`Resource not found: ${statusText}`);
    }
    if (status === 429) {
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "", 10);
      throw new RateLimitError(
        `Rate limit exceeded: ${statusText}`,
        isNaN(retryAfter) ? undefined : retryAfter,
      );
    }
    throw new BannerError(`${status} ${statusText}`, status);
  }
}
