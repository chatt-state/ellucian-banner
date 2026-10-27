/**
 * Typed resource accessor for Ethos EEDM resources.
 *
 * Wraps EthosClient methods with a pre-bound resource name and EEDM version,
 * providing a clean API like `client.persons.get(id)`. Every method, including
 * filtering, named queries and QAPI search, sends the bound version, so the
 * representation matches the accessor's type no matter which call returned it.
 */

import type { PaginatedResponse, RequestOptions } from "../common/types.js";
import type { NamedQueryOptions } from "./criteria.js";
import type { EedmVersion } from "./types.js";

/** Transport options plus named-query wrapping, as accepted by `namedQuery`. */
export type EthosNamedQueryOptions = RequestOptions & NamedQueryOptions;

/** The QAPI methods EthosResource delegates to. */
export interface EthosQapiClient {
  search<T>(
    resource: string,
    criteria: unknown,
    offset?: number,
    limit?: number,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>>;
  searchAll<T>(
    resource: string,
    criteria: unknown,
    pageSize?: number,
    version?: EedmVersion,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown>;
}

/** Interface for the underlying client methods that EthosResource delegates to. */
export interface EthosResourceClient {
  get<T>(resource: string, id: string, version?: EedmVersion, options?: RequestOptions): Promise<T>;
  getPage<T>(
    resource: string,
    offset?: number,
    limit?: number,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>>;
  getAll<T>(
    resource: string,
    pageSize?: number,
    version?: EedmVersion,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown>;
  create<T>(
    resource: string,
    body: unknown,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<T>;
  update<T>(
    resource: string,
    id: string,
    body: unknown,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<T>;
  delete(
    resource: string,
    id: string,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<void>;
  filter<T>(
    resource: string,
    criteria: Record<string, unknown>,
    offset?: number,
    limit?: number,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>>;
  filterAll<T>(
    resource: string,
    criteria: Record<string, unknown>,
    pageSize?: number,
    version?: EedmVersion,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown>;
  namedQuery<T>(
    resource: string,
    queryName: string,
    params: unknown,
    offset?: number,
    limit?: number,
    version?: EedmVersion,
    options?: EthosNamedQueryOptions,
  ): Promise<PaginatedResponse<T>>;
  namedQueryAll<T>(
    resource: string,
    queryName: string,
    params: unknown,
    pageSize?: number,
    version?: EedmVersion,
    options?: EthosNamedQueryOptions,
  ): AsyncGenerator<T[], void, unknown>;
  readonly qapi: EthosQapiClient;
}

/**
 * Pre-bound resource accessor for a specific EEDM resource.
 *
 * @example
 * ```ts
 * const persons = new EthosResource(client, "persons", 12);
 * const person = await persons.get<Person>("abc-123");
 * for await (const page of persons.getAll<Person>()) { ... }
 * const smiths = await persons.filter({ names: [{ lastName: "Smith" }] });
 * ```
 */
export class EthosResource<TDefault = unknown> {
  constructor(
    private readonly client: EthosResourceClient,
    private readonly resourceName: string,
    private readonly version?: EedmVersion,
  ) {}

  /** The EEDM resource name this accessor calls (e.g. "grade-definitions"). */
  get name(): string {
    return this.resourceName;
  }

  /** The EEDM version this accessor sends, or undefined for "latest". */
  get boundVersion(): EedmVersion | undefined {
    return this.version;
  }

  /** GET a single resource by ID. */
  async get<T = TDefault>(id: string, options?: RequestOptions): Promise<T> {
    return this.client.get<T>(this.resourceName, id, this.version, options);
  }

  /** GET a page of resources. */
  async getPage<T = TDefault>(
    offset?: number,
    limit?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    return this.client.getPage<T>(this.resourceName, offset, limit, this.version, options);
  }

  /** Async generator that yields all pages. */
  async *getAll<T = TDefault>(
    pageSize?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* this.client.getAll<T>(this.resourceName, pageSize, this.version, options);
  }

  /** GET a page filtered by criteria (`?criteria=...`), using the bound version. */
  async filter<T = TDefault>(
    criteria: Record<string, unknown>,
    offset?: number,
    limit?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    return this.client.filter<T>(this.resourceName, criteria, offset, limit, this.version, options);
  }

  /** Async generator over every page of a criteria filter, using the bound version. */
  async *filterAll<T = TDefault>(
    criteria: Record<string, unknown>,
    pageSize?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* this.client.filterAll<T>(this.resourceName, criteria, pageSize, this.version, options);
  }

  /**
   * GET a page using a named query (`?{queryName}=...`), using the bound
   * version. Pass `{ wrap: false }` for queries whose JSON keys differ from
   * the query name.
   */
  async namedQuery<T = TDefault>(
    queryName: string,
    params: unknown,
    offset?: number,
    limit?: number,
    options?: EthosNamedQueryOptions,
  ): Promise<PaginatedResponse<T>> {
    return this.client.namedQuery<T>(
      this.resourceName,
      queryName,
      params,
      offset,
      limit,
      this.version,
      options,
    );
  }

  /** Async generator over every page of a named query, using the bound version. */
  async *namedQueryAll<T = TDefault>(
    queryName: string,
    params: unknown,
    pageSize?: number,
    options?: EthosNamedQueryOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* this.client.namedQueryAll<T>(
      this.resourceName,
      queryName,
      params,
      pageSize,
      this.version,
      options,
    );
  }

  /** QAPI search (`POST /qapi/{resource}`), using the bound version. */
  async qapiSearch<T = TDefault>(
    criteria: unknown,
    offset?: number,
    limit?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    return this.client.qapi.search<T>(
      this.resourceName,
      criteria,
      offset,
      limit,
      this.version,
      options,
    );
  }

  /** Async generator over every page of a QAPI search, using the bound version. */
  async *qapiSearchAll<T = TDefault>(
    criteria: unknown,
    pageSize?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* this.client.qapi.searchAll<T>(
      this.resourceName,
      criteria,
      pageSize,
      this.version,
      options,
    );
  }

  /** POST (create) a new resource. */
  async create<T = TDefault>(body: unknown, options?: RequestOptions): Promise<T> {
    return this.client.create<T>(this.resourceName, body, this.version, options);
  }

  /** PUT (update) a resource by ID. */
  async update<T = TDefault>(id: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.client.update<T>(this.resourceName, id, body, this.version, options);
  }

  /** DELETE a resource by ID. */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    return this.client.delete(this.resourceName, id, this.version, options);
  }
}
