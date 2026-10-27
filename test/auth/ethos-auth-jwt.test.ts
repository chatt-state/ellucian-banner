import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EthosAuth, decodeJwtTimeClaims } from "../../src/auth/ethos-auth.js";
import { AuthError } from "../../src/common/errors.js";

/** Build an unsigned JWT with the given payload (signature is irrelevant here). */
function jwt(payload: Record<string, unknown>): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.sig`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

describe("decodeJwtTimeClaims", () => {
  it("reads exp and iat", () => {
    expect(decodeJwtTimeClaims(jwt({ exp: 2000, iat: 1000 }))).toEqual({ exp: 2000, iat: 1000 });
  });

  it("returns exp without a bogus iat", () => {
    expect(decodeJwtTimeClaims(jwt({ exp: 2000, iat: 3000 }))).toEqual({ exp: 2000 });
    expect(decodeJwtTimeClaims(jwt({ exp: 2000, iat: "x" }))).toEqual({ exp: 2000 });
  });

  it.each([
    ["opaque token", "not-a-jwt"],
    ["two segments", "a.b"],
    ["bad base64 json", "a.!!!.c"],
    ["missing exp", jwt({ sub: "x" })],
    ["string exp", jwt({ exp: "soon" })],
    ["negative exp", jwt({ exp: -5 })],
    ["non-object payload", `a.${Buffer.from("42").toString("base64url")}.c`],
  ])("returns undefined for %s", (_label, token) => {
    expect(decodeJwtTimeClaims(token)).toBeUndefined();
  });
});

describe("EthosAuth token lifetime", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the JWT exp claim instead of a hardcoded 300s", async () => {
    // 60-minute token (as issued with ?expirationMinutes=60)
    const t1 = jwt({ iat: nowSec(), exp: nowSec() + 3600 });
    const t2 = jwt({ iat: nowSec() + 1, exp: nowSec() + 7200 });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(t1))
      .mockResolvedValueOnce(new Response(t2));

    const auth = new EthosAuth({ apiKey: "k" });
    expect(await auth.getToken()).toBe(t1);

    // Well past the old 270s refresh point: still cached.
    vi.setSystemTime(Date.now() + 1000_000);
    expect(await auth.getToken()).toBe(t1);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Inside the 30s buffer before the 3600s expiry: refreshed.
    vi.setSystemTime(new Date("2026-01-01T00:59:35Z"));
    expect(await auth.getToken()).toBe(t2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refreshes a short-lived JWT before it expires", async () => {
    const t1 = jwt({ iat: nowSec(), exp: nowSec() + 120 });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(t1))
      .mockResolvedValueOnce(new Response("next"));

    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    vi.setSystemTime(Date.now() + 91_000); // 120 - 30 buffer = 90
    expect(await auth.getToken()).toBe("next");
  });

  it("is immune to local clock skew when iat is present", async () => {
    // Server clock is 1 hour behind ours; a naive exp*1000 comparison
    // would consider this 5-minute token already expired.
    const serverNow = nowSec() - 3600;
    const t1 = jwt({ iat: serverNow, exp: serverNow + 300 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(t1));

    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    await auth.getToken();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.tokenExpiresAt).toBe(Date.now() + 300_000);
  });

  it("falls back to exp - now when iat is absent", async () => {
    const t1 = jwt({ exp: nowSec() + 600 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(t1));
    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    expect(auth.tokenExpiresAt).toBe(Date.now() + 600_000);
  });

  it("falls back to 300s for undecodable tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("opaque-token"));
    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    expect(auth.tokenExpiresAt).toBe(Date.now() + 300_000);
  });

  it("caps the refresh buffer at half the token lifetime", async () => {
    const t1 = jwt({ iat: nowSec(), exp: nowSec() + 40 });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(t1))
      .mockResolvedValueOnce(new Response("next"));
    const auth = new EthosAuth({ apiKey: "k" }); // 30s buffer > 40/2
    await auth.getToken();
    vi.setSystemTime(Date.now() + 15_000);
    expect(await auth.getToken()).toBe(t1);
    vi.setSystemTime(Date.now() + 6_000);
    expect(await auth.getToken()).toBe("next");
  });

  it("trims whitespace around the returned token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("  tok\n"));
    const auth = new EthosAuth({ apiKey: "k" });
    expect(await auth.getToken()).toBe("tok");
  });

  it("rejects an empty token body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(""));
    const auth = new EthosAuth({ apiKey: "k" });
    await expect(auth.getToken()).rejects.toThrow(AuthError);
  });

  it("requests a custom lifetime with expirationMinutes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("opaque"));
    const auth = new EthosAuth({ apiKey: "k", expirationMinutes: 60 });
    await auth.getToken();
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
      "https://integrate.elluciancloud.com/auth?expirationMinutes=60",
    );
    // Opaque token: fallback lifetime follows the requested minutes.
    expect(auth.tokenExpiresAt).toBe(Date.now() + 3600_000);
  });

  it("validates expirationMinutes and refreshBuffer", () => {
    expect(() => new EthosAuth({ apiKey: "k", expirationMinutes: 0 })).toThrow(AuthError);
    expect(() => new EthosAuth({ apiKey: "k", expirationMinutes: 121 })).toThrow(AuthError);
    expect(() => new EthosAuth({ apiKey: "k", expirationMinutes: 1.5 })).toThrow(AuthError);
    expect(() => new EthosAuth({ apiKey: "k", refreshBuffer: -1 })).toThrow(AuthError);
  });

  it("never puts the API key in error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad key secret-key-123", { status: 401, statusText: "Unauthorized" }),
    );
    const auth = new EthosAuth({ apiKey: "secret-key-123" });
    const err = (await auth.getToken().catch((e: unknown) => e)) as AuthError;
    expect(err).toBeInstanceOf(AuthError);
    expect(err.message).not.toContain("secret-key-123");
    expect(err.responseBody).toBeUndefined();
  });
});

describe("EthosAuth concurrency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shares one in-flight refresh across concurrent getToken() calls", async () => {
    let resolveFetch!: (r: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((r) => (resolveFetch = r)),
    );

    const auth = new EthosAuth({ apiKey: "k" });
    const calls = Array.from({ length: 25 }, () => auth.getToken());
    resolveFetch(new Response("shared-token"));

    const tokens = await Promise.all(calls);
    expect(new Set(tokens)).toEqual(new Set(["shared-token"]));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight refresh between refresh() and getToken()", async () => {
    let resolveFetch!: (r: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((r) => (resolveFetch = r)),
    );
    const auth = new EthosAuth({ apiKey: "k" });
    const a = auth.refresh();
    const b = auth.getToken();
    const c = auth.refresh();
    resolveFetch(new Response("t"));
    expect(await Promise.all([a, b, c])).toEqual(["t", "t", "t"]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("propagates a failed refresh to all waiters and allows a later retry", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("no", { status: 500, statusText: "Server Error" }))
      .mockResolvedValueOnce(new Response("recovered"));

    const auth = new EthosAuth({ apiKey: "k", retry: false });
    const results = await Promise.allSettled([auth.getToken(), auth.getToken()]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(fetch).toHaveBeenCalledTimes(1);

    expect(await auth.getToken()).toBe("recovered");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("propagates network errors without caching a broken in-flight promise", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok"));
    const auth = new EthosAuth({ apiKey: "k", retry: false });
    await expect(auth.getToken()).rejects.toThrow("fetch failed");
    expect(await auth.getToken()).toBe("ok");
  });
});

describe("EthosAuth.invalidate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("drops the cached token so the next getToken() refreshes", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t1"))
      .mockResolvedValueOnce(new Response("t2"));
    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    auth.invalidate("t1");
    expect(await auth.getToken()).toBe("t2");
  });

  it("ignores a stale rejected token when a newer one is cached", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t1"))
      .mockResolvedValueOnce(new Response("t2"));
    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    await auth.refresh(); // now t2
    auth.invalidate("t1"); // late 401 for the old token
    expect(await auth.getToken()).toBe("t2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("invalidates unconditionally without an argument", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("t1"))
      .mockResolvedValueOnce(new Response("t2"));
    const auth = new EthosAuth({ apiKey: "k" });
    await auth.getToken();
    auth.invalidate();
    expect(auth.tokenExpiresAt).toBe(0);
    expect(await auth.getToken()).toBe("t2");
  });
});
