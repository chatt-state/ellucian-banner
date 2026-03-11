import { describe, it, expect } from "vitest";
import {
  BannerError,
  AuthError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ServerError,
  fromResponse,
} from "../../src/common/errors.js";

describe("Error hierarchy", () => {
  it("BannerError has name, statusCode, and responseBody", () => {
    const err = new BannerError("test", 500, '{"error":"internal"}');
    expect(err.name).toBe("BannerError");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("test");
    expect(err.responseBody).toBe('{"error":"internal"}');
    expect(err).toBeInstanceOf(Error);
  });

  it("BannerError works without optional fields", () => {
    const err = new BannerError("basic");
    expect(err.statusCode).toBeUndefined();
    expect(err.responseBody).toBeUndefined();
  });

  it("AuthError extends BannerError", () => {
    const err = new AuthError("unauthorized", 401, "body");
    expect(err.name).toBe("AuthError");
    expect(err.statusCode).toBe(401);
    expect(err.responseBody).toBe("body");
    expect(err).toBeInstanceOf(BannerError);
    expect(err).toBeInstanceOf(Error);
  });

  it("NotFoundError is always 404", () => {
    const err = new NotFoundError("missing", "not found body");
    expect(err.statusCode).toBe(404);
    expect(err.responseBody).toBe("not found body");
    expect(err).toBeInstanceOf(BannerError);
  });

  it("RateLimitError includes retryAfter", () => {
    const err = new RateLimitError("slow down", 60, "rate body");
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(60);
    expect(err.responseBody).toBe("rate body");
  });

  it("RateLimitError works without retryAfter", () => {
    const err = new RateLimitError("slow down");
    expect(err.retryAfter).toBeUndefined();
  });

  it("ValidationError is always 400", () => {
    const err = new ValidationError("bad input", '{"errors":["field required"]}');
    expect(err.name).toBe("ValidationError");
    expect(err.statusCode).toBe(400);
    expect(err.responseBody).toBe('{"errors":["field required"]}');
    expect(err).toBeInstanceOf(BannerError);
  });

  it("ServerError captures 5xx status", () => {
    const err = new ServerError("gateway timeout", 504, "timeout body");
    expect(err.name).toBe("ServerError");
    expect(err.statusCode).toBe(504);
    expect(err.responseBody).toBe("timeout body");
    expect(err).toBeInstanceOf(BannerError);
  });
});

describe("fromResponse", () => {
  function mockResponse(status: number, body: string, headers?: Record<string, string>): Response {
    return new Response(body, {
      status,
      statusText: statusForText(status),
      headers,
    });
  }

  function statusForText(status: number): string {
    const map: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      429: "Too Many Requests",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
    };
    return map[status] ?? "Unknown";
  }

  it("returns ValidationError for 400", async () => {
    const err = await fromResponse(mockResponse(400, "invalid field"));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
    expect(err.responseBody).toBe("invalid field");
    expect(err.message).toContain("invalid field");
  });

  it("returns AuthError for 401", async () => {
    const err = await fromResponse(mockResponse(401, "bad token"));
    expect(err).toBeInstanceOf(AuthError);
    expect(err.statusCode).toBe(401);
  });

  it("returns AuthError for 403", async () => {
    const err = await fromResponse(mockResponse(403, "forbidden"));
    expect(err).toBeInstanceOf(AuthError);
    expect(err.statusCode).toBe(403);
  });

  it("returns NotFoundError for 404", async () => {
    const err = await fromResponse(mockResponse(404, "resource not found"));
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.statusCode).toBe(404);
  });

  it("returns RateLimitError for 429 with Retry-After", async () => {
    const err = await fromResponse(mockResponse(429, "throttled", { "retry-after": "30" }));
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(30);
  });

  it("returns RateLimitError for 429 without Retry-After", async () => {
    const err = await fromResponse(mockResponse(429, "throttled"));
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBeUndefined();
  });

  it("returns ServerError for 500", async () => {
    const err = await fromResponse(mockResponse(500, "server error"));
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(500);
  });

  it("returns ServerError for 502", async () => {
    const err = await fromResponse(mockResponse(502, "bad gateway"));
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(502);
  });

  it("returns generic BannerError for unrecognized status codes", async () => {
    const err = await fromResponse(mockResponse(418, "I'm a teapot"));
    expect(err).toBeInstanceOf(BannerError);
    expect(err).not.toBeInstanceOf(AuthError);
    expect(err).not.toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(418);
  });

  it("truncates long response bodies in message", async () => {
    const longBody = "x".repeat(500);
    const err = await fromResponse(mockResponse(500, longBody));
    expect(err.message.length).toBeLessThan(300);
    expect(err.message).toContain("...");
    // Full body is preserved in responseBody
    expect(err.responseBody).toBe(longBody);
  });
});
