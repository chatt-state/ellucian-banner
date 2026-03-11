import { describe, it, expect, vi } from "vitest";
import { EthosResource } from "../../src/ethos/resource.js";
import type { EthosResourceClient } from "../../src/ethos/resource.js";
import type { PaginatedResponse } from "../../src/common/types.js";

/** Create a mock client with vi.fn() stubs for all methods. */
function createMockClient(): EthosResourceClient {
  return {
    get: vi.fn(),
    getPage: vi.fn(),
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("EthosResource", () => {
  describe("get", () => {
    it("should delegate to client.get with resource name and version", async () => {
      const client = createMockClient();
      vi.mocked(client.get).mockResolvedValue({ id: "1", name: "Test" });

      const resource = new EthosResource(client, "persons", 12);
      const result = await resource.get("1");

      expect(result).toEqual({ id: "1", name: "Test" });
      expect(client.get).toHaveBeenCalledWith("persons", "1", 12, undefined);
    });

    it("should forward RequestOptions to client.get", async () => {
      const client = createMockClient();
      vi.mocked(client.get).mockResolvedValue({ id: "1" });

      const resource = new EthosResource(client, "persons", 12);
      const options = { headers: { "X-Custom": "val" } };
      await resource.get("1", options);

      expect(client.get).toHaveBeenCalledWith("persons", "1", 12, options);
    });

    it("should work without a version", async () => {
      const client = createMockClient();
      vi.mocked(client.get).mockResolvedValue({ id: "1" });

      const resource = new EthosResource(client, "buildings");
      await resource.get("1");

      expect(client.get).toHaveBeenCalledWith("buildings", "1", undefined, undefined);
    });
  });

  describe("getPage", () => {
    it("should delegate to client.getPage with offset and limit", async () => {
      const page: PaginatedResponse<unknown> = {
        data: [{ id: "1" }],
        totalCount: 5,
        offset: 0,
        hasMore: true,
      };
      const client = createMockClient();
      vi.mocked(client.getPage).mockResolvedValue(page);

      const resource = new EthosResource(client, "persons", 12);
      const result = await resource.getPage(0, 10);

      expect(result).toEqual(page);
      expect(client.getPage).toHaveBeenCalledWith("persons", 0, 10, 12, undefined);
    });

    it("should pass undefined offset and limit when omitted", async () => {
      const page: PaginatedResponse<unknown> = {
        data: [],
        totalCount: 0,
        offset: 0,
        hasMore: false,
      };
      const client = createMockClient();
      vi.mocked(client.getPage).mockResolvedValue(page);

      const resource = new EthosResource(client, "persons", 12);
      await resource.getPage();

      expect(client.getPage).toHaveBeenCalledWith("persons", undefined, undefined, 12, undefined);
    });
  });

  describe("getAll", () => {
    it("should yield pages from the client async generator", async () => {
      const client = createMockClient();
      async function* mockGetAll() {
        yield [{ id: "1" }, { id: "2" }];
        yield [{ id: "3" }];
      }
      vi.mocked(client.getAll).mockReturnValue(mockGetAll());

      const resource = new EthosResource(client, "persons", 12);
      const pages: unknown[][] = [];
      for await (const page of resource.getAll(10)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0]).toHaveLength(2);
      expect(pages[1]).toHaveLength(1);
      expect(client.getAll).toHaveBeenCalledWith("persons", 10, 12, undefined);
    });

    it("should forward options to client.getAll", async () => {
      const client = createMockClient();
      async function* mockGetAll() {
        yield [];
      }
      const options = { headers: { "X-Custom": "val" } };
      vi.mocked(client.getAll).mockReturnValue(mockGetAll());

      const resource = new EthosResource(client, "persons", 12);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _page of resource.getAll(25, options)) {
        // consume
      }

      expect(client.getAll).toHaveBeenCalledWith("persons", 25, 12, options);
    });
  });

  describe("create", () => {
    it("should delegate to client.create with body", async () => {
      const client = createMockClient();
      vi.mocked(client.create).mockResolvedValue({ id: "new" });

      const resource = new EthosResource(client, "persons", 12);
      const result = await resource.create({ name: "New" });

      expect(result).toEqual({ id: "new" });
      expect(client.create).toHaveBeenCalledWith("persons", { name: "New" }, 12, undefined);
    });
  });

  describe("update", () => {
    it("should delegate to client.update with id and body", async () => {
      const client = createMockClient();
      vi.mocked(client.update).mockResolvedValue({ id: "1", name: "Updated" });

      const resource = new EthosResource(client, "persons", 12);
      const result = await resource.update("1", { name: "Updated" });

      expect(result).toEqual({ id: "1", name: "Updated" });
      expect(client.update).toHaveBeenCalledWith(
        "persons",
        "1",
        { name: "Updated" },
        12,
        undefined,
      );
    });

    it("should forward options to client.update", async () => {
      const client = createMockClient();
      vi.mocked(client.update).mockResolvedValue({});
      const options = { headers: { "X-Custom": "val" } };

      const resource = new EthosResource(client, "persons", 12);
      await resource.update("1", { name: "Updated" }, options);

      expect(client.update).toHaveBeenCalledWith("persons", "1", { name: "Updated" }, 12, options);
    });
  });

  describe("delete", () => {
    it("should delegate to client.delete with id", async () => {
      const client = createMockClient();
      vi.mocked(client.delete).mockResolvedValue(undefined);

      const resource = new EthosResource(client, "persons", 12);
      await resource.delete("1");

      expect(client.delete).toHaveBeenCalledWith("persons", "1", 12, undefined);
    });
  });
});
