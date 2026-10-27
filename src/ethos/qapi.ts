/**
 * Ethos QAPI (POST-based search) client.
 *
 * QAPI provides a POST-based search interface at `/qapi/{resource}`: the
 * request body is a partial resource representation to match, sent with
 * EEDM-versioned Accept/Content-Type headers, and results are paged with
 * `offset`/`limit` query parameters like the GET list endpoints. Because it
 * is a read, QAPI requests are safe to retry.
 */

import { parsePaginatedResponse, paginateAll, DEFAULT_PAGE_SIZE } from "../common/pagination.js";
import { eedmHeaders } from "./media-type.js";
import { pageQuery, qapiPath } from "./path.js";
import type { HttpClient } from "../common/http-client.js";
import type { PaginatedResponse, RequestOptions } from "../common/types.js";
import type { EedmVersion } from "./types.js";

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
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    // Validated: a resource of ".." would otherwise escape /qapi/.
    const path = `${qapiPath(resource)}?${pageQuery(offset, limit)}`;
    const response = await this.http.post(
      path,
      criteria ?? {},
      eedmHeaders(version, true),
      options,
      {
        idempotent: true,
      },
    );
    return parsePaginatedResponse<T>(response, offset, limit);
  }

  /** Async generator that yields all pages of search results. */
  async *searchAll<T = unknown>(
    resource: string,
    criteria: unknown,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* paginateAll<T>(
      (off, lim) => this.search<T>(resource, criteria, off, lim, version, options),
      pageSize,
    );
  }
}
