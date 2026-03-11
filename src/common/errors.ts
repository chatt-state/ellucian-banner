/**
 * Error hierarchy for the Banner SDK.
 *
 * All errors extend BannerError, which captures the HTTP status code
 * and optional response body. The `fromResponse()` factory method
 * parses a fetch Response and returns the correct error subclass.
 */

/** Base error for all Banner SDK errors. */
export class BannerError extends Error {
  /** The error class name (e.g., "AuthError", "NotFoundError"). */
  override readonly name: string = "BannerError";

  constructor(
    message: string,
    /** HTTP status code, if applicable. */
    public readonly statusCode?: number,
    /** Raw response body text, when available. */
    public readonly responseBody?: string,
  ) {
    super(message);
  }
}

/** Authentication or authorization failure (401/403). */
export class AuthError extends BannerError {
  override readonly name = "AuthError";

  constructor(message: string, statusCode?: number, responseBody?: string) {
    super(message, statusCode, responseBody);
  }
}

/** Resource not found (404). */
export class NotFoundError extends BannerError {
  override readonly name = "NotFoundError";

  constructor(message: string, responseBody?: string) {
    super(message, 404, responseBody);
  }
}

/** Rate limit exceeded (429). */
export class RateLimitError extends BannerError {
  override readonly name = "RateLimitError";

  constructor(
    message: string,
    /** Seconds to wait before retrying, from Retry-After header. */
    public readonly retryAfter?: number,
    responseBody?: string,
  ) {
    super(message, 429, responseBody);
  }
}

/** Client-side validation error (400). */
export class ValidationError extends BannerError {
  override readonly name = "ValidationError";

  constructor(message: string, responseBody?: string) {
    super(message, 400, responseBody);
  }
}

/** Server-side error (5xx). */
export class ServerError extends BannerError {
  override readonly name = "ServerError";

  constructor(message: string, statusCode: number, responseBody?: string) {
    super(message, statusCode, responseBody);
  }
}

/**
 * Creates the appropriate BannerError subclass from a fetch Response.
 *
 * Reads the response body (if available) and maps the HTTP status code
 * to the correct error type. This is the primary way errors should be
 * constructed from API responses.
 */
export async function fromResponse(response: Response): Promise<BannerError> {
  const { status, statusText } = response;
  let body: string | undefined;
  try {
    body = await response.text();
  } catch {
    // body unavailable
  }

  const message = body
    ? `${status} ${statusText}: ${truncate(body, 200)}`
    : `${status} ${statusText}`;

  if (status === 400) {
    return new ValidationError(message, body);
  }
  if (status === 401 || status === 403) {
    return new AuthError(message, status, body);
  }
  if (status === 404) {
    return new NotFoundError(message, body);
  }
  if (status === 429) {
    const retryAfter = parseInt(response.headers.get("retry-after") ?? "", 10);
    return new RateLimitError(message, isNaN(retryAfter) ? undefined : retryAfter, body);
  }
  if (status >= 500) {
    return new ServerError(message, status, body);
  }

  return new BannerError(message, status, body);
}

/** Truncates a string to maxLen, appending "..." if truncated. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}
