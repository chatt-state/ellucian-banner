/**
 * Typed resource accessor for Ethos EEDM resources.
 *
 * Wraps EthosClient CRUD methods with a pre-bound resource name and
 * EEDM version, providing a clean API like `client.persons.get(id)`.
 */

import type { PaginatedResponse, RequestOptions } from "../common/types.js";

/** Interface for the underlying client methods that EthosResource delegates to. */
export interface EthosResourceClient {
  get<T>(resource: string, id: string, version?: number, options?: RequestOptions): Promise<T>;
  getPage<T>(
    resource: string,
    offset?: number,
    limit?: number,
    version?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>>;
  getAll<T>(
    resource: string,
    pageSize?: number,
    version?: number,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown>;
  create<T>(resource: string, body: unknown, version?: number, options?: RequestOptions): Promise<T>;
  update<T>(
    resource: string,
    id: string,
    body: unknown,
    version?: number,
    options?: RequestOptions,
  ): Promise<T>;
  delete(resource: string, id: string, version?: number, options?: RequestOptions): Promise<void>;
}

/**
 * Pre-bound resource accessor for a specific EEDM resource.
 *
 * @example
 * ```ts
 * const persons = new EthosResource(client, "persons", 12);
 * const person = await persons.get<Person>("abc-123");
 * for await (const page of persons.getAll<Person>()) { ... }
 * ```
 */
export class EthosResource<TDefault = unknown> {
  constructor(
    private readonly client: EthosResourceClient,
    private readonly resourceName: string,
    private readonly version?: number,
  ) {}

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
