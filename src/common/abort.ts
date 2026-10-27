/**
 * AbortSignal helpers.
 */

/** The error a fetch rejects with when aborted without a reason. */
export function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("This operation was aborted", "AbortError");
}

/**
 * Settle with `promise`, or reject as soon as `signal` aborts.
 *
 * The underlying work is not cancelled. Use this when the work is shared by
 * several callers (e.g. a token refresh) and one caller giving up must not
 * cancel it for the others.
 */
export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    // Keep the shared promise from surfacing as an unhandled rejection.
    promise.catch(() => undefined);
    return Promise.reject(abortReason(signal));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
