/**
 * EEDM media-type helpers.
 *
 * Ethos selects the resource version from the Accept header
 * (`application/vnd.hedtech.integration.v{N}+json`, or a full semantic
 * version such as `v12.1.0`). Requests with a body send the same media type
 * as Content-Type. Without a version, Ethos returns the latest version.
 */

import type { EedmVersion } from "./types.js";

const MEDIA_TYPE_PREFIX = "application/vnd.hedtech.integration.v";

/** Resolve an EedmVersion to a media type, or `application/json` when unversioned. */
export function eedmMediaType(version?: EedmVersion): string {
  if (version === undefined || version === null || version === "" || version === 0) {
    return "application/json";
  }
  if (typeof version === "number") {
    if (!Number.isInteger(version) || version < 0) {
      throw new TypeError(`Invalid EEDM version: ${version}`);
    }
    return `${MEDIA_TYPE_PREFIX}${version}+json`;
  }
  const trimmed = version.trim();
  if (trimmed.startsWith("application/")) return trimmed;
  const bare = trimmed.replace(/^v/i, "");
  if (!/^\d+(\.\d+){0,2}$/.test(bare)) {
    throw new TypeError(`Invalid EEDM version: ${version}`);
  }
  return `${MEDIA_TYPE_PREFIX}${bare}+json`;
}

/** Build EEDM Accept (and optionally Content-Type) headers. */
export function eedmHeaders(
  version?: EedmVersion,
  includeContentType = false,
): Record<string, string> {
  const mediaType = eedmMediaType(version);
  const headers: Record<string, string> = { Accept: mediaType };
  if (includeContentType) headers["Content-Type"] = mediaType;
  return headers;
}
