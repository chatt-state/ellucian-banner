import { describe, it, expect } from "vitest";
import { assertSafeSegment, collectionPath, itemPath, resourceName } from "../../src/ethos/path.js";

describe("Ethos path builders reject dot-segment traversal (SEC-2)", () => {
  // encodeURIComponent does NOT neutralize "." / ".." — these must throw before
  // a request path is built, or itemPath("..", "consume") would reach /consume.
  it.each([["."], [".."], ["..."], ["a/b"], ["a\\b"], [" .. "], ["%2e%2e"], [""]])(
    "itemPath throws for id %j",
    (id) => {
      expect(() => itemPath("persons", id)).toThrow(TypeError);
    },
  );

  it.each([["."], [".."], ["..."], ["a/b"], [""]])(
    "collectionPath / resourceName throw for resource %j",
    (resource) => {
      expect(() => collectionPath(resource)).toThrow(TypeError);
      expect(() => resourceName(resource)).toThrow(TypeError);
    },
  );

  it("assertSafeSegment returns the trimmed value for a safe segment", () => {
    expect(assertSafeSegment("  abc-123  ", "resource id")).toBe("abc-123");
  });

  it("still builds ordinary paths unchanged", () => {
    expect(collectionPath("section-registrations")).toBe("/api/section-registrations");
    expect(itemPath("persons", "abc-123")).toBe("/api/persons/abc-123");
  });
});
