export interface RequestOptions {
  /** Additional headers to include. */
  headers?: Record<string, string>;
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  offset: number;
  hasMore: boolean;
}
