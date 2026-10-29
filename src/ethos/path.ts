/**
 * Ethos URL path builders with input validation.
 *
 * Resource names and IDs often come from configuration, user input, or an
 * LLM-driven tool. `encodeURIComponent` leaves "." and ".." untouched and
 * WHATWG URL parsing then collapses them, so `get("..", "consume")` would hit
 * `/consume` (draining the change-notification queue) with the tenant token.
 * These helpers reject such values before a request is built.
 */

import { isUnsafePathSegment } from "../common/url.js";

/** EEDM resource names: letters, digits, "-" and "_" (e.g. "section-registrations"). */
const RESOURCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Validate a single URL path segment, returning its trimmed value.
 *
 * Throws a {@link TypeError} when `value` is empty/whitespace-only, is made up
 * entirely of dots (".", "..", "...", or their percent-encoded forms), or
 * contains a path separator ("/" or "\"). `encodeURIComponent` leaves "." and
 * ".." untouched, and WHATWG URL parsing then collapses them, so such segments
 * must be rejected before a request path is built — a missing guard would let
 * `itemPath("..", "consume")` reach `/consume` with the tenant token.
 */
export function assertSafeSegment(value: unknown, label = "path segment"): string {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new TypeError(`Ethos ${label} is required`);
  }
  const trimmed = String(value).trim();
  if (isUnsafePathSegment(trimmed) || /^\.+$/.test(trimmed)) {
    throw new TypeError(`Ethos ${label} must not be empty, all dots, or contain '/' or '\\'`);
  }
  return trimmed;
}

/** Validate and return a trimmed Ethos resource name. */
export function resourceName(resource: string): string {
  const trimmed = assertSafeSegment(resource, "resource name");
  if (!RESOURCE_NAME.test(trimmed)) {
    throw new TypeError(
      "Ethos resource name must contain only letters, digits, '-' and '_' (e.g. \"persons\")",
    );
  }
  return trimmed;
}

/** `/api/{resource}` with the resource name validated. */
export function collectionPath(resource: string): string {
  return `/api/${resourceName(resource)}`;
}

/** `/api/{resource}/{id}` with both segments validated and the id encoded. */
export function itemPath(resource: string, id: string): string {
  const value = assertSafeSegment(id, "resource id");
  return `${collectionPath(resource)}/${encodeURIComponent(value)}`;
}

/** `/qapi/{resource}` with the resource name validated. */
export function qapiPath(resource: string): string {
  return `/qapi/${resourceName(resource)}`;
}

/** `offset=..&limit=..` with basic validation. */
export function pageQuery(offset: number, limit: number): string {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new TypeError(`offset must be a non-negative integer, got ${offset}`);
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError(`limit must be a positive integer, got ${limit}`);
  }
  return `offset=${offset}&limit=${limit}`;
}
