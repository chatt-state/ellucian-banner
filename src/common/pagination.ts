/**
 * Reusable pagination utilities for offset-based APIs.
 *
 * Parses x-total-count headers and provides async generator iteration
 * over all pages. Used by both EthosClient and future Banner REST clients.
 */

import type { PaginatedResponse } from "./types.js";

/** Default number of items per page. */
export const DEFAULT_PAGE_SIZE = 25;

/** Parse a paginated response from an HTTP Response with JSON array body. */
export async function parsePaginatedResponse<T>(
  response: Response,
  offset: number,
): Promise<PaginatedResponse<T>> {
  const data = (await response.json()) as T[];
  const totalCount = parseInt(response.headers.get("x-total-count") ?? "0", 10);
  return {
    data,
    totalCount,
    offset,
    hasMore: offset + data.length < totalCount,
  };
}

/**
 * Fetches a resource page by page using an async generator.
 *
 * @param fetchPage - Function that fetches a single page given offset and limit
 * @param pageSize - Number of items per page (default: 25)
 * @yields Arrays of items for each page
 */
export async function* paginateAll<T>(
  fetchPage: (offset: number, limit: number) => Promise<PaginatedResponse<T>>,
  pageSize = DEFAULT_PAGE_SIZE,
): AsyncGenerator<T[], void, unknown> {
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await fetchPage(offset, pageSize);
    yield page.data;
    hasMore = page.hasMore;
    offset += page.data.length;
  }
}
