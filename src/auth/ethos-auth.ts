import type { EthosAuthConfig } from "./types.js";
import { AuthError } from "../common/errors.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";
const DEFAULT_REFRESH_BUFFER = 30; // seconds
const TOKEN_LIFETIME = 300; // 5 minutes in seconds

/**
 * Manages Ethos Integration API key -> JWT authentication.
 * Automatically refreshes tokens before expiry.
 */
export class EthosAuth {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly refreshBuffer: number;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: EthosAuthConfig) {
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

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.refreshBuffer = config.refreshBuffer ?? DEFAULT_REFRESH_BUFFER;
  }

  /** Get a valid JWT token, refreshing if necessary. */
  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }
    return this.refresh();
  }

  /** Force a token refresh. */
  async refresh(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new AuthError(
        `Ethos auth failed: ${response.status} ${response.statusText}`,
        response.status,
      );
    }

    const token = await response.text();
    this.token = token;
    this.tokenExpiresAt = Date.now() + (TOKEN_LIFETIME - this.refreshBuffer) * 1000;
    return token;
  }
}
