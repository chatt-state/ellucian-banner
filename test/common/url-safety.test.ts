import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpClient } from "../../src/common/http-client.js";
import { checkBaseUrl, checkRequestPath, isUnsafePathSegment } from "../../src/common/url.js";
import { BannerAuth } from "../../src/auth/banner-auth.js";
import { EthosAuth } from "../../src/auth/ethos-auth.js";
import { AuthError } from "../../src/common/errors.js";
import { BannerClient } from "../../src/banner/client.js";
import { EthosClient } from "../../src/ethos/client.js";

const ok = () => new Response("{}", { status: 200 });

describe("HttpClient refuses paths that leave the base URL", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const client = () =>
    new HttpClient({ baseUrl: "https://banner.example.edu", authProvider: () => "Basic x" });

  it.each([
    [".evil.example/x"],
    ["@evil.example/x"],
    ["//evil.example/x"],
    ["evil"],
    ["/../BannerAdminBPAPI/api/x"],
    ["/StudentApi/api/../../x"],
    ["/%2e%2e/x"],
    ["/%2E./x"],
    ["/./x"],
    ["/a\\..\\b"],
  ])("rejects %s without sending a request", async (path) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    await expect(client().get(path)).rejects.toBeInstanceOf(TypeError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows dots inside a segment and in the query string", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    await client().get("/a/v1.2/file.json?x=../y");
    expect(fetchSpy.mock.calls[0]![0]).toBe("https://banner.example.edu/a/v1.2/file.json?x=../y");
  });

  it("keeps requests under a base URL that has a path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    const c = new HttpClient({ baseUrl: "https://h.example/tenant", authProvider: () => "x" });
    await c.get("/api/persons");
    expect(fetchSpy.mock.calls[0]![0]).toBe("https://h.example/tenant/api/persons");
  });

  it("never sends Basic credentials to another host via BannerApiClient", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok());
    const banner = new BannerClient({
      baseUrl: "https://banner.example.edu",
      username: "u",
      password: "p",
    });
    const root = banner.api("");
    for (const path of [".evil.example/x", "@evil.example/x", "//evil.example/x"]) {
      await expect(root.get(path)).rejects.toBeInstanceOf(TypeError);
    }
    await expect(
      banner.studentApi.get("/../../BannerAdminBPAPI/api/secret"),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchSpy).not.toHaveBeenCalled();

    await root.get("/StudentApi/api/terms");
    expect(fetchSpy.mock.calls[0]![0]).toBe("https://banner.example.edu/StudentApi/api/terms");
  });
});

describe("checkRequestPath / isUnsafePathSegment", () => {
  it("accepts ordinary paths", () => {
    expect(checkRequestPath("/api/persons?criteria=%7B%7D")).toBeUndefined();
  });

  it.each([["."], [".."], ["%2e%2e"], ["%2E"], ["a/../b"], ["a\\b"], [" .. "]])(
    "flags %s as unsafe",
    (value) => {
      expect(isUnsafePathSegment(value)).toBe(true);
    },
  );

  it.each([["c2f2ba8a-0000-0000-0000-000000000001"], ["a.b"], ["...x"], ["%zz"]])(
    "accepts %s",
    (value) => {
      expect(isUnsafePathSegment(value)).toBe(false);
    },
  );
});

describe("base URL validation (TLS required)", () => {
  it.each([
    ["http://banner-int:8080", /https/],
    ["ftp://banner.example.edu", /https/],
    ["https://user:pw@banner.example.edu", /credentials/],
    ["https://banner.example.edu?x=1", /query/],
    ["https://banner.example.edu#frag", /fragment/],
    ["not a url", /valid/],
  ])("rejects %s", (url, problem) => {
    expect(checkBaseUrl(url)).toMatch(problem);
  });

  it("accepts https and, with the explicit opt-in, http", () => {
    expect(checkBaseUrl("https://banner.example.edu/")).toBeUndefined();
    expect(checkBaseUrl("http://127.0.0.1:8080", { allowInsecureHttp: true })).toBeUndefined();
  });

  it("does not echo the URL (which may contain a password) in the error", () => {
    expect(checkBaseUrl("https://user:hunter2@banner.example.edu")).not.toContain("hunter2");
  });

  it("BannerAuth rejects http:// unless allowInsecureHttp is set", () => {
    const creds = { username: "u", password: "p" };
    expect(() => new BannerAuth({ ...creds, baseUrl: "http://banner-int:8080" })).toThrow(/https/);
    expect(
      new BannerAuth({ ...creds, baseUrl: "http://127.0.0.1:8080", allowInsecureHttp: true })
        .baseUrl,
    ).toBe("http://127.0.0.1:8080");
  });

  it("BannerAuth also validates BANNER_BASE_URL from the environment", () => {
    vi.stubEnv("BANNER_BASE_URL", "http://banner-int:8080");
    expect(() => new BannerAuth({ username: "u", password: "p" })).toThrow(/https/);
    vi.unstubAllEnvs();
  });

  it("EthosAuth and EthosClient reject http:// and userinfo", () => {
    expect(() => new EthosAuth({ apiKey: "k", baseUrl: "http://ethos.example" })).toThrow(
      AuthError,
    );
    expect(() => new EthosClient({ apiKey: "k", baseUrl: "https://a:b@ethos.example" })).toThrow(
      AuthError,
    );
    expect(
      () =>
        new EthosClient({ apiKey: "k", baseUrl: "http://127.0.0.1:9", allowInsecureHttp: true }),
    ).not.toThrow();
  });
});
