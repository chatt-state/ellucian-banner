import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BannerAuth } from "../../src/auth/banner-auth.js";

describe("BannerAuth", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.BANNER_BASE_URL;
    delete process.env.BANNER_USERNAME;
    delete process.env.BANNER_PASSWORD;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...savedEnv };
  });

  // --- Basic auth header format ---

  it("should produce a correct base64-encoded Basic auth header", () => {
    const auth = new BannerAuth({
      baseUrl: "https://banner.example.edu",
      username: "admin",
      password: "secret",
    });

    const expected = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
    expect(auth.getAuthHeader()).toBe(expected);
  });

  it("should handle special characters in credentials", () => {
    const auth = new BannerAuth({
      baseUrl: "https://banner.example.edu",
      username: "user@domain",
      password: "p@ss:w0rd!",
    });

    const expected = `Basic ${Buffer.from("user@domain:p@ss:w0rd!").toString("base64")}`;
    expect(auth.getAuthHeader()).toBe(expected);
  });

  // --- Trailing slash removal ---

  it("should remove a single trailing slash from baseUrl", () => {
    const auth = new BannerAuth({
      baseUrl: "https://banner.example.edu/",
      username: "u",
      password: "p",
    });
    expect(auth.baseUrl).toBe("https://banner.example.edu");
  });

  it("should remove multiple trailing slashes from baseUrl", () => {
    const auth = new BannerAuth({
      baseUrl: "https://banner.example.edu///",
      username: "u",
      password: "p",
    });
    expect(auth.baseUrl).toBe("https://banner.example.edu");
  });

  it("should leave baseUrl unchanged when there is no trailing slash", () => {
    const auth = new BannerAuth({
      baseUrl: "https://banner.example.edu",
      username: "u",
      password: "p",
    });
    expect(auth.baseUrl).toBe("https://banner.example.edu");
  });

  // --- Environment variable fallback ---

  it("should fall back to env vars when constructor params are omitted", () => {
    process.env.BANNER_BASE_URL = "https://env-banner.example.edu";
    process.env.BANNER_USERNAME = "env-user";
    process.env.BANNER_PASSWORD = "env-pass";

    const auth = new BannerAuth();

    expect(auth.baseUrl).toBe("https://env-banner.example.edu");
    const expected = `Basic ${Buffer.from("env-user:env-pass").toString("base64")}`;
    expect(auth.getAuthHeader()).toBe(expected);
  });

  it("should fall back to env vars when config is an empty object", () => {
    process.env.BANNER_BASE_URL = "https://env-banner.example.edu";
    process.env.BANNER_USERNAME = "env-user";
    process.env.BANNER_PASSWORD = "env-pass";

    const auth = new BannerAuth({});

    expect(auth.baseUrl).toBe("https://env-banner.example.edu");
  });

  // --- Constructor params override env vars ---

  it("should prefer constructor params over env vars", () => {
    process.env.BANNER_BASE_URL = "https://env-url.example.edu";
    process.env.BANNER_USERNAME = "env-user";
    process.env.BANNER_PASSWORD = "env-pass";

    const auth = new BannerAuth({
      baseUrl: "https://override.example.edu",
      username: "override-user",
      password: "override-pass",
    });

    expect(auth.baseUrl).toBe("https://override.example.edu");
    const expected = `Basic ${Buffer.from("override-user:override-pass").toString("base64")}`;
    expect(auth.getAuthHeader()).toBe(expected);
  });

  it("should allow partial override — mix of constructor and env vars", () => {
    process.env.BANNER_BASE_URL = "https://env-banner.example.edu";
    process.env.BANNER_USERNAME = "env-user";
    process.env.BANNER_PASSWORD = "env-pass";

    const auth = new BannerAuth({ baseUrl: "https://custom.example.edu" });

    expect(auth.baseUrl).toBe("https://custom.example.edu");
    const expected = `Basic ${Buffer.from("env-user:env-pass").toString("base64")}`;
    expect(auth.getAuthHeader()).toBe(expected);
  });

  // --- Validation errors ---

  it("should throw when all credentials are missing", () => {
    expect(() => new BannerAuth()).toThrow(
      "BannerAuth: missing required configuration: baseUrl (or BANNER_BASE_URL), username (or BANNER_USERNAME), password (or BANNER_PASSWORD)",
    );
  });

  it("should throw when only baseUrl is missing", () => {
    expect(() => new BannerAuth({ username: "u", password: "p" })).toThrow(
      "baseUrl (or BANNER_BASE_URL)",
    );
  });

  it("should throw when only username is missing", () => {
    expect(() => new BannerAuth({ baseUrl: "https://b.example.edu", password: "p" })).toThrow(
      "username (or BANNER_USERNAME)",
    );
  });

  it("should throw when only password is missing", () => {
    expect(() => new BannerAuth({ baseUrl: "https://b.example.edu", username: "u" })).toThrow(
      "password (or BANNER_PASSWORD)",
    );
  });

  it("should list all missing fields in the error message", () => {
    process.env.BANNER_BASE_URL = "https://env.example.edu";

    expect(() => new BannerAuth()).toThrow(
      "BannerAuth: missing required configuration: username (or BANNER_USERNAME), password (or BANNER_PASSWORD)",
    );
  });
});
