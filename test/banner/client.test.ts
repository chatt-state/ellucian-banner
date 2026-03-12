import { describe, it, expect, vi, beforeEach } from "vitest";
import { BannerClient, BannerApiClient } from "../../src/banner/client.js";

function mockJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

describe("BannerClient", () => {
  const config = {
    baseUrl: "https://banner.example.edu",
    username: "testuser",
    password: "testpass",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should create with Basic Auth", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({ id: "1" }));

    const client = new BannerClient(config);
    await client.studentApi.get("/student/v1/students/123");

    const [url, opts] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://banner.example.edu/StudentApi/api/student/v1/students/123");
    const headers = opts!.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Basic /);
  });

  it("should send GET via studentApi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson([{ id: "1" }]));

    const client = new BannerClient(config);
    const data = await client.studentApi.get("/student/v1/students");

    expect(data).toEqual([{ id: "1" }]);
  });

  it("should send POST via studentApi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({ id: "new" }, 201));

    const client = new BannerClient(config);
    const data = await client.studentApi.post("/student/v1/students", { name: "Test" });

    expect(data).toEqual({ id: "new" });
    const [, opts] = vi.mocked(fetch).mock.calls[0]!;
    expect(opts!.method).toBe("POST");
  });

  it("should send PUT via adminBpapi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({ updated: true }));

    const client = new BannerClient(config);
    const data = await client.adminBpapi.put("/some/resource/1", { field: "value" });

    expect(data).toEqual({ updated: true });
    const [url, opts] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toContain("/BannerAdminBPAPI/api/some/resource/1");
    expect(opts!.method).toBe("PUT");
  });

  it("should send DELETE via adminBpapi", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = new BannerClient(config);
    await client.adminBpapi.delete("/some/resource/1");

    const [, opts] = vi.mocked(fetch).mock.calls[0]!;
    expect(opts!.method).toBe("DELETE");
  });

  it("should create custom API sub-client", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({ ok: true }));

    const client = new BannerClient(config);
    const custom = client.api("/CustomApi/api");
    const data = await custom.get("/endpoint");

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://banner.example.edu/CustomApi/api/endpoint");
    expect(data).toEqual({ ok: true });
  });

  it("should return raw Response from getRaw", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({ raw: true }));

    const client = new BannerClient(config);
    const response = await client.studentApi.getRaw("/test");

    expect(response).toBeInstanceOf(Response);
    const data = await response.json();
    expect(data).toEqual({ raw: true });
  });

  it("should use Accept: application/json headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({}));

    const client = new BannerClient(config);
    await client.studentApi.get("/test");

    const [, opts] = vi.mocked(fetch).mock.calls[0]!;
    const headers = opts!.headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });

  it("should strip trailing slashes from custom API path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockJson({}));

    const client = new BannerClient(config);
    const custom = client.api("/CustomApi/api///");
    await custom.get("/test");

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://banner.example.edu/CustomApi/api/test");
  });
});
