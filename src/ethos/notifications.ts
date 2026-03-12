/**
 * Ethos change notification consumer.
 *
 * Polls the Ethos `GET /consume` endpoint for change notifications.
 * Supports single-poll and continuous polling via async generator.
 */

import type { HttpClient } from "../common/http-client.js";

/** A single Ethos change notification. */
export interface ChangeNotification {
  id: number;
  operation: "created" | "updated" | "deleted" | "errors";
  resource: { name: string; id: string; version: string };
  contentType: string;
  content: unknown;
  publisher: { applicationName: string; id: string; tenant: { id: string } };
}

/** Options for consuming change notifications. */
export interface ConsumeOptions {
  /** Resume from this notification ID (exclusive). */
  lastProcessedID?: number;
  /** Max notifications per poll (Ethos default varies). */
  limit?: number;
}

const ACCEPT_HEADER = "application/vnd.hedtech.change-notifications.v2+json";

/**
 * Consumer for Ethos change notifications.
 *
 * Use `consume()` for a single poll, or `poll()` for continuous
 * polling that yields batches via an async generator.
 */
export class EthosNotifications {
  constructor(private readonly http: HttpClient) {}

  /** Single poll — fetch one batch of change notifications. */
  async consume(options?: ConsumeOptions): Promise<ChangeNotification[]> {
    const params = new URLSearchParams();
    if (options?.lastProcessedID !== undefined) {
      params.set("lastProcessedID", String(options.lastProcessedID));
    }
    if (options?.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    const qs = params.toString();
    const path = `/consume${qs ? `?${qs}` : ""}`;

    const response = await this.http.get(path, { Accept: ACCEPT_HEADER });
    return (await response.json()) as ChangeNotification[];
  }

  /**
   * Continuous polling via async generator.
   *
   * Yields each batch of notifications. Stops when the generator
   * is returned (e.g., via `break` or `.return()`).
   *
   * @param options.interval - Milliseconds between polls (default 5000).
   */
  async *poll(
    options?: ConsumeOptions & { interval?: number },
  ): AsyncGenerator<ChangeNotification[], void, unknown> {
    const interval = options?.interval ?? 5000;
    const consumeOpts: ConsumeOptions = {
      lastProcessedID: options?.lastProcessedID,
      limit: options?.limit,
    };

    while (true) {
      const batch = await this.consume(consumeOpts);
      yield batch;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
