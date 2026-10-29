/**
 * Real-socket tests: a local server that sends headers and then stalls the
 * body, and one that never answers POST /auth. Mocked fetch cannot reproduce
 * these, because the hang happens inside undici's body stream.
 */
import { createServer } from "node:http";
import type { Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpClient } from "../../src/common/http-client.js";
import { AuthError, TimeoutError } from "../../src/common/errors.js";
import { EthosClient } from "../../src/ethos/client.js";

let server: Server;
let baseUrl: string;
const open: ServerResponse[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    open.push(res);
    if (req.url?.startsWith("/stall-body")) {
      // Headers and a first chunk, then nothing.
      res.writeHead(200, { "content-type": "application/json" });
      res.write("[");
      return;
    }
    if (req.method === "POST" && req.url?.startsWith("/auth")) {
      return; // never answer
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end("[]");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const res of open) res.destroy();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("HttpClient body read is covered by timeout and AbortSignal", () => {
  it("raises TimeoutError when the body stalls after the headers", async () => {
    const client = new HttpClient({ baseUrl, authProvider: () => "Bearer t", timeout: 300 });
    const started = Date.now();
    await expect(client.get("/stall-body")).rejects.toBeInstanceOf(TimeoutError);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("honors the caller's AbortSignal while the body is stalled", async () => {
    const client = new HttpClient({ baseUrl, authProvider: () => "Bearer t", timeout: 60_000 });
    const controller = new AbortController();
    const reason = new Error("user cancelled");
    setTimeout(() => controller.abort(reason), 200);
    await expect(client.get("/stall-body", undefined, { signal: controller.signal })).rejects.toBe(
      reason,
    );
  });
});

describe("Ethos /auth is covered by timeout and AbortSignal", () => {
  it("rejects with TimeoutError instead of hanging when /auth never answers", async () => {
    const ethos = new EthosClient({
      apiKey: "k",
      baseUrl,
      allowInsecureHttp: true,
      timeout: 300,
      retry: false,
    });
    const started = Date.now();
    await expect(ethos.get("persons", "p1", 12)).rejects.toBeInstanceOf(TimeoutError);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("stops waiting for a hung /auth when the caller aborts", async () => {
    const ethos = new EthosClient({
      apiKey: "k",
      baseUrl,
      allowInsecureHttp: true,
      timeout: 60_000,
      retry: false,
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);
    const started = Date.now();
    await expect(
      ethos.get("persons", "p1", 12, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("wraps a network failure on /auth in AuthError", async () => {
    const ethos = new EthosClient({
      apiKey: "k",
      // Nothing listens on port 1.
      baseUrl: "http://127.0.0.1:1",
      allowInsecureHttp: true,
      retry: false,
    });
    await expect(ethos.get("persons", "p1", 12)).rejects.toBeInstanceOf(AuthError);
  });
});
