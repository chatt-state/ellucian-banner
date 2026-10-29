/**
 * Error hierarchy for the Banner SDK.
 *
 * All errors extend BannerError, which captures the HTTP status code
 * and optional response body. The `fromResponse()` factory method
 * parses a fetch Response and returns the correct error subclass.
 */

import { parseRetryAfter } from "./retry.js";

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

/** The request did not complete within the configured timeout. */
export class TimeoutError extends BannerError {
  override readonly name = "TimeoutError";

  constructor(
    message: string,
    /** The timeout that elapsed, in milliseconds. */
    public readonly timeoutMs?: number,
  ) {
    super(message);
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

  // The message never includes body text: Ethos/Banner error bodies often echo
  // submitted person data, and applications routinely log err.message. Only
  // machine-readable error codes (e.g. "Global.Internal.Error") are appended.
  // The raw body stays available, unredacted, in `responseBody`.
  const codes = body ? errorCodes(body) : [];
  const statusLine = `${status} ${statusText}`.trim();
  const message = codes.length > 0 ? `${statusLine} (${codes.join(", ")})` : statusLine;

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
    // Retry-After may be delay-seconds or an HTTP-date; normalize to seconds.
    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    const retryAfter = retryAfterMs === undefined ? undefined : Math.ceil(retryAfterMs / 1000);
    return new RateLimitError(message, retryAfter, body);
  }
  if (status >= 500) {
    return new ServerError(message, status, body);
  }

  return new BannerError(message, status, body);
}

/** Shape of a machine-readable error code: no spaces, so no free text or names. */
const ERROR_CODE = /^[A-Za-z][A-Za-z0-9._:-]{0,79}$/;

/**
 * Extract error codes from an Ethos-style error body
 * (`{ "errors": [{ "code": "...", "message": "..." }] }` or a bare array).
 * Messages and descriptions are deliberately ignored: they can echo PII.
 */
function errorCodes(body: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { errors?: unknown }).errors)
      ? (parsed as { errors: unknown[] }).errors
      : [];
  const codes = new Set<string>();
  for (const entry of list) {
    const code = (entry as { code?: unknown } | null)?.code;
    if (typeof code === "string" && ERROR_CODE.test(code)) codes.add(code);
    if (codes.size >= 5) break;
  }
  return [...codes];
}
