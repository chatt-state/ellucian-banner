/**
 * Retry logic with exponential backoff for HTTP requests.
 *
 * Retries on transient errors: 429 (rate limit) and 5xx (server error)
 * responses, and optionally on thrown network/timeout errors. Client errors
 * (4xx except 429) are never retried.
 */

/** Configuration for retry behavior. */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds before first retry (default: 1000). */
  baseDelay?: number;
  /**
   * Maximum delay in milliseconds between retries (default: 30000).
   *
   * If the server sends a `Retry-After` longer than this, the request is not
   * retried and the 429/503 response is surfaced to the caller instead
   * (as a `RateLimitError` / `ServerError` carrying the server's hint).
   */
  maxDelay?: number;
}

/** Internal per-call retry behavior, set by HttpClient. */
export interface RetryBehavior {
  /**
   * Whether 5xx responses may be retried. 429 responses are always retryable
   * because the server rejected the request without processing it. Defaults to true.
   */
  retryServerErrors?: boolean;
  /** Predicate deciding whether a thrown error (network failure, timeout) is retryable. */
  shouldRetryError?: (error: unknown) => boolean;
}

/** Resolved retry options with defaults applied. */
interface ResolvedRetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULTS: ResolvedRetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
};

/**
 * Parse a `Retry-After` header value into milliseconds.
 *
 * Supports both forms allowed by RFC 9110: delay-seconds (`"120"`) and an
 * HTTP-date (`"Wed, 21 Oct 2015 07:28:00 GMT"`). Returns undefined when the
 * header is absent or unparseable. Negative or past values yield 0.
 */
export function parseRetryAfter(
  header: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (header === null || header === undefined) return undefined;
  const value = header.trim();
  if (value === "") return undefined;

  if (/^\d+$/.test(value)) {
    return parseInt(value, 10) * 1000;
  }

  // An HTTP-date always contains day/month names; this avoids Date.parse
  // accepting junk like "-5" as a year.
  if (!/[A-Za-z]/.test(value)) return undefined;
  const date = Date.parse(value);
  if (!isNaN(date)) {
    return Math.max(0, date - now);
  }
  return undefined;
}

/** Calculates exponential backoff with jitter. */
function backoffDelay(attempt: number, options: ResolvedRetryOptions): number {
  const exponentialDelay = options.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 100;
  return Math.min(exponentialDelay + jitter, options.maxDelay);
}

/** Sleeps for the given duration, respecting an optional AbortSignal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Releases the underlying connection of a response we are about to discard. */
async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // ignore — body may already be consumed or locked
  }
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 *
 * Retries on 429 (rate limit) and, unless disabled, 5xx (server error)
 * responses. A `Retry-After` header (seconds or HTTP-date) takes precedence
 * over the computed backoff. All other non-ok responses are returned
 * immediately for normal error handling. After max retries are exhausted,
 * the last response is returned.
 *
 * @param fn - Function that performs the fetch and returns a Response
 * @param options - Retry configuration
 * @param signal - Optional AbortSignal to cancel retries
 * @param behavior - Internal knobs (which failures are safe to retry)
 * @returns The successful or final failed Response
 */
export async function withRetry(
  fn: () => Promise<Response>,
  options?: RetryOptions,
  signal?: AbortSignal,
  behavior: RetryBehavior = {},
): Promise<Response> {
  const resolved: ResolvedRetryOptions = {
    maxRetries: options?.maxRetries ?? DEFAULTS.maxRetries,
    baseDelay: options?.baseDelay ?? DEFAULTS.baseDelay,
    maxDelay: options?.maxDelay ?? DEFAULTS.maxDelay,
  };
  const retryServerErrors = behavior.retryServerErrors ?? true;

  const isRetryableStatus = (status: number) =>
    status === 429 || (retryServerErrors && status >= 500);

  for (let attempt = 0; ; attempt++) {
    const isLastAttempt = attempt >= resolved.maxRetries;
    let response: Response;

    try {
      response = await fn();
    } catch (error) {
      if (isLastAttempt || signal?.aborted || !behavior.shouldRetryError?.(error)) {
        throw error;
      }
      await sleep(backoffDelay(attempt, resolved), signal);
      continue;
    }

    if (response.ok || !isRetryableStatus(response.status) || isLastAttempt) {
      return response;
    }

    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    if (retryAfter !== undefined && retryAfter > resolved.maxDelay) {
      // Server asked us to wait longer than we are willing to — surface it.
      return response;
    }

    await discardBody(response);
    await sleep(retryAfter ?? backoffDelay(attempt, resolved), signal);
  }
}
