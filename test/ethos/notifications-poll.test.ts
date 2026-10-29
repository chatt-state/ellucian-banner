import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosNotifications } from "../../src/ethos/notifications.js";
import { HttpClient } from "../../src/common/http-client.js";

function batch(ids: number[], remaining?: number) {
  const headers: Record<string, string> = {};
  if (remaining !== undefined) headers["x-remaining"] = String(remaining);
  return new Response(
    JSON.stringify(
      ids.map((id) => ({
        id,
        operation: "updated",
        resource: { name: "persons", id: `p${id}`, version: "12" },
        contentType: "application/vnd.hedtech.integration.v12+json",
        content: {},
        publisher: { applicationName: "A", id: "x", tenant: { id: "t" } },
      })),
    ),
    { status: 200, headers },
  );
}

function client() {
  return new EthosNotifications(
    new HttpClient({
      baseUrl: "https://integrate.elluciancloud.com",
      authProvider: () => "Bearer t",
    }),
  );
}

const urls = () => vi.mocked(fetch).mock.calls.map((c) => c[0] as string);

describe("EthosNotifications.poll acknowledgement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("advances lastProcessedID to the highest ID yielded", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(batch([10, 11, 12]))
      .mockResolvedValueOnce(batch([13]))
      .mockResolvedValueOnce(batch([]));

    const gen = client().poll({ interval: 1 });
    await gen.next();
    await gen.next();
    await gen.next();
    await gen.return(undefined);

    const u = urls();
    expect(u[0]).toBe("https://integrate.elluciancloud.com/consume");
    expect(u[1]).toContain("lastProcessedID=12");
    expect(u[2]).toContain("lastProcessedID=13");
  });

  it("keeps the caller-supplied lastProcessedID until messages arrive", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(batch([])).mockResolvedValueOnce(batch([]));
    const gen = client().poll({ lastProcessedID: 99, interval: 1 });
    await gen.next();
    await gen.next();
    await gen.return(undefined);
    expect(urls().every((u) => u.includes("lastProcessedID=99"))).toBe(true);
  });

  it("polls again immediately while x-remaining reports a backlog", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(batch([1, 2], 5))
      .mockResolvedValueOnce(batch([3], 0));
    const gen = client().poll({ interval: 60_000 });
    const start = Date.now();
    await gen.next();
    await gen.next(); // would hang for 60s if it waited
    expect(Date.now() - start).toBeLessThan(5_000);
    await gen.return(undefined);
  });

  it("stops when the signal is aborted during the wait", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(batch([]));
    const controller = new AbortController();
    const gen = client().poll({ interval: 60_000, signal: controller.signal });
    await gen.next();
    const next = gen.next();
    controller.abort();
    expect(await next).toEqual({ value: undefined, done: true });
  });
});

describe("EthosNotifications.consume", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns x-remaining from consumeBatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(batch([1], 42));
    const result = await client().consumeBatch({ limit: 1 });
    expect(result.remaining).toBe(42);
    expect(result.notifications.map((n) => n.id)).toEqual([1]);
  });

  it("treats an empty body as no notifications", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 200 }));
    expect(await client().consume()).toEqual([]);
  });

  it.each([[0], [1001], [2.5]])("rejects limit=%s (Ethos accepts 1-1000)", async (limit) => {
    await expect(client().consume({ limit })).rejects.toThrow(TypeError);
  });

  it("rejects a negative lastProcessedID", async () => {
    await expect(client().consume({ lastProcessedID: -1 })).rejects.toThrow(TypeError);
  });

  it("passes request options (e.g. AbortSignal) through", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(batch([]));
    await client().consume({}, { headers: { "X-Trace": "1" } });
    const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-Trace"]).toBe("1");
    expect(headers.Accept).toBe("application/vnd.hedtech.change-notifications.v2+json");
  });
});
