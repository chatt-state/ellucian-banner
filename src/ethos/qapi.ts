/**
 * Ethos QAPI (POST-based search) client.
 *
 * QAPI provides a POST-based search interface at `/qapi/{resource}`
 * with EEDM-versioned headers and offset-based pagination.
 */

import { parsePaginatedResponse, paginateAll, DEFAULT_PAGE_SIZE } from "../common/pagination.js";
import type { HttpClient } from "../common/http-client.js";
import type { PaginatedResponse, RequestOptions } from "../common/types.js";

/**
 * Client for Ethos QAPI search endpoints.
 *
 * Use `search()` for a single page, or `searchAll()` for an async
 * generator that yields all pages of results.
 */
export class EthosQapi {
  constructor(private readonly http: HttpClient) {}

  /** Search a resource using POST-based criteria. */
  async search<T = unknown>(
    resource: string,
    criteria: unknown,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const path = `/qapi/${resource}?offset=${offset}&limit=${limit}`;
    const headers = this.eedmHeaders(version);
    const response = await this.http.post(path, criteria, headers, options);
    return parsePaginatedResponse<T>(response, offset);
  }

  /** Async generator that yields all pages of search results. */
  async *searchAll<T = unknown>(
    resource: string,
    criteria: unknown,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* paginateAll<T>(
      (off, lim) => this.search<T>(resource, criteria, off, lim, version, options),
      pageSize,
    );
  }

  /** Build EEDM versioned Accept/Content-Type headers. */
  private eedmHeaders(version?: number): Record<string, string> {
    if (!version) {
      return {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
    }
    const mediaType = `application/vnd.hedtech.integration.v${version}+json`;
    return { Accept: mediaType, "Content-Type": mediaType };
  }
}
