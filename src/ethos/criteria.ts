/**
 * Criteria and named query parameter builders for Ethos resource filtering.
 *
 * Ethos filters list requests with URL-encoded JSON query parameters:
 *
 * - Criteria filter:  `?criteria={"names":[{"firstName":"John"}]}`
 * - Named query:      `?{queryName}={json}`, e.g.
 *                     `?keywordSearch={"keywordSearch":"math"}` or
 *                     `?personFilter={"personFilter":{"id":"<guid>"}}`
 *
 * (Format confirmed against Ellucian's integration-sdk-java
 * `CriteriaFilter` / `NamedQuery` classes.) The parameter name of a named
 * query is the query name itself — there is no `namedQuery=` parameter.
 */

/** Build a criteria query string parameter (`criteria=<url-encoded JSON>`). */
export function buildCriteriaParam(criteria: Record<string, unknown>): string {
  return `criteria=${encodeURIComponent(JSON.stringify(criteria))}`;
}

/** Options for {@link buildNamedQueryParam}. */
export interface NamedQueryOptions {
  /**
   * How to build the JSON value:
   * - `"auto"` (default): if `params` is already `{ [queryName]: ... }` it is
   *   sent as-is, otherwise it is wrapped as `{ [queryName]: params }`.
   * - `true`: always wrap as `{ [queryName]: params }`.
   * - `false`: send `params` verbatim (for named queries whose JSON keys differ
   *   from the query name).
   */
  wrap?: "auto" | boolean;
}

/**
 * Build a named query string parameter: `{queryName}=<url-encoded JSON>`.
 *
 * @example
 * buildNamedQueryParam("keywordSearch", "math")
 * // keywordSearch=%7B%22keywordSearch%22%3A%22math%22%7D
 */
export function buildNamedQueryParam(
  queryName: string,
  params: unknown,
  options: NamedQueryOptions = {},
): string {
  if (!queryName || queryName.trim() === "") {
    throw new TypeError("Named query name is required");
  }
  const wrap = options.wrap ?? "auto";
  const alreadyWrapped =
    params !== null &&
    typeof params === "object" &&
    !Array.isArray(params) &&
    Object.keys(params).length === 1 &&
    Object.prototype.hasOwnProperty.call(params, queryName);

  const value =
    wrap === false || (wrap === "auto" && alreadyWrapped) ? params : { [queryName]: params };
  return `${encodeURIComponent(queryName)}=${encodeURIComponent(JSON.stringify(value))}`;
}
