export interface EthosClientConfig {
  /** Ethos Integration API key. Falls back to ETHOS_API_KEY env var if not provided. */
  apiKey?: string;
  /** Base URL for Ethos Integration (default: https://integrate.elluciancloud.com). */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000). */
  timeout?: number;
  /** Enable debug logging to stderr. Also enabled by DEBUG env var. */
  debug?: boolean;
}
