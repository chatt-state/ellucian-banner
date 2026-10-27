export interface EthosAuthConfig {
  /** Ethos Integration API key. Falls back to ETHOS_API_KEY env var if not provided. */
  apiKey?: string;
  /** Base URL for Ethos Integration (default: https://integrate.elluciancloud.com) */
  baseUrl?: string;
  /** Buffer in seconds before token expiry to trigger refresh (default: 30) */
  refreshBuffer?: number;
  /**
   * Requested token lifetime in minutes (1-120), sent as `?expirationMinutes=`
   * to the Ethos /auth endpoint. Omit to use the Ethos default (5 minutes).
   */
  expirationMinutes?: number;
}

export interface BannerAuthConfig {
  /** Banner base URL (e.g., https://banner.example.edu). Falls back to BANNER_BASE_URL env var. */
  baseUrl?: string;
  /** Banner username for Basic Auth. Falls back to BANNER_USERNAME env var. */
  username?: string;
  /** Banner password for Basic Auth. Falls back to BANNER_PASSWORD env var. */
  password?: string;
}
