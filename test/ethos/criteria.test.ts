import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildCriteriaParam, buildNamedQueryParam } from "../../src/ethos/criteria.js";
import { EthosClient } from "../../src/ethos/client.js";

function mockAuth() {
  return new Response("mock-jwt-token", { status: 200 });
}

function mockJson(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}

describe("buildCriteriaParam", () => {
  it("should encode criteria as a query parameter", () => {
    const result = buildCriteriaParam({ lastName: "Smith" });
    expect(result).toBe(`criteria=${encodeURIComponent('{"lastName":"Smith"}')}`);
  });

  it("should handle nested criteria", () => {
    const result = buildCriteriaParam({ names: { lastName: "Smith" } });
    expect(result).toBe(`criteria=${encodeURIComponent('{"names":{"lastName":"Smith"}}')}`);
  });
});

describe("buildNamedQueryParam", () => {
  it("should encode a named query as a query parameter", () => {
    const result = buildNamedQueryParam("personsByName", { lastName: "Smith" });
    expect(result).toBe(
      `namedQuery=${encodeURIComponent('{"personsByName":{"lastName":"Smith"}}')}`,
    );
  });
});

describe("EthosClient.filter", () => {
  const config = { apiKey: "test-key" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should GET resources filtered by criteria", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(
        mockJson([{ id: "1", lastName: "Smith" }], 200, { "x-total-count": "1" }),
      );

    const client = new EthosClient(config);
    const result = await client.filter("persons", { lastName: "Smith" });

    expect(result.data).toEqual([{ id: "1", lastName: "Smith" }]);
    expect(result.totalCount).toBe(1);

    const [, filterCall] = vi.mocked(fetch).mock.calls;
    const url = filterCall![0] as string;
    expect(url).toContain("/api/persons?criteria=");
    expect(url).toContain(encodeURIComponent('{"lastName":"Smith"}'));
    expect(url).toContain("offset=0");
    expect(url).toContain("limit=25");
  });

  it("should pass offset and limit", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson([], 200, { "x-total-count": "0" }));

    const client = new EthosClient(config);
    await client.filter("persons", { lastName: "Smith" }, 10, 5);

    const [, filterCall] = vi.mocked(fetch).mock.calls;
    const url = filterCall![0] as string;
    expect(url).toContain("offset=10");
    expect(url).toContain("limit=5");
  });

  it("should send EEDM versioned headers when version is provided", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson([], 200, { "x-total-count": "0" }));

    const client = new EthosClient(config);
    await client.filter("persons", { lastName: "Smith" }, 0, 25, 12);

    const [, filterCall] = vi.mocked(fetch).mock.calls;
    const headers = filterCall![1]!.headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v12+json");
  });
});

describe("EthosClient.namedQuery", () => {
  const config = { apiKey: "test-key" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should GET resources using a named query", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(
        mockJson([{ id: "1" }], 200, { "x-total-count": "1" }),
      );

    const client = new EthosClient(config);
    const result = await client.namedQuery("persons", "personsByName", { lastName: "Smith" });

    expect(result.data).toEqual([{ id: "1" }]);

    const [, queryCall] = vi.mocked(fetch).mock.calls;
    const url = queryCall![0] as string;
    expect(url).toContain("/api/persons?namedQuery=");
    expect(url).toContain(encodeURIComponent('{"personsByName":{"lastName":"Smith"}}'));
    expect(url).toContain("offset=0");
    expect(url).toContain("limit=25");
  });

  it("should pass offset and limit to named query", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson([], 200, { "x-total-count": "0" }));

    const client = new EthosClient(config);
    await client.namedQuery("sections", "sectionsByTerm", { termId: "202410" }, 5, 10);

    const [, queryCall] = vi.mocked(fetch).mock.calls;
    const url = queryCall![0] as string;
    expect(url).toContain("offset=5");
    expect(url).toContain("limit=10");
  });
});
