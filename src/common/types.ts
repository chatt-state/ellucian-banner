export interface RequestOptions {
  /** Additional headers to include. */
  headers?: Record<string, string>;
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
}

export interface PaginatedResponse<T> {
  data: T[];
  /**
   * Total matching rows, from the `x-total-count` header. When the server
   * omits that header this is a lower bound (`offset + data.length`).
   */
  totalCount: number;
  offset: number;
  hasMore: boolean;
  /** Server page-size cap from the `x-max-page-size` header, when present. */
  maxPageSize?: number;
}
