# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking

- **Pre-bound accessors now call the real EEDM resources.** `positions` and `jobs` call
  `institution-positions` and `institution-jobs` (v12). `financialAidAwards` calls
  `student-financial-aid-awards` v11 (the old `financial-aid-awards` does not exist), and its
  `FinancialAidAward` type now follows the v11 schema (`awardFund`, `awardsByPeriod`, ...).
  `grades` calls `grade-definitions` v6. All of these previously returned 404.
- **`courses` is pinned to v6** (Ethos never published v4) and **`accountingStrings` to v7**
  (the only published version, not v12).
- **Base URLs must be `https://`** and must not contain credentials, a query or a fragment, in
  `BannerAuth`/`BannerClient` and `EthosAuth`/`EthosClient`. `allowInsecureHttp: true` exists for
  loopback tests only.
- **Error messages no longer include response body text.** `BannerError.message` is the status
  line plus any Ethos error codes; the raw body is still in `responseBody`.
- **`DEBUG=1`, `DEBUG=true` and `DEBUG=*` no longer enable debug logging**; only a `DEBUG` value
  naming `ellucian-banner` does.
- **Resource names and IDs are validated.** Ethos resource names must match
  `[A-Za-z0-9][A-Za-z0-9_-]*`; IDs must not be `.`, `..` (also percent-encoded) or contain `/` or
  `\`. Request paths must start with a single `/` and contain no dot segments.
- `RegistrationStatus.registrationStatus` is typed as `"registered" | "notRegistered"`.
- `AuthProvider` now receives the caller's `AbortSignal`.

### Added

- `EthosResource.filter`, `filterAll`, `namedQuery`, `namedQueryAll`, `qapiSearch` and
  `qapiSearchAll`, which send the accessor's pinned version.
- `EthosClient.namedQueryAll`, and a `{ wrap }` option on `namedQuery` for named queries whose
  JSON keys differ from the query name.
- `gradeDefinitions`, `studentFinancialAidAwards` and `restrictedStudentFinancialAidAwards`
  accessors (`grades` and `financialAidAwards` remain as deprecated aliases).
- `PollOptions.onProcessed(lastProcessedID)` checkpoint hook for change notifications.
- `EthosAuth` options `timeout` and `retry`; `getToken(signal)` / `refresh(signal)`.
- `SectionRegistration.statusDate` and `RegistrationStatus.detail`.
- `ParsedSpec.warnings` (printed by the codegen CLI) and `pickJsonMediaType()`.
- `npm run typecheck` also type-checks `test/` through `tsconfig.test.json`.

### Fixed

- **A restarted notification consumer could lose a batch.** The README promised re-delivery,
  but a first `/consume` without `lastProcessedID` makes Ethos treat the previous batch as
  processed. The docs now say so, and `onProcessed` lets callers persist the position to resume
  from.
- **Aborting `poll()` during an in-flight `/consume` threw `AbortError`.** It now ends the loop.
- **Timeouts and AbortSignals did not cover the response body.** A server that sent headers and
  then stalled the body hung forever. The body is now read inside the timed, abortable section.
- **`POST /auth` had no timeout, abort or retry**, so a hung `/auth` blocked every request. Each
  attempt now has the client `timeout`, 429/5xx/network errors are retried, a caller's signal
  stops that caller waiting, and failures reject with `TimeoutError` or `AuthError`.
- **Path traversal.** `ethos.get("..", "consume")` reached `/consume` (draining the notification
  queue), and a Banner path such as `.evil.example/x` with an empty base path sent Basic
  credentials to another host. Both are now rejected before a request is built.
- **Non-JSON list, GraphQL and notification bodies threw a raw `SyntaxError`** whose message
  quoted the body. They now throw `BannerError` with a generic message.
- **Debug logs wrote identifiers embedded in paths** (Banner IDs, GUIDs) to stderr. Path segments
  that look like identifiers are now masked as `[id]`.
- **Codegen:**
  - Path-item-level and `$ref` parameters were ignored, so generated methods requested literal
    `{id}` URLs. They are now merged and resolved, and an unmatched placeholder produces a
    required string parameter plus a warning.
  - Bodies with vendor media types (`application/vnd.hedtech.integration.v1+json`, `*/*`) were
    dropped. The first JSON-like media type is now used, and a body without a usable schema
    becomes `body: unknown`.
  - Item types of array request bodies were not imported, so the output did not compile.
  - Method names could collide with `BannerApiClient` members (`get`, `delete`, `getRaw`, ...)
    or with each other. They now get an `Op` suffix.
  - Spec paths were spliced into generated code unescaped (code injection). Paths are now emitted
    as JSON string literals, and paths with characters outside RFC 3986 are rejected.
- Docs: GraphQL example uses `persons12`; `RegistrationStatus` documents
  registered/notRegistered and where dropped/withdrawn live; the academic-period `code` example
  is a Banner STVTERM code; README adds a "registered for a term" recipe.

## [0.2.0] - 2026-10-27

### Fixed

- **Named queries used the wrong query parameter.** `namedQuery()` / `buildNamedQueryParam()`
  sent `?namedQuery={...}`. Ethos expects the query name as the parameter
  (`?keywordSearch={"keywordSearch":"math"}`). A value already shaped as
  `{ [queryName]: ... }` is no longer double-wrapped. Use `{ wrap: false }` for queries whose
  JSON keys differ from the query name.
- **Notification polling never acknowledged messages.** `notifications.poll()` resent the same
  `lastProcessedID` on every poll. It now advances to the highest ID it has yielded.
- **Ethos requests were never retried.** `EthosClient` did not pass `retry` to its HTTP client.
  Retries are now on by default (`retry: false` turns them off).
- **Token lifetime was hardcoded to 300 seconds.** `EthosAuth` now reads the JWT `exp` claim
  (using `exp - iat` when both are present, to ignore clock skew). It falls back to 300 seconds
  only when the token can't be decoded.
- **Concurrent requests could each fetch a token.** Concurrent `getToken()` / `refresh()` calls
  now share one in-flight `/auth` request.
- **Pagination stopped early or looped.** If `x-total-count` was missing, iteration stopped after
  the first page. If the server reported more rows than it returned, iteration looped forever on
  empty pages. A full page (counting `x-max-page-size`) now means more rows may exist, and an
  empty page always ends iteration.
- **The timeout covered the whole retry sequence.** One `AbortController` spanned every retry
  attempt and every `Retry-After` wait, so later attempts could be aborted early. Each attempt
  now has its own timeout. The listener on the caller's `AbortSignal` is now removed after the
  request finishes.
- **HTTP-date `Retry-After` values were ignored.** `Retry-After` is now parsed in both
  delay-seconds and HTTP-date form, by `withRetry` and by `RateLimitError.retryAfter`.
- **IDs and resource names were not URL-encoded.** They are now encoded in Ethos paths.
- **`204 No Content` threw a `SyntaxError`.** Empty and `204` responses now resolve to
  `undefined` in `EthosClient` and `BannerApiClient`.
- **A lowercase `content-type` header produced a duplicate `Content-Type`.**
- **Codegen bugs:**
  - Query parameters were declared but never sent.
  - Path parameters were not encoded, and hyphenated names produced invalid TypeScript.
  - `POST`/`PUT` operations without a body passed `options` as the body.
  - `PATCH` operations called a method that didn't exist.
  - Spec text could close the JSDoc comment early.

### Added

- 401 handling: the token is invalidated and the call is retried once
  (`HttpClientConfig.onUnauthorized`).
- `EthosAuth` and `EthosClient` take `expirationMinutes` (1 to 120), which sets
  `/auth?expirationMinutes=`.
- `EthosAuth.invalidate()`, `EthosClient.invalidateToken()` and `decodeJwtTimeClaims()`.
- EEDM versions can be semantic-version strings (`"12.1.0"`) or full media types.
  `eedmMediaType()` and `eedmHeaders()` are exported.
- `EthosClient.filterAll()`.
- `PaginatedResponse.maxPageSize`, read from `x-max-page-size`.
- `notifications.consumeBatch()` returns the `x-remaining` queue depth. `poll()` accepts an
  `AbortSignal` and polls again without waiting while there is a backlog. `consume()` accepts
  `RequestOptions` and checks that `limit` is between 1 and 1000.
- `TimeoutError`, `parseRetryAfter()` and `readJson()`.
- `HttpClient.patch()` and `BannerApiClient.patch()`.
- `BannerClient.use(GeneratedClient)` binds codegen output to the client's connection. The
  spec's `basePath` is stored as a static property on the generated class.
- README.

### Changed

- **Node.js 20 or later is required** (eslint 10 and vitest 4 need it). The CI matrix is now
  20.x and 22.x.
- `5xx` and network errors are retried only for idempotent requests: GET, PUT, DELETE, QAPI and
  GraphQL. `429` is retried for every method. A `Retry-After` longer than `maxDelay` is thrown
  as an error instead of waited out.
- `DEBUG` turns on logging only for `1`, `true`, `*`, or a value containing `ellucian-banner`.
  Previously any non-empty value did. Debug logs now redact query strings.
- `EthosAuth` no longer includes the `/auth` response body in errors, and trims the returned
  token.
- `parsePaginatedResponse()` takes an optional `limit`, and throws if the body is not a JSON
  array.

### Packaging

- Added a `prepare` script, so `npm install github:chatt-state/ellucian-banner#<ref>` builds
  `dist/`.
- Added a `./package.json` subpath export, `sideEffects: false`, and `README.md` in `files`.
- CI packs the tarball and checks that both ESM `import` and CJS `require` work.
- Line endings are LF through `.gitattributes`. On Windows, `autocrlf` checkouts had made
  `prettier --check` fail.
- Removed leftover Taskmaster scaffolding (`.taskmaster/`, `scripts/prd.txt`) and the
  unrelated LLM API-key `.env.example`.

## [0.1.0] - 2026-03-13

### Added

- Ethos Integration client with typed CRUD operations and EEDM versioned headers
- 19 typed resource accessors (persons, students, courses, sections, academic-periods, grades, section-registrations, instructional-events, student-academic-credentials, financial-aid, finance, HR)
- Change notification consumer with single poll and async generator polling
- GraphQL client for Ethos GraphQL endpoint
- QAPI (POST-based search) client with pagination
- Criteria filtering and named query support
- Native Banner REST client (StudentApi, BannerAdminBPAPI) with Basic Auth
- OpenAPI/Swagger codegen CLI for generating typed clients from specs
- Ethos JWT authentication with auto-refresh and env var fallback
- Banner Basic Auth with env var fallback and validation
- HTTP client with auth injection, configurable timeouts, and debug logging
- Retry logic with exponential backoff for 429/5xx responses
- Typed error hierarchy (BannerError, AuthError, NotFoundError, RateLimitError, ValidationError, ServerError)
- Reusable pagination utilities with async generators
- EEDM type definitions for all major domains
- ESM + CJS dual output
- GitHub Actions CI
