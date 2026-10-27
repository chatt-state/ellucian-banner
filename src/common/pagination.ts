/**
 * Reusable pagination utilities for offset-based APIs.
 *
 * Ethos list endpoints accept `offset` and `limit` query parameters and
 * report `x-total-count` (total matching rows) and `x-max-page-size` (the
 * largest page the server will return; larger `limit` values are silently
 * capped) response headers.
 */

import { BannerError } from "./errors.js";
import type { PaginatedResponse } from "./types.js";

/** Default number of items per page. */
export const DEFAULT_PAGE_SIZE = 25;

/** Parse a non-negative integer header, or undefined if absent/invalid. */
function intHeader(response: Response, name: string): number | undefined {
  const raw = response.headers.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = parseInt(raw, 10);
  return isNaN(value) || value < 0 ? undefined : value;
}

/**
 * Parse a paginated response from an HTTP Response with a JSON array body.
 *
 * @param response - The list response
 * @param offset - The offset that was requested
 * @param limit - The limit that was requested. Used to infer `hasMore` when the
 *   server omits `x-total-count` (a full page implies there may be more).
 */
export async function parsePaginatedResponse<T>(
  response: Response,
  offset: number,
  limit?: number,
): Promise<PaginatedResponse<T>> {
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new BannerError(
      `Expected a JSON array from a list endpoint, got ${body === null ? "null" : typeof body}`,
      response.status,
    );
  }
  const data = body as T[];
  const headerTotal = intHeader(response, "x-total-count");
  const maxPageSize = intHeader(response, "x-max-page-size");

  let totalCount: number;
  let hasMore: boolean;
  if (headerTotal !== undefined) {
    totalCount = headerTotal;
    hasMore = data.length > 0 && offset + data.length < totalCount;
  } else {
    // No total from the server: a full page means there may be more.
    const pageCap = Math.min(limit ?? Infinity, maxPageSize ?? Infinity);
    hasMore = data.length > 0 && Number.isFinite(pageCap) && data.length >= pageCap;
    totalCount = offset + data.length; // lower bound
  }

  const result: PaginatedResponse<T> = { data, totalCount, offset, hasMore };
  if (maxPageSize !== undefined) result.maxPageSize = maxPageSize;
  return result;
}

/**
 * Fetches a resource page by page using an async generator.
 *
 * Advances by the number of rows actually returned, so a server-side page
 * cap (`x-max-page-size` smaller than the requested limit) does not skip rows.
 * Stops on an empty page even if the server claims more rows exist, to avoid
 * looping forever on an inconsistent `x-total-count`.
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
    if (page.data.length === 0) return;
    hasMore = page.hasMore;
    offset += page.data.length;
  }
}
