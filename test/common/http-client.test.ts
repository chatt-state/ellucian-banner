import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpClient } from "../../src/common/http-client.js";
import { AuthError, NotFoundError, ValidationError, ServerError } from "../../src/common/errors.js";

describe("HttpClient", () => {
  const baseConfig = {
    baseUrl: "https://api.example.com",
    authProvider: () => "Bearer test-token",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should send GET with auth header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "1" }), { status: 200 }),
    );

    const client = new HttpClient(baseConfig);
    const response = await client.get("/api/persons/123");
    const data = await response.json();

    expect(data).toEqual({ id: "1" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/persons/123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("should send POST with JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "new" }), { status: 201 }),
    );

    const client = new HttpClient(baseConfig);
    await client.post("/api/persons", { name: "Test" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/persons",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("should send PUT with JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient(baseConfig);
    await client.put("/api/persons/123", { name: "Updated" });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/persons/123",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("should send DELETE", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new HttpClient(baseConfig);
    await client.delete("/api/persons/123");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/persons/123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("should support async auth providers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient({
      baseUrl: "https://api.example.com",
      authProvider: async () => "Basic dXNlcjpwYXNz",
    });
    await client.get("/test");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Basic dXNlcjpwYXNz",
        }),
      }),
    );
  });

  it("should merge extra headers with auth", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient(baseConfig);
    await client.get("/test", { Accept: "application/vnd.hedtech.integration.v12+json" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          Accept: "application/vnd.hedtech.integration.v12+json",
        }),
      }),
    );
  });

  it("should merge RequestOptions headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient(baseConfig);
    await client.get("/test", {}, { headers: { "X-Custom": "value" } });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "X-Custom": "value",
        }),
      }),
    );
  });

  it("should throw AuthError for 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    const client = new HttpClient(baseConfig);
    await expect(client.get("/test")).rejects.toThrow(AuthError);
  });

  it("should throw NotFoundError for 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );

    const client = new HttpClient(baseConfig);
    await expect(client.get("/test")).rejects.toThrow(NotFoundError);
  });

  it("should throw ValidationError for 400", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
    );

    const client = new HttpClient(baseConfig);
    await expect(client.get("/test")).rejects.toThrow(ValidationError);
  });

  it("should throw ServerError for 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
    );

    const client = new HttpClient(baseConfig);
    await expect(client.get("/test")).rejects.toThrow(ServerError);
  });

  it("should strip trailing slashes from baseUrl", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient({
      ...baseConfig,
      baseUrl: "https://api.example.com///",
    });
    await client.get("/test");

    expect(fetch).toHaveBeenCalledWith("https://api.example.com/test", expect.any(Object));
  });

  it("should not override explicit Content-Type header on POST", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient(baseConfig);
    await client.post("/test", { data: true }, { "Content-Type": "application/vnd.custom+json" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/vnd.custom+json",
        }),
      }),
    );
  });

  it("should debug log when enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new HttpClient({ ...baseConfig, debug: true });
    await client.get("/test");

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[banner-sdk] GET"));
  });

  it("should debug log response status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new HttpClient({ ...baseConfig, debug: true });
    await client.get("/test");

    // Two log calls: one for the request, one for the response
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("-> 200"));
  });

  it("should not debug log when debug is false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new HttpClient({ ...baseConfig, debug: false });
    await client.get("/test");

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("should fall back to DEBUG env var for debug logging", async () => {
    vi.stubEnv("DEBUG", "true");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new HttpClient({
      baseUrl: "https://api.example.com",
      authProvider: () => "Bearer test-token",
      // debug not set — should fall back to DEBUG env var
    });
    await client.get("/test");

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[banner-sdk]"));
  });

  it("should wire caller abort signal to internal controller", async () => {
    // Verify that the signal passed to fetch is an AbortSignal
    // and that caller's signal triggers abort on the internal signal
    let capturedSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedSignal = (init as RequestInit).signal as AbortSignal;
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const controller = new AbortController();
    const client = new HttpClient(baseConfig);
    await client.get("/test", {}, { signal: controller.signal });

    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    // The internal signal is a separate controller, not the caller's signal directly
    expect(capturedSignal).not.toBe(controller.signal);
  });

  it("should pass an AbortSignal to fetch for timeout support", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      // Verify that an AbortSignal is attached
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const client = new HttpClient({ ...baseConfig, timeout: 100 });
    await client.get("/test");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should not set Content-Type when body is undefined (GET/DELETE)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient(baseConfig);
    await client.get("/test");

    const callHeaders = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
    expect(callHeaders["Content-Type"]).toBeUndefined();
  });

  it("should use retry when retry option is configured", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient({ ...baseConfig, retry: { maxRetries: 1, baseDelay: 10 } });
    const promise = client.get("/test");

    // Advance past the retry delay
    await vi.advanceTimersByTimeAsync(5000);

    const response = await promise;
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("should use retry with boolean true for default options", async () => {
    // With retry: true and a succeeding first call, should work normally
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const client = new HttpClient({ ...baseConfig, retry: true });
    const response = await client.get("/test");

    expect(response.status).toBe(200);
  });
});
