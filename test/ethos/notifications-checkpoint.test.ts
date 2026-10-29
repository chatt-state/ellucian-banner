import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosNotifications } from "../../src/ethos/notifications.js";
import { HttpClient } from "../../src/common/http-client.js";

function batch(ids: number[], remaining = 0) {
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
    { status: 200, headers: { "x-remaining": String(remaining) } },
  );
}

const client = () =>
  new EthosNotifications(
    new HttpClient({ baseUrl: "https://integrate.elluciancloud.com", authProvider: () => "t" }),
  );

const urls = () => vi.mocked(fetch).mock.calls.map((c) => String(c[0]));

describe("poll() checkpointing (onProcessed)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reports each finished batch's highest ID before acknowledging it", async () => {
    const events: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      events.push(`fetch ${String(input)}`);
      return urls().length === 1 ? batch([5, 7, 6], 1) : batch([8], 0);
    });

    const gen = client().poll({
      interval: 1,
      onProcessed: (id) => {
        events.push(`processed ${id}`);
      },
    });
    await gen.next();
    await gen.next();
    await gen.return(undefined);

    expect(events).toEqual([
      "fetch https://integrate.elluciancloud.com/consume",
      "processed 7",
      "fetch https://integrate.elluciancloud.com/consume?lastProcessedID=7",
    ]);
  });

  it("does not checkpoint or acknowledge a batch whose handler throws", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => batch([1, 2], 0));
    const onProcessed = vi.fn();
    await expect(
      (async () => {
        for await (const _batch of client().poll({ interval: 1, onProcessed })) {
          throw new Error("handler failed");
        }
      })(),
    ).rejects.toThrow("handler failed");
    expect(onProcessed).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stops without acknowledging when onProcessed throws (persist failed)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => batch([1], 0));
    const gen = client().poll({
      interval: 1,
      onProcessed: () => {
        throw new Error("disk full");
      },
    });
    await gen.next();
    await expect(gen.next()).rejects.toThrow("disk full");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("a restart that passes the persisted ID re-requests from that point", async () => {
    // First process: handles batch [1,2] and persists 2, then fails on [3].
    let stored: number | undefined;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(batch([1, 2], 1))
      .mockResolvedValueOnce(batch([3], 0));
    await expect(
      (async () => {
        for await (const b of client().poll({
          interval: 1,
          onProcessed: (id) => void (stored = id),
        })) {
          if (b.some((n) => n.id === 3)) throw new Error("crash on 3");
        }
      })(),
    ).rejects.toThrow("crash on 3");
    expect(stored).toBe(2);

    // Second process resumes with the persisted ID, so Ethos re-delivers 3.
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(batch([3], 0));
    const gen = client().poll({ interval: 1, lastProcessedID: stored });
    const first = await gen.next();
    await gen.return(undefined);
    expect(urls()[0]).toBe("https://integrate.elluciancloud.com/consume?lastProcessedID=2");
    expect(first.value?.map((n) => n.id)).toEqual([3]);
  });
});

describe("poll() abort while /consume is in flight", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("ends the generator instead of throwing AbortError", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit).signal!;
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    const controller = new AbortController();
    const gen = client().poll({ interval: 1, signal: controller.signal });
    const next = gen.next();
    setTimeout(() => controller.abort(), 10);
    expect(await next).toEqual({ value: undefined, done: true });
  });

  it("still throws real errors when not aborted", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const gen = client().poll({ interval: 1, signal: new AbortController().signal });
    await expect(gen.next()).rejects.toThrow("fetch failed");
  });
});
