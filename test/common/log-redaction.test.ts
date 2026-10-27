import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpClient, redactUrlForLog } from "../../src/common/http-client.js";

describe("redactUrlForLog", () => {
  it.each([
    [
      "https://integrate.elluciancloud.com/api/persons/c2f2ba8a-1111-2222-3333-444455556666",
      "https://integrate.elluciancloud.com/api/persons/[id]",
    ],
    [
      "https://integrate.elluciancloud.com/api/persons/jsmith",
      "https://integrate.elluciancloud.com/api/persons/[id]",
    ],
    [
      "https://integrate.elluciancloud.com/api/persons?criteria=%7B%22names%22%7D&offset=0",
      "https://integrate.elluciancloud.com/api/persons?[redacted]",
    ],
    [
      "https://banner.example.edu/StudentApi/api/students/A00123456/holds",
      "https://banner.example.edu/StudentApi/api/students/[id]/holds",
    ],
    [
      "https://banner.example.edu/StudentApi/api/v1/students/12345",
      "https://banner.example.edu/StudentApi/api/v1/students/[id]",
    ],
    ["https://banner.example.edu/x/jdoe%40example.edu", "https://banner.example.edu/x/[id]"],
    ["https://banner.example.edu/x/jane.doe", "https://banner.example.edu/x/[id]"],
  ])("%s -> %s", (input, expected) => {
    expect(redactUrlForLog(input)).toBe(expected);
  });
});

describe("HttpClient debug log never contains identifiers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("masks a Banner ID embedded in the path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new HttpClient({
      baseUrl: "https://banner.example.edu",
      authProvider: () => "Basic x",
      debug: true,
    });
    await client.get("/StudentApi/api/students/A00123456?term=202680");
    const logged = stderr.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain(
      "[banner-sdk] GET https://banner.example.edu/StudentApi/api/students/[id]",
    );
    expect(logged).not.toContain("A00123456");
    expect(logged).not.toContain("202680");
  });
});
