import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EthosClient } from "../../src/ethos/client.js";
import { AuthError } from "../../src/common/errors.js";
import { eedmMediaType } from "../../src/ethos/media-type.js";

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}

function urlOf(call: number): string {
  return vi.mocked(fetch).mock.calls[call]![0] as string;
}

function headersOf(call: number): Record<string, string> {
  return vi.mocked(fetch).mock.calls[call]![1]!.headers as Record<string, string>;
}

describe("EthosClient 401 handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("force-refreshes the token once on 401 and retries the call", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("token-1")) // /auth
      .mockResolvedValueOnce(new Response("expired", { status: 401 })) // API
      .mockResolvedValueOnce(new Response("token-2")) // /auth (forced)
      .mockResolvedValueOnce(json({ id: "p1" })); // API retry

    const client = new EthosClient({ apiKey: "k" });
    const person = await client.get("persons", "p1");

    expect(person).toEqual({ id: "p1" });
    expect(urlOf(0)).toMatch(/\/auth$/);
    expect(urlOf(2)).toMatch(/\/auth$/);
    expect(headersOf(1).Authorization).toBe("Bearer token-1");
    expect(headersOf(3).Authorization).toBe("Bearer token-2");
  });

  it("throws AuthError if the retried call is also 401", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("token-1"))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("token-2"))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    const client = new EthosClient({ apiKey: "k" });
    await expect(client.get("persons", "p1")).rejects.toThrow(AuthError);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("concurrent 401s trigger a single token refresh", async () => {
    let authCalls = 0;
    let apiCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth")) {
        authCalls++;
        return new Response(`token-${authCalls}`);
      }
      apiCalls++;
      const auth = (init!.headers as Record<string, string>).Authorization;
      return auth === "Bearer token-1"
        ? new Response("", { status: 401 })
        : json([], 200, { "x-total-count": "0" });
    });

    const client = new EthosClient({ apiKey: "k" });
    // Fire 5 requests that all get 401 with token-1.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => client.getPage("persons", 0, 1)),
    );

    expect(results).toHaveLength(5);
    expect(authCalls).toBe(2);
    expect(apiCalls).toBe(10);
  });
});

describe("EthosClient request building", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("URL-encodes resource ids", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t"))
      .mockResolvedValueOnce(json({}));
    const client = new EthosClient({ apiKey: "k" });
    await client.get("persons", "a b?c#d&e");
    expect(urlOf(1)).toBe("https://integrate.elluciancloud.com/api/persons/a%20b%3Fc%23d%26e");
  });

  it("rejects empty ids and resource names", async () => {
    const client = new EthosClient({ apiKey: "k" });
    await expect(client.get("persons", "")).rejects.toThrow(TypeError);
    await expect(client.getPage("", 0, 10)).rejects.toThrow(TypeError);
  });

  it("rejects invalid offset/limit", async () => {
    const client = new EthosClient({ apiKey: "k" });
    await expect(client.getPage("persons", -1, 10)).rejects.toThrow(TypeError);
    await expect(client.getPage("persons", 0, 0)).rejects.toThrow(TypeError);
  });

  it("accepts semantic-version strings for EEDM versions", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t"))
      .mockResolvedValueOnce(json({ id: "x" }));
    const client = new EthosClient({ apiKey: "k" });
    await client.update("persons", "x", { id: "x" }, "12.1.0");
    expect(headersOf(1).Accept).toBe("application/vnd.hedtech.integration.v12.1.0+json");
    expect(headersOf(1)["Content-Type"]).toBe("application/vnd.hedtech.integration.v12.1.0+json");
  });

  it("resolves a DELETE 204 without parsing a body", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new EthosClient({ apiKey: "k" });
    await expect(client.delete("persons", "x")).resolves.toBeUndefined();
  });

  it("filterAll pages through criteria results", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t"))
      .mockResolvedValueOnce(json([{ id: 1 }, { id: 2 }], 200, { "x-total-count": "3" }))
      .mockResolvedValueOnce(json([{ id: 3 }], 200, { "x-total-count": "3" }));
    const client = new EthosClient({ apiKey: "k" });
    const all: unknown[] = [];
    for await (const page of client.filterAll("persons", { names: [{ lastName: "Doe" }] }, 2)) {
      all.push(...page);
    }
    expect(all).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(urlOf(1)).toContain("criteria=");
    expect(urlOf(2)).toContain("offset=2&limit=2");
  });

  it("retries GETs on 429 by default (honoring Retry-After)", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t"))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(json({ id: "x" }));
    const client = new EthosClient({ apiKey: "k" });
    const p = client.get("persons", "x");
    await vi.advanceTimersByTimeAsync(1_100);
    expect(await p).toEqual({ id: "x" });
    vi.useRealTimers();
  });

  it("can disable retries", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t"))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    const client = new EthosClient({ apiKey: "k", retry: false });
    await expect(client.get("persons", "x")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("eedmMediaType", () => {
  it.each([
    [undefined, "application/json"],
    [0, "application/json"],
    ["", "application/json"],
    [12, "application/vnd.hedtech.integration.v12+json"],
    ["12", "application/vnd.hedtech.integration.v12+json"],
    ["v16.1.0", "application/vnd.hedtech.integration.v16.1.0+json"],
    ["application/vnd.hedtech.integration.v6+json", "application/vnd.hedtech.integration.v6+json"],
  ])("maps %s to %s", (input, expected) => {
    expect(eedmMediaType(input as never)).toBe(expected);
  });

  it.each([[-1], [1.5], ["latest"], ["12.x"]])("rejects %s", (input) => {
    expect(() => eedmMediaType(input as never)).toThrow(TypeError);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
