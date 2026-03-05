/** Base error for all Banner SDK errors. */
export class BannerError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "BannerError";
  }
}

/** Authentication or authorization failure. */
export class AuthError extends BannerError {
  constructor(message: string, statusCode?: number) {
    super(message, statusCode);
    this.name = "AuthError";
  }
}

/** Resource not found (404). */
export class NotFoundError extends BannerError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/** Rate limit exceeded (429). */
export class RateLimitError extends BannerError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message, 429);
    this.name = "RateLimitError";
  }
}
