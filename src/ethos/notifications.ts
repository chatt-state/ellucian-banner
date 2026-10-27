/**
 * Ethos change notification consumer.
 *
 * Polls the Ethos `GET /consume` endpoint for change notifications
 * (`Accept: application/vnd.hedtech.change-notifications.v2+json`).
 * Supports single-poll and continuous polling via async generator.
 *
 * Ethos semantics: `lastProcessedID` acknowledges every message up to and
 * including that ID and returns the messages after it. Without it, Ethos
 * treats the previous batch as processed. `limit` is 1-1000; responses are
 * also capped at 1 MB, so fewer messages may be returned. The `x-remaining`
 * response header reports how many messages are still queued.
 *
 * Consequence for restarts: a consumer that starts without `lastProcessedID`
 * silently acknowledges whatever batch was delivered last, including one the
 * previous process failed on. Persist the highest ID you have fully handled
 * (see `PollOptions.onProcessed`) and pass it back as `lastProcessedID`.
 */

import { readJson } from "../common/json.js";
import type { HttpClient } from "../common/http-client.js";
import type { RequestOptions } from "../common/types.js";

/** A single Ethos change notification. */
export interface ChangeNotification {
  id: number;
  /** ISO timestamp the change was published. */
  published?: string;
  operation: "created" | "updated" | "deleted" | "replaced" | "errors";
  resource: { name: string; id: string; version: string };
  contentType: string;
  content: unknown;
  publisher: { applicationName: string; id: string; tenant: { id: string } };
}

/** Options for consuming change notifications. */
export interface ConsumeOptions {
  /** Acknowledge through this notification ID and resume after it. */
  lastProcessedID?: number;
  /** Max notifications per poll (1-1000; Ethos default when omitted). */
  limit?: number;
}

/** Options for continuous polling. */
export interface PollOptions extends ConsumeOptions {
  /** Milliseconds to wait between polls when the queue is drained (default 5000). */
  interval?: number;
  /**
   * Stops polling when aborted: during the wait between polls, or while a
   * `/consume` request is in flight. In both cases the generator simply
   * finishes; it does not throw the AbortError.
   */
  signal?: AbortSignal;
  /**
   * Checkpoint hook. Called with the highest notification ID of a batch once
   * your loop body has finished with that batch (i.e. when it asks for the
   * next one), and before that ID is sent to Ethos as `lastProcessedID`.
   *
   * Persist the value and pass it back as `lastProcessedID` when the process
   * restarts. Without that, the first `/consume` of the new process carries no
   * `lastProcessedID`, and Ethos treats the previously delivered batch as
   * processed even if your handler failed on it.
   *
   * If this callback throws, polling stops and the batch is not acknowledged.
   * It is not called for a batch you leave with `break`; persist that batch's
   * ID yourself if you handled it.
   */
  onProcessed?: (lastProcessedID: number) => void | Promise<void>;
}

/** A batch of notifications plus queue metadata. */
export interface ConsumeResult {
  notifications: ChangeNotification[];
  /** Messages still queued after this batch (`x-remaining`), when reported. */
  remaining?: number;
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
  async consume(
    options?: ConsumeOptions,
    requestOptions?: RequestOptions,
  ): Promise<ChangeNotification[]> {
    return (await this.consumeBatch(options, requestOptions)).notifications;
  }

  /** Single poll that also returns the `x-remaining` queue depth. */
  async consumeBatch(
    options?: ConsumeOptions,
    requestOptions?: RequestOptions,
  ): Promise<ConsumeResult> {
    const params = new URLSearchParams();
    if (options?.lastProcessedID !== undefined) {
      if (!Number.isInteger(options.lastProcessedID) || options.lastProcessedID < 0) {
        throw new TypeError("lastProcessedID must be a non-negative integer");
      }
      params.set("lastProcessedID", String(options.lastProcessedID));
    }
    if (options?.limit !== undefined) {
      if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000) {
        throw new TypeError("limit must be an integer between 1 and 1000");
      }
      params.set("limit", String(options.limit));
    }
    const qs = params.toString();
    const path = `/consume${qs ? `?${qs}` : ""}`;

    const response = await this.http.get(path, { Accept: ACCEPT_HEADER }, requestOptions);
    // readJson: empty body -> undefined; non-JSON -> BannerError with a
    // generic message (the body, which is student data, stays in responseBody).
    const notifications = await readJson<ChangeNotification[] | undefined>(response);

    const result: ConsumeResult = {
      notifications: Array.isArray(notifications) ? notifications : [],
    };
    const remaining = parseInt(response.headers.get("x-remaining") ?? "", 10);
    if (!isNaN(remaining)) result.remaining = remaining;
    return result;
  }

  /**
   * Continuous polling via async generator.
   *
   * Yields each batch of notifications. Requesting the next batch
   * acknowledges the previous one: once your loop body finishes a batch, the
   * generator sends its highest ID as `lastProcessedID` on the next request.
   *
   * Within one process, a batch whose handler throws is not acknowledged.
   * Across a restart that only holds if the new process passes the last fully
   * handled ID as `lastProcessedID`; use `onProcessed` to persist it. A first
   * request without `lastProcessedID` lets Ethos treat the previously
   * delivered batch as processed.
   *
   * Polls again immediately while the queue has a backlog; otherwise waits
   * `interval` ms. Stops when the generator is returned (e.g., `break`)
   * or `signal` is aborted (also mid-request; the generator then just ends).
   */
  async *poll(options?: PollOptions): AsyncGenerator<ChangeNotification[], void, unknown> {
    const interval = options?.interval ?? 5000;
    const signal = options?.signal;
    let lastProcessedID = options?.lastProcessedID;

    while (!signal?.aborted) {
      let batch: ConsumeResult;
      try {
        batch = await this.consumeBatch(
          { lastProcessedID, limit: options?.limit },
          signal ? { signal } : undefined,
        );
      } catch (error) {
        // An abort that lands during /consume is a stop request, not a failure.
        if (signal?.aborted) return;
        throw error;
      }
      const { notifications, remaining } = batch;
      yield notifications;

      if (notifications.length > 0) {
        const maxId = notifications.reduce(
          (max, n) => (typeof n.id === "number" && n.id > max ? n.id : max),
          lastProcessedID ?? -1,
        );
        if (maxId >= 0 && maxId !== lastProcessedID) {
          // The consumer finished this batch: let it checkpoint before we ack.
          await options?.onProcessed?.(maxId);
          lastProcessedID = maxId;
        }
      }

      const backlog =
        remaining !== undefined
          ? remaining > 0
          : options?.limit !== undefined && notifications.length >= options.limit;
      if (!backlog) {
        await wait(interval, signal);
      }
    }
  }
}

/** Abortable delay; resolves early (without throwing) if the signal aborts. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
