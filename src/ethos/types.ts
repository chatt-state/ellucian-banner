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
  /** Base URL for Ethos Integration (default: https://integrate.elluciancloud.com). */
  baseUrl?: string;
  /** Per-attempt request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /** Enable debug logging to stderr. Also enabled by DEBUG=ellucian-banner. */
  debug?: boolean;
  /**
   * Retry 429 and (for idempotent requests) 5xx/network failures with
   * exponential backoff, honoring Retry-After. Enabled by default; pass
   * false to disable or RetryOptions to tune.
   */
  retry?: boolean | RetryOptions;
  /** Seconds before token expiry to refresh it (default: 30). */
  refreshBuffer?: number;
  /** Requested token lifetime in minutes (1-120). Omit for the Ethos default (5). */
  expirationMinutes?: number;
}
