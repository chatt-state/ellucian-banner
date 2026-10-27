/**
 * URL safety helpers.
 *
 * Base URLs carry credentials (Basic auth, API keys, bearer tokens) and the
 * responses carry FERPA-protected data, so they must be HTTPS and must not
 * smuggle userinfo, a query string, or a fragment.
 */

/** Options for {@link checkBaseUrl}. */
export interface BaseUrlOptions {
  /**
   * Allow a plain `http:` base URL. Intended only for loopback test servers;
   * never set this for a real Banner or Ethos host, because credentials and
   * student data would cross the network in cleartext.
   */
  allowInsecureHttp?: boolean;
}

/**
 * Validate a base URL. Returns a description of the problem, or undefined
 * when the URL is acceptable. The URL itself is never echoed back, because a
 * misconfigured value can contain a password.
 */
export function checkBaseUrl(raw: string, options: BaseUrlOptions = {}): string | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "baseUrl is not a valid absolute URL";
  }
  if (url.protocol !== "https:") {
    if (url.protocol === "http:" && options.allowInsecureHttp === true) {
      // explicitly allowed (loopback testing)
    } else if (url.protocol === "http:") {
      return "baseUrl must use https:// (set allowInsecureHttp: true only for loopback tests)";
    } else {
      return `baseUrl must use https://, got ${url.protocol}`;
    }
  }
  if (url.username !== "" || url.password !== "") {
    return "baseUrl must not contain credentials (user:password@)";
  }
  if (url.search !== "" || raw.includes("?")) {
    return "baseUrl must not contain a query string";
  }
  if (url.hash !== "" || raw.includes("#")) {
    return "baseUrl must not contain a fragment";
  }
  return undefined;
}

/**
 * Reject request paths that could leave the configured base URL.
 *
 * The path must start with a single `/`, and must not contain backslashes or
 * dot segments (`.`, `..`, or their percent-encoded forms), which WHATWG URL
 * parsing would collapse. Only the part before `?`/`#` is checked.
 */
export function checkRequestPath(path: string): string | undefined {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return 'request path must start with a single "/"';
  }
  const pathPart = path.split(/[?#]/, 1)[0] ?? "";
  if (pathPart.includes("\\")) {
    return "request path must not contain a backslash";
  }
  for (const segment of pathPart.split("/")) {
    const decoded = segment.replace(/%2e/gi, ".");
    if (decoded === "." || decoded === "..") {
      return 'request path must not contain "." or ".." segments';
    }
  }
  return undefined;
}

/**
 * True when `value` (after trimming and percent-decoding) is a dot segment
 * or contains a path separator, i.e. it could change the URL path when
 * interpolated as a single segment.
 */
export function isUnsafePathSegment(value: string): boolean {
  const trimmed = value.trim();
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // malformed escapes are left as-is; encodeURIComponent will escape the "%"
  }
  for (const candidate of [trimmed, decoded]) {
    if (candidate === "." || candidate === "..") return true;
    if (candidate.includes("/") || candidate.includes("\\")) return true;
  }
  return false;
}
