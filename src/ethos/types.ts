import type { RetryOptions } from "../common/retry.js";

/**
 * An EEDM resource version. Either a major version number (`12`), a full
 * semantic version string (`"12.1.0"`), or a complete media type
 * (`"application/vnd.hedtech.integration.v12.1.0+json"`).
 */
export type EedmVersion = number | string;

export interface EthosClientConfig {
  /** Ethos Integration API key. Falls back to ETHOS_API_KEY env var if not provided. */
  apiKey?: string;
  /** Base URL for Ethos Integration (default: https://integrate.elluciancloud.com). Must be https. */
  baseUrl?: string;
  /**
   * Per-attempt timeout in milliseconds (default: 30000). Covers reading the
   * response body, and also applies to each `POST /auth` token request.
   */
  timeout?: number;
  /** Enable debug logging to stderr (redacted paths only). Also enabled by DEBUG=ellucian-banner. */
  debug?: boolean;
  /**
   * Retry 429 and (for idempotent requests) 5xx/network failures with
   * exponential backoff, honoring Retry-After. Also applies to the token
   * request (429, 5xx, network errors, timeouts). Enabled by default; pass
   * false to disable or RetryOptions to tune.
   */
  retry?: boolean | RetryOptions;
  /** Seconds before token expiry to refresh it (default: 30). */
  refreshBuffer?: number;
  /** Requested token lifetime in minutes (1-120). Omit for the Ethos default (5). */
  expirationMinutes?: number;
  /**
   * Accept an `http://` baseUrl. Only for loopback test servers: the API key,
   * tokens and student data would otherwise cross the network in cleartext.
   */
  allowInsecureHttp?: boolean;
}
