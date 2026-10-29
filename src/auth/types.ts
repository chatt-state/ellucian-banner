import type { RetryOptions } from "../common/retry.js";

export interface EthosAuthConfig {
  /** Ethos Integration API key. Falls back to ETHOS_API_KEY env var if not provided. */
  apiKey?: string;
  /** Base URL for Ethos Integration (default: https://integrate.elluciancloud.com). Must be https. */
  baseUrl?: string;
  /** Buffer in seconds before token expiry to trigger refresh (default: 30) */
  refreshBuffer?: number;
  /**
   * Requested token lifetime in minutes (1-120), sent as `?expirationMinutes=`
   * to the Ethos /auth endpoint. Omit to use the Ethos default (5 minutes).
   */
  expirationMinutes?: number;
  /**
   * Per-attempt timeout for the `POST /auth` token request, in milliseconds
   * (default: 30000). Covers reading the token body as well as the headers.
   */
  timeout?: number;
  /**
   * Retry the token request on 429, 5xx, network errors and timeouts, with
   * exponential backoff. Enabled by default; pass false to disable or
   * RetryOptions to tune.
   */
  retry?: boolean | RetryOptions;
  /**
   * Accept an `http://` baseUrl. Only for loopback test servers: the API key
   * and tokens would otherwise cross the network in cleartext.
   */
  allowInsecureHttp?: boolean;
}

export interface BannerAuthConfig {
  /** Banner base URL (e.g., https://banner.example.edu). Falls back to BANNER_BASE_URL env var. Must be https. */
  baseUrl?: string;
  /** Banner username for Basic Auth. Falls back to BANNER_USERNAME env var. */
  username?: string;
  /** Banner password for Basic Auth. Falls back to BANNER_PASSWORD env var. */
  password?: string;
  /**
   * Accept an `http://` baseUrl. Only for loopback test servers: Basic auth
   * credentials and student data would otherwise cross the network in cleartext.
   */
  allowInsecureHttp?: boolean;
}
