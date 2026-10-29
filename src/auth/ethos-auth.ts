import type { EthosAuthConfig } from "./types.js";
import { raceAbort } from "../common/abort.js";
import { AuthError, BannerError, TimeoutError } from "../common/errors.js";
import { withRetry } from "../common/retry.js";
import type { RetryOptions } from "../common/retry.js";
import { checkBaseUrl } from "../common/url.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";
const DEFAULT_TIMEOUT = 30_000; // ms
const DEFAULT_REFRESH_BUFFER = 30; // seconds
/** Ethos's default token lifetime, used when the JWT carries no usable `exp`. */
const FALLBACK_TOKEN_LIFETIME = 300; // seconds

/** Claims we read from an Ethos access token. */
export interface JwtTimeClaims {
  /** Expiry, seconds since the epoch. */
  exp: number;
  /** Issued-at, seconds since the epoch, when present. */
  iat?: number;
}

/**
 * Decode the `exp` (and `iat`) claims from a JWT without verifying it.
 *
 * Returns undefined if the token is not a JWT, the payload is not valid
 * base64url JSON, or `exp` is missing or not a positive number. The token is
 * only inspected for scheduling refreshes; Ethos remains the authority on
 * whether it is valid.
 */
export function decodeJwtTimeClaims(token: string): JwtTimeClaims | undefined {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (parts.length !== 3 || !payloadPart) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as unknown;
    if (!payload || typeof payload !== "object") return undefined;
    const { exp, iat } = payload as { exp?: unknown; iat?: unknown };
    if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) return undefined;
    const claims: JwtTimeClaims = { exp };
    if (typeof iat === "number" && Number.isFinite(iat) && iat > 0 && iat < exp) {
      claims.iat = iat;
    }
    return claims;
  } catch {
    return undefined;
  }
}

/**
 * Manages Ethos Integration API key -> JWT authentication.
 *
 * - Token lifetime is read from the JWT `exp` claim (falling back to 300s).
 *   When `iat` is present, the lifetime `exp - iat` is applied to the local
 *   clock so a skewed workstation clock does not cause early/late refreshes.
 * - Tokens are refreshed `refreshBuffer` seconds before they expire.
 * - Concurrent callers share a single in-flight refresh request.
 * - `invalidate(token)` lets the HTTP layer discard a token Ethos rejected
 *   with 401 without stampeding the /auth endpoint.
 * - Each /auth attempt has its own timeout (TimeoutError), and 429, 5xx,
 *   network errors and timeouts are retried with backoff. A caller's
 *   AbortSignal stops that caller waiting without cancelling the refresh that
 *   other callers share.
 */
export class EthosAuth {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly refreshBuffer: number;
  private readonly expirationMinutes: number | undefined;
  private readonly timeout: number;
  private readonly retryOptions: RetryOptions | undefined;
  private token: string | null = null;
  /** Epoch ms after which the cached token should no longer be handed out. */
  private refreshAt = 0;
  /** Epoch ms when the cached token actually expires. */
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;

  constructor(config: EthosAuthConfig = {}) {
    const apiKey = config.apiKey || process.env.ETHOS_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new AuthError(
        "Ethos API key is required. Provide apiKey in config or set ETHOS_API_KEY env var.",
      );
    }

    // The API key and every token cross this connection: require HTTPS.
    const urlProblem = checkBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL, {
      allowInsecureHttp: config.allowInsecureHttp,
    });
    if (urlProblem) {
      throw new AuthError(`Invalid baseUrl: ${urlProblem}`);
    }

    if (config.timeout !== undefined && !(config.timeout > 0)) {
      throw new AuthError("timeout must be a positive number of milliseconds");
    }

    if (config.expirationMinutes !== undefined) {
      const m = config.expirationMinutes;
      if (!Number.isInteger(m) || m < 1 || m > 120) {
        throw new AuthError("expirationMinutes must be an integer between 1 and 120");
      }
    }

    if (config.refreshBuffer !== undefined && !(config.refreshBuffer >= 0)) {
      throw new AuthError("refreshBuffer must be a non-negative number of seconds");
    }

    this.apiKey = apiKey.trim();
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.refreshBuffer = config.refreshBuffer ?? DEFAULT_REFRESH_BUFFER;
    this.expirationMinutes = config.expirationMinutes;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    const retry = config.retry ?? true;
    this.retryOptions = retry === true ? {} : retry || undefined;
  }

  /** Epoch ms when the current token expires, or 0 if no token is cached. */
  get tokenExpiresAt(): number {
    return this.token ? this.expiresAt : 0;
  }

  /**
   * Get a valid JWT token, refreshing if necessary.
   *
   * @param signal - Stop waiting (rejecting with the abort reason) when this
   *   aborts. A refresh shared with other callers keeps running.
   */
  async getToken(signal?: AbortSignal): Promise<string> {
    if (this.token && Date.now() < this.refreshAt) {
      return this.token;
    }
    return this.refresh(signal);
  }

  /**
   * Force a token refresh. If a refresh is already in flight, its result is
   * shared rather than issuing a second /auth request.
   *
   * @param signal - Stop waiting when this aborts (see {@link getToken}).
   */
  refresh(signal?: AbortSignal): Promise<string> {
    if (!this.inflight) {
      this.inflight = this.fetchToken().finally(() => {
        this.inflight = null;
      });
    }
    return raceAbort(this.inflight, signal);
  }

  /**
   * Discard the cached token so the next `getToken()` fetches a new one.
   *
   * If `rejectedToken` is given and a different (newer) token is already
   * cached, nothing happens — another caller has already refreshed.
   */
  invalidate(rejectedToken?: string): void {
    if (rejectedToken !== undefined && rejectedToken !== this.token) return;
    this.token = null;
    this.refreshAt = 0;
    this.expiresAt = 0;
  }

  private async fetchToken(): Promise<string> {
    const url =
      this.expirationMinutes !== undefined
        ? `${this.baseUrl}/auth?expirationMinutes=${this.expirationMinutes}`
        : `${this.baseUrl}/auth`;

    let response: Response;
    try {
      const attempt = () => this.authAttempt(url);
      response = this.retryOptions
        ? await withRetry(attempt, this.retryOptions, undefined, {
            // Issuing a token has no side effects, so it is safe to repeat.
            retryServerErrors: true,
            shouldRetryError: (error) =>
              error instanceof TimeoutError || error instanceof TypeError,
          })
        : await attempt();
    } catch (error) {
      if (error instanceof BannerError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new AuthError(`Ethos auth request failed: ${reason}`);
    }

    if (!response.ok) {
      // Do not include the response body: it is not useful and never echo the key.
      throw new AuthError(
        `Ethos auth failed: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const token = (await response.text()).trim();
    if (token.length === 0) {
      throw new AuthError("Ethos auth returned an empty token", response.status);
    }

    const now = Date.now();
    const lifetimeMs = this.lifetimeMs(token, now);
    // Never let the buffer eat more than half of a short-lived token.
    const bufferMs = Math.min(this.refreshBuffer * 1000, lifetimeMs / 2);

    this.token = token;
    this.expiresAt = now + lifetimeMs;
    this.refreshAt = this.expiresAt - bufferMs;
    return token;
  }

  /**
   * One `POST /auth` attempt. The timeout covers the headers and the token
   * body; the body is buffered so a stalled stream cannot hang the refresh.
   */
  private async authAttempt(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(
          new TimeoutError(`Ethos auth request timed out after ${this.timeout}ms`, this.timeout),
        ),
      this.timeout,
    );
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      const text = await response.text();
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== undefined) {
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Remaining token lifetime in ms, from JWT claims or the fallback. */
  private lifetimeMs(token: string, now: number): number {
    const fallback = (this.expirationMinutes ?? FALLBACK_TOKEN_LIFETIME / 60) * 60_000;
    const claims = decodeJwtTimeClaims(token);
    if (!claims) return fallback;

    if (claims.iat !== undefined) {
      // Server-relative lifetime, immune to local clock skew.
      return (claims.exp - claims.iat) * 1000;
    }
    const remaining = claims.exp * 1000 - now;
    return remaining > 0 ? remaining : 0;
  }
}
