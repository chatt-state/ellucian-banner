# ellucian-banner

Node.js/TypeScript SDK for **Ellucian Ethos Integration** (EEDM proxy, QAPI, GraphQL, change
notifications) and **Banner native REST APIs** (StudentApi, BannerAdminBPAPI), plus a codegen
CLI that turns Banner OpenAPI/Swagger specs into typed clients.

- Zero runtime dependencies (uses native `fetch`)
- ESM and CommonJS builds with full type declarations
- Ethos JWT handling: reads the token's `exp`, refreshes before expiry, shares one refresh
  across concurrent callers, and re-authenticates once on `401`
- Retries `429`/`5xx` with exponential backoff and `Retry-After` support, without replaying
  non-idempotent writes
- Typed error classes

> **Data handling:** Ethos and Banner responses contain FERPA-protected student and employee
> data. This library never logs response bodies, and debug logging redacts query strings
> (criteria filters often contain names, IDs, or birth dates). Keep API keys and Banner
> credentials in environment variables or a secret store, never in source.

## Requirements

Node.js **20 or later**.

## Install

The package is not published to npm. Install it from GitHub as a git dependency, pinned to a
tag or commit:

```bash
npm install github:chatt-state/ellucian-banner#v0.2.0
# or a specific commit
npm install github:chatt-state/ellucian-banner#<commit-sha>
```

which adds this to your `package.json`:

```json
"dependencies": {
  "ellucian-banner": "github:chatt-state/ellucian-banner#v0.2.0"
}
```

npm runs the package's `prepare` script on install, which builds `dist/` with tsup. That
needs the package's devDependencies, which npm installs automatically for git dependencies.
Pin to a tag or SHA rather than a branch so installs are reproducible.

For local development against a checkout:

```bash
npm install ../ellucian-banner   # builds through `prepare`
```

## Quick start: Ethos

```ts
import { EthosClient } from "ellucian-banner";

const ethos = new EthosClient({ apiKey: process.env.ETHOS_API_KEY });

// Typed accessors, pinned to an EEDM version
const person = await ethos.persons.get("c2f2ba8a-...");
const page = await ethos.students.getPage(0, 50); // { data, totalCount, offset, hasMore, maxPageSize? }

// Iterate every page (advances by rows returned, so server page caps are handled)
for await (const batch of ethos.sections.getAll(100)) {
  for (const section of batch) console.log(section.id);
}

// Any resource, any version (major number, "12.1.0", or a full media type)
const sites = ethos.resource("sites", "6.0.0");
await sites.getPage();

// Generic CRUD
await ethos.get("persons", id, 12);
await ethos.create("persons", body, 12);
await ethos.update("persons", id, body, "12.1.0");
await ethos.delete("persons", id);
```

CommonJS works too:

```js
const { EthosClient } = require("ellucian-banner");
```

### Configuration

| Option              | Default                               | Notes                                                                                      |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `apiKey`            | `process.env.ETHOS_API_KEY`           | Ethos application API key                                                                  |
| `baseUrl`           | `https://integrate.elluciancloud.com` | Use the regional host if your tenant is not in the US                                      |
| `timeout`           | `30000`                               | Per-attempt timeout in ms; raises `TimeoutError`                                           |
| `retry`             | `true`                                | `false` to disable, or `{ maxRetries, baseDelay, maxDelay }`                               |
| `refreshBuffer`     | `30`                                  | Seconds before token expiry to refresh                                                     |
| `expirationMinutes` | Ethos default (5)                     | Request a longer-lived token (1 to 120), sent as `/auth?expirationMinutes=`                |
| `debug`             | `false`                               | Logs method, path and status to stderr. `DEBUG=ellucian-banner` also enables it            |

## Authentication

`EthosClient` exchanges the API key for a JWT at `POST {baseUrl}/auth`. The token's lifetime
comes from its `exp` claim. When `iat` is also present the lifetime is `exp - iat`, so local
clock skew doesn't matter. If the token can't be decoded the lifetime falls back to 300 seconds.
The token is refreshed `refreshBuffer` seconds before it expires. If the token is very short-lived,
the client refreshes it halfway through its lifetime instead.

- Concurrent requests share one in-flight `/auth` call.
- If an API call returns `401`, the client discards that token, gets a new one, and retries the
  call once. A second `401` is thrown as `AuthError`. `403` is never retried.
- `ethos.invalidateToken()` forces the next request to re-authenticate.

You can use `EthosAuth` directly, for example to share a token with other tooling:

```ts
import { EthosAuth } from "ellucian-banner";

const auth = new EthosAuth({ apiKey: process.env.ETHOS_API_KEY, expirationMinutes: 60 });
const jwt = await auth.getToken();
```

`BannerClient` uses HTTP Basic auth (`BANNER_BASE_URL`, `BANNER_USERNAME`, `BANNER_PASSWORD`).

## Filtering

### Criteria filters

Ethos expects `?criteria=<url-encoded JSON>`. Pass a plain object and the client encodes it:

```ts
// GET /api/persons?criteria=%7B%22names%22%3A%5B%7B%22lastName%22%3A%22Smith%22%7D%5D%7D&offset=0&limit=25
const smiths = await ethos.filter("persons", { names: [{ lastName: "Smith" }] }, 0, 25, 12);

// All pages
for await (const batch of ethos.filterAll("sections", { academicPeriod: { id: termGuid } }, 100)) {
  // ...
}
```

### Named queries

A named query uses **the query name itself as the parameter**: `?{queryName}=<url-encoded JSON>`.
There is no `namedQuery=` parameter.

```ts
// GET /api/sections?keywordSearch={"keywordSearch":"biology"}
await ethos.namedQuery("sections", "keywordSearch", "biology");

// GET /api/persons?personFilter={"personFilter":{"id":"<guid>"}}
await ethos.namedQuery("persons", "personFilter", { id: personFilterGuid });
// An already-wrapped value is sent as-is (not double-wrapped):
await ethos.namedQuery("persons", "personFilter", { personFilter: { id: personFilterGuid } });
```

If a named query's JSON keys don't match its name, build the parameter yourself:

```ts
import { buildNamedQueryParam } from "ellucian-banner";

buildNamedQueryParam(
  "registrationStatusesByAcademicPeriod",
  { statuses: ["registered"], academicPeriod: { id: termGuid } },
  { wrap: false },
);
```

### QAPI (POST search)

```ts
// POST /qapi/persons?offset=0&limit=25 with a partial resource as the body
const page = await ethos.qapi.search("persons", { names: [{ lastName: "Smith" }] }, 0, 25, 12);
for await (const batch of ethos.qapi.searchAll("persons", criteria, 100, 12)) {
  // ...
}
```

### GraphQL

```ts
const { data, errors } = await ethos.graphql.query({
  query: `query ($id: ID!) { persons12(filter: { id: { EQ: $id } }) { edges { node { id } } } }`,
  variables: { id },
});
```

GraphQL errors arrive in `errors`, alongside `data`, with HTTP status 200. Check them yourself.

## Change notifications

```ts
// One batch
const { notifications, remaining } = await ethos.notifications.consumeBatch({ limit: 100 });

// Continuous: asking for the next batch acknowledges the previous one
const controller = new AbortController();
for await (const batch of ethos.notifications.poll({
  limit: 100,
  interval: 5000,
  signal: controller.signal,
})) {
  for (const n of batch) await handle(n); // throw to stop without acknowledging this batch
}
```

`poll()` sends the highest notification ID it has yielded as `lastProcessedID`. A message is
re-delivered only if your loop stops before it requests the next batch. While `x-remaining`
shows a backlog, it polls again without waiting. `limit` must be between 1 and 1000.

## Banner native REST APIs

```ts
import { BannerClient } from "ellucian-banner";

const banner = new BannerClient({
  baseUrl: process.env.BANNER_BASE_URL,
  username: process.env.BANNER_USERNAME,
  password: process.env.BANNER_PASSWORD,
  retry: true,
});

const terms = await banner.studentApi.get<Term[]>("/terms");
await banner.adminBpapi.put("/some/resource/1", body);
const custom = banner.api("/MyCustomApi/api");
```

A `204 No Content` (or empty) response resolves to `undefined`.

## Error handling

Every error the SDK throws for a failed request extends `BannerError`, which has `statusCode`
and `responseBody`:

| Class             | When                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `ValidationError` | 400                                                                                                |
| `AuthError`       | 401 or 403, failed token exchange, missing API key                                                 |
| `NotFoundError`   | 404                                                                                                |
| `RateLimitError`  | 429 after retries; `retryAfter` is in seconds (from delay-seconds or an HTTP-date `Retry-After`)   |
| `ServerError`     | 5xx after retries                                                                                  |
| `TimeoutError`    | No response within `timeout` ms                                                                    |
| `BannerError`     | Other non-2xx statuses, or an unparseable JSON body                                                |

```ts
import { NotFoundError, RateLimitError } from "ellucian-banner";

try {
  await ethos.persons.get(id);
} catch (err) {
  if (err instanceof NotFoundError) return null;
  if (err instanceof RateLimitError) console.warn(`retry in ${err.retryAfter}s`);
  throw err;
}
```

`responseBody` can contain student data. Don't send it to logs or telemetry without
redacting it first.

### Retries

The client retries `429` for every method. It retries `5xx` and network errors only for
idempotent requests: `GET`, `PUT`, `DELETE`, QAPI and GraphQL. A failed `POST` create is never
replayed, because that could create a duplicate record. If `Retry-After` asks for a longer wait
than `maxDelay`, the client throws `RateLimitError` instead of waiting.

## Codegen CLI

Generate a typed client from a Banner OpenAPI 3 or Swagger 2 JSON spec:

```bash
npx ellucian-banner-codegen --spec ./specs/StudentApi.json --output ./src/generated [--api-name StudentApi]
```

This writes `types.ts` (interfaces) and `client.ts` (a `BannerApiClient` subclass). In the
generated client, path parameters are URL-encoded, query parameters become a typed `query`
argument, and the spec's `basePath` is stored as a static property. To use it:

```ts
import { BannerClient } from "ellucian-banner";
import { StudentApiClient } from "./generated/client.js";

const banner = new BannerClient();
const studentApi = banner.use(StudentApiClient); // or banner.use(StudentApiClient, "/StudentApi/api")
```

The same functions are available programmatically as `parseSpec()` and `generateClient()`.

## Development

```bash
npm ci            # installs and builds (prepare)
npm run lint      # eslint + prettier --check
npm run typecheck
npm run build
npm test          # vitest; all HTTP is mocked, so no credentials are needed
```

Tests mock `fetch` and never contact Ethos or Banner.

## License

MIT
