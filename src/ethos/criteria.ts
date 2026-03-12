/**
 * Criteria and named query parameter builders for Ethos resource filtering.
 *
 * Ethos supports filtering resources via `criteria` and `namedQuery` query
 * parameters, which contain URL-encoded JSON objects.
 */

/** Build a criteria query string parameter. */
export function buildCriteriaParam(criteria: Record<string, unknown>): string {
  return `criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
}

/** Build a named query string parameter. */
export function buildNamedQueryParam(
  queryName: string,
  params: Record<string, unknown>,
): string {
  return `namedQuery=${encodeURIComponent(JSON.stringify({ [queryName]: params }))}`;
}
