import { describe, it, expect, vi, beforeEach } from "vitest";
import { BannerClient, BannerApiClient } from "../../src/banner/client.js";
import type { QueryValue } from "../../src/banner/client.js";
import type { RequestOptions } from "../../src/common/types.js";

const config = { baseUrl: "https://banner.example.edu", username: "u", password: "p" };

/** Shaped like codegen output. */
class GeneratedClient extends BannerApiClient {
  static readonly basePath = "/StudentApi/api";

  async listTerms(query?: { "max-rows"?: number; active?: boolean }, options?: RequestOptions) {
    return this.get<unknown[]>(this.withQuery("/terms", query), options);
  }

  rawQuery(path: string, q?: Record<string, QueryValue>) {
    return this.withQuery(path, q);
  }
}

describe("BannerApiClient extras", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves undefined for 204 No Content on POST/PUT", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const banner = new BannerClient(config);
    await expect(banner.studentApi.post("/x", { a: 1 })).resolves.toBeUndefined();
    await expect(banner.studentApi.put("/x", { a: 1 })).resolves.toBeUndefined();
  });

  it("sends PATCH requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response('{"ok":true}'));
    const banner = new BannerClient(config);
    expect(await banner.studentApi.patch("/x", { a: 1 })).toEqual({ ok: true });
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: "PATCH" });
  });

  it("raises a BannerError for a non-JSON success body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("<html>login</html>"));
    const banner = new BannerClient(config);
    await expect(banner.studentApi.get("/x")).rejects.toThrow("Expected a JSON response body");
  });

  it("use() binds a generated client with its spec basePath", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("[]"));
    const banner = new BannerClient(config);
    const api = banner.use(GeneratedClient);
    await api.listTerms({ "max-rows": 5, active: true });
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
      "https://banner.example.edu/StudentApi/api/terms?max-rows=5&active=true",
    );
  });

  it("use() accepts an explicit basePath override", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("[]"));
    const banner = new BannerClient(config);
    await banner.use(GeneratedClient, "custom/api/").listTerms();
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe("https://banner.example.edu/custom/api/terms");
  });

  it("withQuery skips null/undefined and appends to existing queries", () => {
    const api = new BannerClient(config).use(GeneratedClient);
    expect(api.rawQuery("/a", { x: undefined, y: null })).toBe("/a");
    expect(api.rawQuery("/a?z=1", { q: "a b&c" })).toBe("/a?z=1&q=a+b%26c");
    expect(api.rawQuery("/a")).toBe("/a");
  });
});
