import { describe, it, expect } from "vitest";
import { BannerError, AuthError, NotFoundError, RateLimitError } from "../../src/common/errors.js";

describe("Error hierarchy", () => {
  it("BannerError has name and statusCode", () => {
    const err = new BannerError("test", 500);
    expect(err.name).toBe("BannerError");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("AuthError extends BannerError", () => {
    const err = new AuthError("unauthorized", 401);
    expect(err.name).toBe("AuthError");
    expect(err).toBeInstanceOf(BannerError);
  });

  it("NotFoundError is always 404", () => {
    const err = new NotFoundError("missing");
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(BannerError);
  });

  it("RateLimitError includes retryAfter", () => {
    const err = new RateLimitError("slow down", 60);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(60);
  });
});
