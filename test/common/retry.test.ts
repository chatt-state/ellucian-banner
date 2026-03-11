import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../../src/common/retry.js";
import { HttpClient } from "../../src/common/http-client.js";
import { ServerError, ValidationError } from "../../src/common/errors.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Helper to advance pending timers so sleep() resolves. */
  async function flushRetryDelay() {
    await vi.advanceTimersByTimeAsync(60_000);
  }

  it("should return immediately on success (200)", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const response = await withRetry(fn);

    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 400", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    const response = await withRetry(fn);

    expect(response.status).toBe(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 401", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("unauth", { status: 401 }));
    const response = await withRetry(fn);

    expect(response.status).toBe(401);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should not retry on 404", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("not found", { status: 404 }));
    const response = await withRetry(fn);

    expect(response.status).toBe(404);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on 500 and succeed on second attempt", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = withRetry(fn, { baseDelay: 100 });
    await flushRetryDelay();
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should retry on 429 and succeed on second attempt", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = withRetry(fn, { baseDelay: 100 });
    await flushRetryDelay();
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should respect Retry-After header on 429", async () => {
    const headers429 = new Headers({ "Retry-After": "2" });
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: headers429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = withRetry(fn, { baseDelay: 100 });

    // Advance less than 2 seconds — should not have retried yet
    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance past 2 seconds
    await vi.advanceTimersByTimeAsync(1000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should exhaust max retries and return last response", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("error", { status: 503 }));

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100 });
    await flushRetryDelay();
    const response = await promise;

    expect(response.status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("should apply exponential backoff", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    // Use baseDelay of 1000, so delays are ~1000, ~2000 (plus jitter)
    const promise = withRetry(fn, { baseDelay: 1000, maxRetries: 3 });

    // After first call, advance 500ms — not enough for first retry
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance to 1100ms total — first retry should fire (baseDelay * 2^0 = 1000 + jitter)
    await vi.advanceTimersByTimeAsync(700);
    expect(fn).toHaveBeenCalledTimes(2);

    // Advance another 1500ms — not enough for second retry (baseDelay * 2^1 = 2000 + jitter)
    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(2);

    // Advance enough for second retry
    await vi.advanceTimersByTimeAsync(1000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should cap delay at maxDelay", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    // baseDelay=50000 would exceed maxDelay=500
    const promise = withRetry(fn, { baseDelay: 50_000, maxDelay: 500 });

    // Advance 600ms — should be enough since maxDelay caps at 500 + jitter(100)
    await vi.advanceTimersByTimeAsync(600);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should abort during retry delay when signal is aborted", async () => {
    const fn = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));
    const controller = new AbortController();

    const promise = withRetry(fn, { baseDelay: 5000 }, controller.signal);

    // First call happens, then we abort during the delay
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();

    await expect(promise).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("HttpClient with retry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseConfig = {
    baseUrl: "https://api.example.com",
    authProvider: () => "Bearer test-token",
  };

  it("should not retry by default", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error", { status: 500, statusText: "Internal Server Error" }),
    );

    const client = new HttpClient(baseConfig);
    await expect(client.get("/test")).rejects.toThrow(ServerError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should retry when retry: true is set", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("error", { status: 500, statusText: "Internal Server Error" }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = new HttpClient({ ...baseConfig, retry: true });
    const promise = client.get("/test");
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await promise;
    const data = await response.json();

    expect(data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("should retry with custom options", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("error", { status: 502, statusText: "Bad Gateway" }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const client = new HttpClient({
      ...baseConfig,
      retry: { maxRetries: 1, baseDelay: 200 },
    });

    const promise = client.get("/test");
    await vi.advanceTimersByTimeAsync(60_000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("should not retry 400 errors even with retry enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad request", { status: 400, statusText: "Bad Request" }),
    );

    const client = new HttpClient({ ...baseConfig, retry: true });
    await expect(client.get("/test")).rejects.toThrow(ValidationError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should throw after max retries exhausted", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error", { status: 500, statusText: "Internal Server Error" }),
    );

    const client = new HttpClient({
      ...baseConfig,
      retry: { maxRetries: 2, baseDelay: 100 },
    });

    const promise = client.get("/test").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    const error = await promise;
    expect(error).toBeInstanceOf(ServerError);
    expect(fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
