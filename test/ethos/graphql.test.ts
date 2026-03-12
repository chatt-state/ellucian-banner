import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosClient } from "../../src/ethos/client.js";

function mockAuth() {
  return new Response("mock-jwt-token", { status: 200 });
}

function mockJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

describe("EthosGraphQL", () => {
  const config = { apiKey: "test-key" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should execute a GraphQL query and return data", async () => {
    const graphqlResponse = {
      data: { persons: { edges: [{ node: { id: "1", names: [{ firstName: "John" }] } }] } },
    };

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson(graphqlResponse));

    const client = new EthosClient(config);
    const result = await client.graphql.query({
      query: "{ persons { edges { node { id names { firstName } } } } }",
    });

    expect(result.data).toEqual(graphqlResponse.data);
    expect(result.errors).toBeUndefined();

    const [, gqlCall] = vi.mocked(fetch).mock.calls;
    expect(gqlCall![0]).toContain("/graphql");
    expect(gqlCall![1]).toMatchObject({ method: "POST" });
    const body = JSON.parse(gqlCall![1]!.body as string);
    expect(body.query).toContain("persons");
  });

  it("should send variables and operationName", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson({ data: { person: { id: "1" } } }));

    const client = new EthosClient(config);
    await client.graphql.query({
      query: "query GetPerson($id: ID!) { person(id: $id) { id } }",
      variables: { id: "1" },
      operationName: "GetPerson",
    });

    const [, gqlCall] = vi.mocked(fetch).mock.calls;
    const body = JSON.parse(gqlCall![1]!.body as string);
    expect(body.variables).toEqual({ id: "1" });
    expect(body.operationName).toBe("GetPerson");
  });

  it("should return errors from the GraphQL response", async () => {
    const graphqlResponse = {
      errors: [
        {
          message: "Field 'unknown' not found",
          locations: [{ line: 1, column: 3 }],
          path: ["persons"],
        },
      ],
    };

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson(graphqlResponse));

    const client = new EthosClient(config);
    const result = await client.graphql.query({ query: "{ unknown }" });

    expect(result.data).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]!.message).toBe("Field 'unknown' not found");
    expect(result.errors![0]!.locations).toEqual([{ line: 1, column: 3 }]);
  });

  it("should send correct Content-Type and Accept headers", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockAuth())
      .mockResolvedValueOnce(mockJson({ data: null }));

    const client = new EthosClient(config);
    await client.graphql.query({ query: "{ __typename }" });

    const [, gqlCall] = vi.mocked(fetch).mock.calls;
    const headers = gqlCall![1]!.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Accept"]).toBe("application/json");
  });
});
