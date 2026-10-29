/**
 * Response body helpers.
 */

import { BannerError } from "./errors.js";

/**
 * Parse a JSON response body, tolerating empty bodies.
 *
 * Returns `undefined` for 204/205 responses and for empty bodies (common for
 * Banner PUT/POST endpoints), instead of throwing a SyntaxError the way
 * `response.json()` does.
 */
export async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  const text = await response.text();
  if (text.trim() === "") {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BannerError(
      `Expected a JSON response body but could not parse it (status ${response.status})`,
      response.status,
      text,
    );
  }
}
