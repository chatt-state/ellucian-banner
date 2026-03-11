import type { BannerAuthConfig } from "./types.js";

/**
 * Manages Banner native REST API Basic Authentication.
 *
 * Credentials can be provided via the constructor config or environment variables.
 * Constructor params always take precedence over env vars.
 *
 * Environment variables:
 * - `BANNER_BASE_URL` — Banner base URL
 * - `BANNER_USERNAME` — Banner username
 * - `BANNER_PASSWORD` — Banner password
 */
export class BannerAuth {
  readonly baseUrl: string;
  private readonly encoded: string;

  constructor(config: BannerAuthConfig = {}) {
    const baseUrl = config.baseUrl ?? process.env.BANNER_BASE_URL;
    const username = config.username ?? process.env.BANNER_USERNAME;
    const password = config.password ?? process.env.BANNER_PASSWORD;

    const missing: string[] = [];
    if (!baseUrl) missing.push("baseUrl (or BANNER_BASE_URL)");
    if (!username) missing.push("username (or BANNER_USERNAME)");
    if (!password) missing.push("password (or BANNER_PASSWORD)");

    if (missing.length > 0) {
      throw new Error(`BannerAuth: missing required configuration: ${missing.join(", ")}`);
    }

    // After validation we know these are defined; assert for TypeScript
    this.baseUrl = (baseUrl as string).replace(/\/+$/, "");
    this.encoded = Buffer.from(`${username as string}:${password as string}`).toString("base64");
  }

  /** Get the Authorization header value. */
  getAuthHeader(): string {
    return `Basic ${this.encoded}`;
  }
}
