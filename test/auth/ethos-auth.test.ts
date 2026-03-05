import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosAuth } from "../../src/auth/ethos-auth.js";
import { AuthError } from "../../src/common/errors.js";

describe("EthosAuth", () => {
  const mockApiKey = "test-api-key-12345";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should exchange API key for JWT token", async () => {
    const mockToken = "mock-jwt-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(mockToken, { status: 200 }));

    const auth = new EthosAuth({ apiKey: mockApiKey });
    const token = await auth.getToken();

    expect(token).toBe(mockToken);
    expect(fetch).toHaveBeenCalledWith("https://integrate.elluciancloud.com/auth", {
      method: "POST",
      headers: { Authorization: `Bearer ${mockApiKey}` },
    });
  });

  it("should cache token on subsequent calls", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("cached-token", { status: 200 }),
    );

    const auth = new EthosAuth({ apiKey: mockApiKey });
    const token1 = await auth.getToken();
    const token2 = await auth.getToken();

    expect(token1).toBe("cached-token");
    expect(token2).toBe("cached-token");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should throw AuthError on failed auth", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
    );

    const auth = new EthosAuth({ apiKey: "bad-key" });
    await expect(auth.getToken()).rejects.toThrow(AuthError);
  });

  it("should use custom base URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("token", { status: 200 }));

    const auth = new EthosAuth({
      apiKey: mockApiKey,
      baseUrl: "https://custom.example.com",
    });
    await auth.getToken();

    expect(fetch).toHaveBeenCalledWith("https://custom.example.com/auth", expect.any(Object));
  });

  it("should force refresh when called explicitly", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("token-1", { status: 200 }))
      .mockResolvedValueOnce(new Response("token-2", { status: 200 }));

    const auth = new EthosAuth({ apiKey: mockApiKey });
    const token1 = await auth.getToken();
    const token2 = await auth.refresh();

    expect(token1).toBe("token-1");
    expect(token2).toBe("token-2");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
