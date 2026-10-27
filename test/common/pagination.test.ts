import { describe, it, expect } from "vitest";
import {
  parsePaginatedResponse,
  paginateAll,
  DEFAULT_PAGE_SIZE,
} from "../../src/common/pagination.js";

describe("parsePaginatedResponse", () => {
  it("should parse data and x-total-count header", async () => {
    const response = new Response(JSON.stringify([{ id: "1" }, { id: "2" }]), {
      headers: { "x-total-count": "10" },
    });

    const result = await parsePaginatedResponse(response, 0);

    expect(result.data).toEqual([{ id: "1" }, { id: "2" }]);
    expect(result.totalCount).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.hasMore).toBe(true);
  });

  it("should detect last page (hasMore = false)", async () => {
    const response = new Response(JSON.stringify([{ id: "9" }, { id: "10" }]), {
      headers: { "x-total-count": "10" },
    });

    const result = await parsePaginatedResponse(response, 8);

    expect(result.hasMore).toBe(false);
  });

  it("should handle missing x-total-count header", async () => {
    const response = new Response(JSON.stringify([{ id: "1" }]));

    const result = await parsePaginatedResponse(response, 0);

    // Without a total or a requested limit there is no evidence of more rows.
    expect(result.totalCount).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("should infer hasMore from a full page when x-total-count is missing", async () => {
    const full = new Response(JSON.stringify([1, 2, 3]));
    expect((await parsePaginatedResponse(full, 0, 3)).hasMore).toBe(true);

    const partial = new Response(JSON.stringify([1, 2]));
    expect((await parsePaginatedResponse(partial, 3, 3)).hasMore).toBe(false);
  });

  it("should treat x-max-page-size as the page cap when inferring hasMore", async () => {
    // Asked for 500 but the server caps pages at 2 and sent no total.
    const response = new Response(JSON.stringify([1, 2]), {
      headers: { "x-max-page-size": "2" },
    });
    const result = await parsePaginatedResponse(response, 0, 500);
    expect(result.hasMore).toBe(true);
    expect(result.maxPageSize).toBe(2);
  });

  it("should expose x-max-page-size", async () => {
    const response = new Response(JSON.stringify([1]), {
      headers: { "x-total-count": "1", "x-max-page-size": "500" },
    });
    expect((await parsePaginatedResponse(response, 0, 25)).maxPageSize).toBe(500);
  });

  it("should throw when the body is not a JSON array", async () => {
    const response = new Response(JSON.stringify({ errors: [] }));
    await expect(parsePaginatedResponse(response, 0)).rejects.toThrow("Expected a JSON array");
  });

  it("should handle empty response", async () => {
    const response = new Response(JSON.stringify([]), {
      headers: { "x-total-count": "0" },
    });

    const result = await parsePaginatedResponse(response, 0);

    expect(result.data).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("should preserve offset in result", async () => {
    const response = new Response(JSON.stringify([{ id: "3" }]), {
      headers: { "x-total-count": "5" },
    });

    const result = await parsePaginatedResponse(response, 2);

    expect(result.offset).toBe(2);
    expect(result.hasMore).toBe(true);
  });
});

describe("paginateAll", () => {
  it("should advance by rows returned when the server caps page size", async () => {
    const offsets: number[] = [];
    const rows = [1, 2, 3, 4, 5];
    const pages: number[][] = [];
    for await (const page of paginateAll<number>(async (offset, limit) => {
      offsets.push(offset);
      // server ignores limit=10 and returns at most 2 rows
      const data = rows.slice(offset, offset + Math.min(limit, 2));
      return { data, totalCount: 5, offset, hasMore: offset + data.length < 5 };
    }, 10)) {
      pages.push(page);
    }
    expect(offsets).toEqual([0, 2, 4]);
    expect(pages.flat()).toEqual(rows);
  });

  it("should stop on an empty page even if the server claims more rows", async () => {
    let calls = 0;
    const pages: number[][] = [];
    for await (const page of paginateAll<number>(async (offset) => {
      calls++;
      if (calls > 5) throw new Error("infinite loop");
      return offset === 0
        ? { data: [1], totalCount: 100, offset, hasMore: true }
        : { data: [], totalCount: 100, offset, hasMore: true };
    }, 1)) {
      pages.push(page);
    }
    expect(calls).toBe(2);
    expect(pages.flat()).toEqual([1]);
  });

  it("should yield all pages until exhausted", async () => {
    const pages = [
      { data: [{ id: "1" }, { id: "2" }], totalCount: 5, offset: 0, hasMore: true },
      { data: [{ id: "3" }, { id: "4" }], totalCount: 5, offset: 2, hasMore: true },
      { data: [{ id: "5" }], totalCount: 5, offset: 4, hasMore: false },
    ];
    let callIndex = 0;

    const allPages: unknown[][] = [];
    for await (const page of paginateAll(async () => pages[callIndex++]!, 2)) {
      allPages.push(page);
    }

    expect(allPages).toHaveLength(3);
    expect(allPages[0]).toEqual([{ id: "1" }, { id: "2" }]);
    expect(allPages[2]).toEqual([{ id: "5" }]);
  });

  it("should handle single page result", async () => {
    const allPages: unknown[][] = [];
    for await (const page of paginateAll(
      async () => ({ data: [{ id: "1" }], totalCount: 1, offset: 0, hasMore: false }),
      25,
    )) {
      allPages.push(page);
    }

    expect(allPages).toHaveLength(1);
  });

  it("should handle empty first page", async () => {
    const allPages: unknown[][] = [];
    for await (const page of paginateAll(async () => ({
      data: [],
      totalCount: 0,
      offset: 0,
      hasMore: false,
    }))) {
      allPages.push(page);
    }

    expect(allPages).toHaveLength(1);
    expect(allPages[0]).toEqual([]);
  });

  it("should pass correct offset and limit to fetchPage", async () => {
    const calls: Array<{ offset: number; limit: number }> = [];
    const pages = [
      { data: [1, 2, 3], totalCount: 5, offset: 0, hasMore: true },
      { data: [4, 5], totalCount: 5, offset: 3, hasMore: false },
    ];
    let callIndex = 0;

    for await (const _ of paginateAll(async (offset, limit) => {
      calls.push({ offset, limit });
      return pages[callIndex++]!;
    }, 3)) {
      // consume
    }

    expect(calls).toEqual([
      { offset: 0, limit: 3 },
      { offset: 3, limit: 3 },
    ]);
  });

  it("should use DEFAULT_PAGE_SIZE when no pageSize given", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
  });
});
