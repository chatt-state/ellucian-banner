import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseRetryAfter, withRetry } from "../../src/common/retry.js";
import { fromResponse, RateLimitError } from "../../src/common/errors.js";

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");

  it("parses delay-seconds", () => {
    expect(parseRetryAfter("120", now)).toBe(120_000);
    expect(parseRetryAfter(" 0 ", now)).toBe(0);
  });

  it("parses an HTTP-date relative to now", () => {
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:30 GMT", now)).toBe(30_000);
  });

  it("clamps past dates to zero", () => {
    expect(parseRetryAfter("Wed, 31 Dec 2025 23:00:00 GMT", now)).toBe(0);
  });

  it("returns undefined for missing or junk values", () => {
    expect(parseRetryAfter(null, now)).toBeUndefined();
    expect(parseRetryAfter(undefined, now)).toBeUndefined();
    expect(parseRetryAfter("", now)).toBeUndefined();
    expect(parseRetryAfter("soon", now)).toBeUndefined();
    expect(parseRetryAfter("-5", now)).toBeUndefined();
  });
});

describe("withRetry Retry-After handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits until an HTTP-date Retry-After", async () => {
    const fn = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response("", {
          status: 429,
          headers: { "Retry-After": "Thu, 01 Jan 2026 00:00:05 GMT" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok"));

    const p = withRetry(fn, { maxRetries: 1, baseDelay: 1 });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect((await p).status).toBe(200);
  });

  it("honors Retry-After on 503 as well as 429", async () => {
    const fn = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response("", { status: 503, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response("ok"));
    const p = withRetry(fn, { maxRetries: 1, baseDelay: 1 });
    await vi.advanceTimersByTimeAsync(2_900);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect((await p).status).toBe(200);
  });

  it("returns immediately when Retry-After exceeds maxDelay", async () => {
    const fn = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "600" } }));
    const res = await withRetry(fn, { maxRetries: 3, maxDelay: 10_000 });
    expect(res.status).toBe(429);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry 5xx when retryServerErrors is false", async () => {
    const fn = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValue(new Response("", { status: 500 }));
    const res = await withRetry(fn, { maxRetries: 3 }, undefined, { retryServerErrors: false });
    expect(res.status).toBe(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows errors that are not marked retryable", async () => {
    const fn = vi.fn<() => Promise<Response>>().mockRejectedValue(new Error("boom"));
    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows a retryable error once retries are exhausted", async () => {
    const fn = vi.fn<() => Promise<Response>>().mockRejectedValue(new TypeError("fetch failed"));
    const p = withRetry(fn, { maxRetries: 2, baseDelay: 10 }, undefined, {
      shouldRetryError: (e) => e instanceof TypeError,
    });
    const assertion = expect(p).rejects.toThrow("fetch failed");
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("fromResponse Retry-After", () => {
  it("converts an HTTP-date Retry-After to seconds on RateLimitError", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const err = await fromResponse(
      new Response("", {
        status: 429,
        headers: { "Retry-After": "Thu, 01 Jan 2026 00:01:00 GMT" },
      }),
    );
    vi.useRealTimers();
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(60);
  });
});
