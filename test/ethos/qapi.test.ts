import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosQapi } from "../../src/ethos/qapi.js";
import { HttpClient } from "../../src/common/http-client.js";

function mockResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}

function createHttpClient() {
  return new HttpClient({
    baseUrl: "https://integrate.elluciancloud.com",
    authProvider: () => "Bearer mock-token",
  });
}

describe("EthosQapi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("search", () => {
    it("should POST criteria to /qapi/{resource}", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([{ id: "1" }, { id: "2" }], 200, { "x-total-count": "5" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      const result = await qapi.search("persons", { lastName: "Smith" });

      expect(result.data).toEqual([{ id: "1" }, { id: "2" }]);
      expect(result.totalCount).toBe(5);
      expect(result.hasMore).toBe(true);
      expect(result.offset).toBe(0);

      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toContain("/qapi/persons?offset=0&limit=25");
      expect(init!.method).toBe("POST");
      expect(init!.body).toBe(JSON.stringify({ lastName: "Smith" }));
    });

    it("should pass offset and limit", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([{ id: "3" }], 200, { "x-total-count": "3" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      const result = await qapi.search("persons", { lastName: "Smith" }, 2, 1);

      expect(result.offset).toBe(2);
      expect(result.hasMore).toBe(false);

      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain("offset=2&limit=1");
    });

    it("should send EEDM versioned headers when version specified", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([], 200, { "x-total-count": "0" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      await qapi.search("persons", {}, 0, 25, 12);

      const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v12+json");
      expect(headers["Content-Type"]).toBe("application/vnd.hedtech.integration.v12+json");
    });

    it("should use application/json when no version specified", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([], 200, { "x-total-count": "0" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      await qapi.search("persons", {});

      const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/json");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should handle empty results", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([], 200, { "x-total-count": "0" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      const result = await qapi.search("persons", { lastName: "Nobody" });

      expect(result.data).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("searchAll", () => {
    it("should yield all pages of results", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          mockResponse([{ id: "1" }, { id: "2" }], 200, { "x-total-count": "3" }),
        )
        .mockResolvedValueOnce(
          mockResponse([{ id: "3" }], 200, { "x-total-count": "3" }),
        );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      const allPages: unknown[][] = [];
      for await (const page of qapi.searchAll("persons", { lastName: "Smith" }, 2)) {
        allPages.push(page);
      }

      expect(allPages).toHaveLength(2);
      expect(allPages[0]).toHaveLength(2);
      expect(allPages[1]).toHaveLength(1);
    });

    it("should pass version to each page request", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([{ id: "1" }], 200, { "x-total-count": "1" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      const pages: unknown[][] = [];
      for await (const page of qapi.searchAll("persons", {}, 25, 12)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
      const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v12+json");
    });

    it("should handle empty results", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        mockResponse([], 200, { "x-total-count": "0" }),
      );

      const http = createHttpClient();
      const qapi = new EthosQapi(http);
      const pages: unknown[][] = [];
      for await (const page of qapi.searchAll("persons", {})) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
      expect(pages[0]).toEqual([]);
    });
  });
});
