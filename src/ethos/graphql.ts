/**
 * GraphQL client for the Ethos Integration GraphQL endpoint.
 *
 * Sends queries to POST /graphql with automatic auth via HttpClient.
 */

import { BannerError } from "../common/errors.js";
import type { HttpClient } from "../common/http-client.js";
import { readJson } from "../common/json.js";
import type { RequestOptions } from "../common/types.js";

/** A GraphQL request payload. */
export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/** A GraphQL response with optional data and errors. */
export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

/** A single GraphQL error entry. */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

/**
 * Client for the Ethos GraphQL endpoint.
 *
 * @example
 * Ethos GraphQL exposes each resource as a version-suffixed field
 * (e.g. `persons12`, `sections16`); an unversioned field such as `persons`
 * fails validation and comes back in `errors` with HTTP 200.
 *
 * ```ts
 * const result = await client.graphql.query({
 *   query: '{ persons12 { edges { node { id names { firstName lastName } } } } }',
 * });
 * ```
 */
export class EthosGraphQL {
  constructor(private readonly http: HttpClient) {}

  /** Execute a GraphQL query. */
  async query<T = unknown>(
    request: GraphQLRequest,
    options?: RequestOptions,
  ): Promise<GraphQLResponse<T>> {
    if (!request.query || request.query.trim() === "") {
      throw new TypeError("GraphQL query is required");
    }
    // GraphQL is a read here (Ethos GraphQL is query-only), so it is safe to retry.
    const response = await this.http.post(
      "/graphql",
      request,
      { "Content-Type": "application/json", Accept: "application/json" },
      options,
      { idempotent: true },
    );
    // readJson throws BannerError (body kept in responseBody, not the message)
    // instead of a SyntaxError quoting the body on a non-JSON response.
    const body = await readJson<GraphQLResponse<T> | undefined>(response);
    if (!body || typeof body !== "object") {
      throw new BannerError("Expected a JSON object from /graphql", response.status);
    }
    return body;
  }
}
