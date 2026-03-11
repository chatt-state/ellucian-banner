export interface EthosAuthConfig {
  /** Ethos Integration API key */
  apiKey: string;
  /** Base URL for Ethos Integration (default: https://integrate.elluciancloud.com) */
  baseUrl?: string;
  /** Buffer in seconds before token expiry to trigger refresh (default: 30) */
  refreshBuffer?: number;
}

export interface BannerAuthConfig {
  /** Banner base URL (e.g., https://banner.example.edu). Falls back to BANNER_BASE_URL env var. */
  baseUrl?: string;
  /** Banner username for Basic Auth. Falls back to BANNER_USERNAME env var. */
  username?: string;
  /** Banner password for Basic Auth. Falls back to BANNER_PASSWORD env var. */
  password?: string;
}
