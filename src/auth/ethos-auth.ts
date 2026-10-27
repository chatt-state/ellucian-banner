import type { EthosAuthConfig } from "./types.js";
import { AuthError } from "../common/errors.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";
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
 */
export class EthosAuth {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly refreshBuffer: number;
  private readonly expirationMinutes: number | undefined;
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

    if (config.baseUrl !== undefined) {
      try {
        new URL(config.baseUrl);
      } catch {
        throw new AuthError(`Invalid baseUrl: ${config.baseUrl}`);
      }
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
  }

  /** Epoch ms when the current token expires, or 0 if no token is cached. */
  get tokenExpiresAt(): number {
    return this.token ? this.expiresAt : 0;
  }

  /** Get a valid JWT token, refreshing if necessary. */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.refreshAt) {
      return this.token;
    }
    return this.refresh();
  }

  /**
   * Force a token refresh. If a refresh is already in flight, its result is
   * shared rather than issuing a second /auth request.
   */
  refresh(): Promise<string> {
    if (!this.inflight) {
      this.inflight = this.fetchToken().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
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

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

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
