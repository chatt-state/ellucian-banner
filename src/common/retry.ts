/**
 * Retry logic with exponential backoff for HTTP requests.
 *
 * Retries only on transient errors (429 rate limit and 5xx server errors).
 * Client errors (4xx except 429) are never retried.
 */

/** Configuration for retry behavior. */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds before first retry (default: 1000). */
  baseDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 30000). */
  maxDelay?: number;
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

/** Returns true if the status code is retryable (429 or 5xx). */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Calculates delay with exponential backoff, jitter, and Retry-After support. */
function calculateDelay(
  attempt: number,
  options: ResolvedRetryOptions,
  retryAfterHeader?: string | null,
): number {
  // Respect Retry-After header on 429 responses
  if (retryAfterHeader) {
    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }

  // Exponential backoff: baseDelay * 2^attempt + jitter
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

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 *
 * Only retries on 429 (rate limit) and 5xx (server error) responses.
 * All other non-ok responses are returned immediately for normal error handling.
 * After max retries are exhausted, the last response is returned.
 *
 * @param fn - Function that performs the fetch and returns a Response
 * @param options - Retry configuration
 * @param signal - Optional AbortSignal to cancel retries
 * @returns The successful or final failed Response
 */
export async function withRetry(
  fn: () => Promise<Response>,
  options?: RetryOptions,
  signal?: AbortSignal,
): Promise<Response> {
  const resolved: ResolvedRetryOptions = {
    maxRetries: options?.maxRetries ?? DEFAULTS.maxRetries,
    baseDelay: options?.baseDelay ?? DEFAULTS.baseDelay,
    maxDelay: options?.maxDelay ?? DEFAULTS.maxDelay,
  };

  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= resolved.maxRetries; attempt++) {
    // Wait before retry (not before the first attempt)
    if (attempt > 0 && lastResponse) {
      const retryAfter = lastResponse.headers.get("retry-after");
      const delay = calculateDelay(attempt - 1, resolved, retryAfter);
      await sleep(delay, signal);
    }

    const response = await fn();

    if (response.ok || !isRetryable(response.status)) {
      return response;
    }

    lastResponse = response;
  }

  // Max retries exhausted — return last response for normal error handling
  return lastResponse!;
}
