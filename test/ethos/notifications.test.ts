import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosNotifications } from "../../src/ethos/notifications.js";
import { HttpClient } from "../../src/common/http-client.js";

function mockResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

function createHttpClient() {
  return new HttpClient({
    baseUrl: "https://integrate.elluciancloud.com",
    authProvider: () => "Bearer mock-token",
  });
}

const sampleNotifications = [
  {
    id: 1,
    operation: "created",
    resource: { name: "persons", id: "abc-123", version: "12" },
    contentType: "application/vnd.hedtech.integration.v12+json",
    content: { id: "abc-123" },
    publisher: { applicationName: "TestApp", id: "pub-1", tenant: { id: "tenant-1" } },
  },
  {
    id: 2,
    operation: "updated",
    resource: { name: "persons", id: "def-456", version: "12" },
    contentType: "application/vnd.hedtech.integration.v12+json",
    content: { id: "def-456" },
    publisher: { applicationName: "TestApp", id: "pub-1", tenant: { id: "tenant-1" } },
  },
];

describe("EthosNotifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("consume", () => {
    it("should fetch notifications from /consume", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(sampleNotifications));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      const result = await notifications.consume();

      expect(result).toEqual(sampleNotifications);
      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain("/consume");
    });

    it("should pass lastProcessedID as query parameter", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      await notifications.consume({ lastProcessedID: 42 });

      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain("lastProcessedID=42");
    });

    it("should pass limit as query parameter", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      await notifications.consume({ limit: 10 });

      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain("limit=10");
    });

    it("should send the change-notifications Accept header", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      await notifications.consume();

      const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.hedtech.change-notifications.v2+json");
    });

    it("should return empty array when no notifications", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      const result = await notifications.consume();

      expect(result).toEqual([]);
    });
  });

  describe("poll", () => {
    it("should yield batches on each poll iteration", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(sampleNotifications))
        .mockResolvedValueOnce(mockResponse([sampleNotifications[0]]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      // Use minimal interval to avoid slow tests
      const gen = notifications.poll({ interval: 10 });

      // First batch
      const batch1 = await gen.next();
      expect(batch1.value).toEqual(sampleNotifications);
      expect(batch1.done).toBe(false);

      // Second batch (after short interval)
      const batch2 = await gen.next();
      expect(batch2.value).toEqual([sampleNotifications[0]]);
      expect(batch2.done).toBe(false);

      // Stop the generator
      await gen.return(undefined);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("should stop when generator is returned", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(sampleNotifications))
        .mockResolvedValue(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      const gen = notifications.poll({ interval: 10 });

      // Consume one batch then stop
      await gen.next();
      const result = await gen.return(undefined);
      expect(result.done).toBe(true);
    });

    it("should pass consume options through to poll", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      const gen = notifications.poll({ lastProcessedID: 99, limit: 5, interval: 10 });

      await gen.next();

      const url = vi.mocked(fetch).mock.calls[0]![0] as string;
      expect(url).toContain("lastProcessedID=99");
      expect(url).toContain("limit=5");

      await gen.return(undefined);
    });

    it("should use for-await-of with break", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockResponse(sampleNotifications))
        .mockResolvedValue(mockResponse([]));

      const http = createHttpClient();
      const notifications = new EthosNotifications(http);
      const batches: unknown[][] = [];

      for await (const batch of notifications.poll({ interval: 10 })) {
        batches.push(batch);
        break; // Stop after first batch
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual(sampleNotifications);
    });
  });
});
