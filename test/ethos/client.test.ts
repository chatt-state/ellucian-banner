import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosClient } from "../../src/ethos/client.js";

/**
 * EthosClient tests.
 *
 * These mock the /auth endpoint (for EthosAuth) and resource endpoints.
 * Every test needs at least 2 fetch mocks: one for token exchange, one for the API call.
 */

function mockAuth() {
  return new Response("mock-jwt-token", { status: 200 });
}

function mockJson(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers });
}

describe("EthosClient", () => {
  const config = { apiKey: "test-key" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("CRUD operations", () => {
    it("should GET a single resource by ID", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "abc-123", name: "Test" }));

      const client = new EthosClient(config);
      const result = await client.get("persons", "abc-123");

      expect(result).toEqual({ id: "abc-123", name: "Test" });
      const calls = vi.mocked(fetch).mock.calls;
      expect(calls[1]![0]).toContain("/api/persons/abc-123");
    });

    it("should POST (create) a resource", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "new-id" }, 201));

      const client = new EthosClient(config);
      const result = await client.create("persons", { name: "New Person" });

      expect(result).toEqual({ id: "new-id" });
      const [, createCall] = vi.mocked(fetch).mock.calls;
      expect(createCall![1]).toMatchObject({ method: "POST" });
    });

    it("should PUT (update) a resource by ID", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "abc-123", name: "Updated" }));

      const client = new EthosClient(config);
      const result = await client.update("persons", "abc-123", { name: "Updated" });

      expect(result).toEqual({ id: "abc-123", name: "Updated" });
      const [, updateCall] = vi.mocked(fetch).mock.calls;
      expect(updateCall![1]).toMatchObject({ method: "PUT" });
    });

    it("should DELETE a resource by ID", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const client = new EthosClient(config);
      await client.delete("persons", "abc-123");

      const [, deleteCall] = vi.mocked(fetch).mock.calls;
      expect(deleteCall![1]).toMatchObject({ method: "DELETE" });
    });
  });

  describe("EEDM versioned headers", () => {
    it("should send versioned Accept header on GET", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "1" }));

      const client = new EthosClient(config);
      await client.get("persons", "1", 12);

      const [, getCall] = vi.mocked(fetch).mock.calls;
      const headers = getCall![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v12+json");
    });

    it("should send versioned Content-Type on POST", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "1" }, 201));

      const client = new EthosClient(config);
      await client.create("persons", { name: "Test" }, 12);

      const [, postCall] = vi.mocked(fetch).mock.calls;
      const headers = postCall![1]!.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/vnd.hedtech.integration.v12+json");
      expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v12+json");
    });

    it("should use application/json when no version specified", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "1" }));

      const client = new EthosClient(config);
      await client.get("persons", "1");

      const [, getCall] = vi.mocked(fetch).mock.calls;
      const headers = getCall![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/json");
    });
  });

  describe("pagination", () => {
    it("should getPage with offset and limit", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(
          mockJson([{ id: "1" }, { id: "2" }], 200, { "x-total-count": "10" }),
        );

      const client = new EthosClient(config);
      const page = await client.getPage("persons", 0, 2);

      expect(page.data).toHaveLength(2);
      expect(page.totalCount).toBe(10);
      expect(page.hasMore).toBe(true);
    });

    it("should getAll yielding all pages", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson([{ id: "1" }, { id: "2" }], 200, { "x-total-count": "3" }))
        .mockResolvedValueOnce(mockJson([{ id: "3" }], 200, { "x-total-count": "3" }));

      const client = new EthosClient(config);
      const allPages: unknown[][] = [];
      for await (const page of client.getAll("persons", 2)) {
        allPages.push(page);
      }

      expect(allPages).toHaveLength(2);
      expect(allPages[0]).toHaveLength(2);
      expect(allPages[1]).toHaveLength(1);
    });
  });

  describe("resource accessors", () => {
    it("should provide typed persons accessor", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "abc-123" }));

      const client = new EthosClient(config);
      const person = await client.persons.get("abc-123");

      expect(person).toEqual({ id: "abc-123" });
      const [, getCall] = vi.mocked(fetch).mock.calls;
      expect(getCall![0]).toContain("/api/persons/abc-123");
      const headers = getCall![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v12+json");
    });

    it("should provide typed students accessor", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "stu-1" }));

      const client = new EthosClient(config);
      const student = await client.students.get("stu-1");

      expect(student).toEqual({ id: "stu-1" });
    });

    it("should support custom resource accessor", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "1" }));

      const client = new EthosClient(config);
      const buildings = client.resource("buildings", 6);
      const result = await buildings.get("1");

      expect(result).toEqual({ id: "1" });
      const [, getCall] = vi.mocked(fetch).mock.calls;
      expect(getCall![0]).toContain("/api/buildings/1");
      const headers = getCall![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.hedtech.integration.v6+json");
    });

    it("should support CRUD via resource accessor", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(mockJson({ id: "new" }, 201));

      const client = new EthosClient(config);
      const result = await client.persons.create({ name: "Test" });

      expect(result).toEqual({ id: "new" });
    });

    it("should support delete via resource accessor", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockAuth())
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      const client = new EthosClient(config);
      await client.persons.delete("abc-123");

      const [, deleteCall] = vi.mocked(fetch).mock.calls;
      expect(deleteCall![0]).toContain("/api/persons/abc-123");
    });
  });
});
