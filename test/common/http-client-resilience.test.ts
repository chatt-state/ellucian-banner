import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpClient } from "../../src/common/http-client.js";
import { AuthError, ServerError, TimeoutError, RateLimitError } from "../../src/common/errors.js";

const baseConfig = {
  baseUrl: "https://api.example.com",
  authProvider: () => "Bearer t",
};

describe("HttpClient 401 re-authentication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once with a fresh auth header when onUnauthorized returns true", async () => {
    let n = 0;
    const authProvider = vi.fn(() => `Bearer token-${++n}`);
    const onUnauthorized = vi.fn(() => true);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient({ ...baseConfig, authProvider, onUnauthorized });
    const res = await client.get("/x");

    expect(res.status).toBe(200);
    expect(onUnauthorized).toHaveBeenCalledWith("Bearer token-1");
    const headers = vi
      .mocked(fetch)
      .mock.calls.map((c) => (c[1]!.headers as Record<string, string>).Authorization);
    expect(headers).toEqual(["Bearer token-1", "Bearer token-2"]);
  });

  it("only retries once and then throws AuthError", async () => {
    const onUnauthorized = vi.fn(() => true);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("no", { status: 401 }),
    );

    const client = new HttpClient({ ...baseConfig, onUnauthorized });
    await expect(client.get("/x")).rejects.toThrow(AuthError);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not retry when onUnauthorized returns false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 401 }));
    const client = new HttpClient({ ...baseConfig, onUnauthorized: () => false });
    await expect(client.get("/x")).rejects.toThrow(AuthError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not re-authenticate on 403", async () => {
    const onUnauthorized = vi.fn(() => true);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 403 }));
    const client = new HttpClient({ ...baseConfig, onUnauthorized });
    await expect(client.get("/x")).rejects.toThrow(AuthError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("re-sends the same body on the retried POST", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    const client = new HttpClient({ ...baseConfig, onUnauthorized: () => true });
    await client.post("/x", { a: 1 });
    const bodies = vi.mocked(fetch).mock.calls.map((c) => c[1]!.body);
    expect(bodies).toEqual(['{"a":1}', '{"a":1}']);
  });
});

describe("HttpClient timeouts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** fetch mock that never resolves but rejects when its signal aborts. */
  function hangingFetch() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          // Mirrors real fetch: rejects with the signal's reason, immediately if already aborted.
          const signal = (init as RequestInit).signal!;
          if (signal.aborted) return reject(signal.reason);
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );
  }

  it("rejects with TimeoutError when the timeout elapses", async () => {
    vi.useFakeTimers();
    hangingFetch();
    const client = new HttpClient({ ...baseConfig, timeout: 1000 });
    const p = client.get("/slow");
    const assertion = expect(p).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  it("applies the timeout per attempt, not across retries", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 503, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    // Timeout (1.5s) shorter than the Retry-After wait (2s): must still succeed.
    const client = new HttpClient({ ...baseConfig, timeout: 1500, retry: { maxRetries: 1 } });
    const p = client.get("/x");
    await vi.advanceTimersByTimeAsync(2100);
    expect((await p).status).toBe(200);
  });

  it("propagates the caller's abort reason", async () => {
    hangingFetch();
    const controller = new AbortController();
    const client = new HttpClient(baseConfig);
    const p = client.get("/x", {}, { signal: controller.signal });
    controller.abort(new Error("user cancelled"));
    await expect(p).rejects.toThrow("user cancelled");
  });

  it("aborts immediately if the caller's signal is already aborted", async () => {
    hangingFetch();
    const client = new HttpClient(baseConfig);
    await expect(
      client.get("/x", {}, { signal: AbortSignal.abort(new Error("already")) }),
    ).rejects.toThrow("already");
  });

  it("removes its listener from the caller's signal after the request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const client = new HttpClient(baseConfig);
    await client.get("/x", {}, { signal: controller.signal });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

describe("HttpClient retry safety", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not retry a POST on 5xx (could duplicate a create)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("err", { status: 502 }));
    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 3, baseDelay: 1 } });
    await expect(client.post("/things", {})).rejects.toThrow(ServerError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a POST marked idempotent on 5xx", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 1, baseDelay: 10 } });
    const p = client.post("/qapi/x", {}, undefined, undefined, { idempotent: true });
    await vi.advanceTimersByTimeAsync(500);
    expect((await p).status).toBe(200);
  });

  it("retries a POST on 429 (request was not processed)", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 1, baseDelay: 10 } });
    const p = client.post("/things", {});
    await vi.advanceTimersByTimeAsync(500);
    expect((await p).status).toBe(201);
  });

  it("retries network errors for GET", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 2, baseDelay: 10 } });
    const p = client.get("/x");
    await vi.advanceTimersByTimeAsync(500);
    expect((await p).status).toBe(200);
  });

  it("does not retry network errors for POST", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 2, baseDelay: 1 } });
    await expect(client.post("/x", {})).rejects.toThrow("fetch failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces RateLimitError when Retry-After exceeds maxDelay", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 429, headers: { "Retry-After": "3600" } }),
    );
    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 3, maxDelay: 30_000 } });
    const err = await client.get("/x").catch((e: unknown) => e as RateLimitError);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfter).toBe(3600);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("HttpClient headers and logging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("treats Content-Type case-insensitively (no duplicate header)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}"));
    const client = new HttpClient(baseConfig);
    await client.post("/x", {}, { "content-type": "application/vnd.hedtech.integration.v12+json" });
    const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["content-type"]).toBe("application/vnd.hedtech.integration.v12+json");
  });

  it("sends PATCH with a JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}"));
    const client = new HttpClient(baseConfig);
    await client.patch("/x", { a: 1 });
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: "PATCH", body: '{"a":1}' });
  });

  it("redacts query strings (possible PII) from debug logs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("[]"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new HttpClient({ ...baseConfig, debug: true });
    await client.get('/api/persons?criteria={"names":[{"lastName":"Doe"}]}');
    const output = log.mock.calls.flat().join("\n");
    expect(output).toContain("/api/persons?[redacted]");
    expect(output).not.toContain("Doe");
  });

  it("ignores unrelated DEBUG namespaces", async () => {
    vi.stubEnv("DEBUG", "express:*");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await new HttpClient(baseConfig).get("/x");
    expect(log).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("enables logging for DEBUG=ellucian-banner", async () => {
    vi.stubEnv("DEBUG", "app,ellucian-banner");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await new HttpClient(baseConfig).get("/x");
    expect(log).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
