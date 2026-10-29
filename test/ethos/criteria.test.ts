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
  // Ethos named queries use the query name as the parameter name:
  //   ?keywordSearch={"keywordSearch":"math"}
  it("should use the query name as the parameter name", () => {
    const result = buildNamedQueryParam("personsByName", { lastName: "Smith" });
    expect(result).toBe(
      `personsByName=${encodeURIComponent('{"personsByName":{"lastName":"Smith"}}')}`,
    );
    expect(result).not.toContain("namedQuery=");
  });

  it("should wrap scalar values (keywordSearch)", () => {
    expect(buildNamedQueryParam("keywordSearch", "math")).toBe(
      `keywordSearch=${encodeURIComponent('{"keywordSearch":"math"}')}`,
    );
  });

  it("should not double-wrap params already keyed by the query name", () => {
    const result = buildNamedQueryParam("personFilter", { personFilter: { id: "abc" } });
    expect(result).toBe(`personFilter=${encodeURIComponent('{"personFilter":{"id":"abc"}}')}`);
  });

  it("should send params verbatim when wrap is false", () => {
    const result = buildNamedQueryParam(
      "registrationStatusesByAcademicPeriod",
      { statuses: ["registered"], academicPeriod: { id: "p1" } },
      { wrap: false },
    );
    expect(result).toBe(
      `registrationStatusesByAcademicPeriod=${encodeURIComponent(
        '{"statuses":["registered"],"academicPeriod":{"id":"p1"}}',
      )}`,
    );
  });

  it("should always wrap when wrap is true", () => {
    const result = buildNamedQueryParam("q", { q: 1 }, { wrap: true });
    expect(result).toBe(`q=${encodeURIComponent('{"q":{"q":1}}')}`);
  });

  it("should URL-encode reserved characters in values", () => {
    const result = buildNamedQueryParam("keywordSearch", "a&b=c #d");
    const [name, value, ...rest] = result.split("=");
    expect(name).toBe("keywordSearch");
    expect(rest).toEqual([]);
    expect(value).not.toMatch(/[&= #]/);
    expect(JSON.parse(decodeURIComponent(value!))).toEqual({ keywordSearch: "a&b=c #d" });
  });

  it("should reject an empty query name", () => {
    expect(() => buildNamedQueryParam("", {})).toThrow(TypeError);
  });
});

describe("buildCriteriaParam encoding", () => {
  it("should produce a single criteria= parameter that round-trips", () => {
    const criteria = { names: [{ firstName: "Zoë", lastName: "O'Brien & Co" }] };
    const param = buildCriteriaParam(criteria);
    const parsed = new URLSearchParams(param);
    expect([...parsed.keys()]).toEqual(["criteria"]);
    expect(JSON.parse(parsed.get("criteria")!)).toEqual(criteria);
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
      .mockResolvedValueOnce(mockJson([{ id: "1" }], 200, { "x-total-count": "1" }));

    const client = new EthosClient(config);
    const result = await client.namedQuery("persons", "personsByName", { lastName: "Smith" });

    expect(result.data).toEqual([{ id: "1" }]);

    const [, queryCall] = vi.mocked(fetch).mock.calls;
    const url = queryCall![0] as string;
    expect(url).toContain("/api/persons?personsByName=");
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
