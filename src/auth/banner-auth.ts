import type { BannerAuthConfig } from "./types.js";

/**
 * Manages Banner native REST API Basic Authentication.
 */
export class BannerAuth {
  readonly baseUrl: string;
  private readonly encoded: string;

  constructor(config: BannerAuthConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.encoded = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  /** Get the Authorization header value. */
  getAuthHeader(): string {
    return `Basic ${this.encoded}`;
  }
}
