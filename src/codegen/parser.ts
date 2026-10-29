/**
 * OpenAPI/Swagger spec parser.
 *
 * Parses OpenAPI 2.0 (Swagger) and 3.0 specs into a normalized
 * intermediate representation used by the code generator.
 */

// ── Intermediate representation types ──

export interface ParsedSpec {
  title: string;
  basePath: string;
  endpoints: ParsedEndpoint[];
  schemas: Map<string, ParsedSchema>;
  /**
   * Problems found while parsing that did not stop generation, e.g. a path
   * placeholder with no matching path parameter (one is synthesized as a
   * required string). The CLI prints these to stderr.
   */
  warnings?: string[];
}

export interface ParsedEndpoint {
  method: "get" | "post" | "put" | "delete" | "patch";
  path: string;
  operationId?: string;
  summary?: string;
  parameters: ParsedParameter[];
  requestBody?: ParsedSchema;
  responseSchema?: ParsedSchema;
  tags: string[];
}

export interface ParsedParameter {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  type: string;
}

export interface ParsedSchema {
  name?: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "unknown";
  properties?: Map<string, ParsedSchemaProperty>;
  items?: ParsedSchema;
  ref?: string;
}

export interface ParsedSchemaProperty {
  type: string;
  required: boolean;
  description?: string;
  ref?: string;
  items?: ParsedSchema;
}

// ── Internal spec shape types (loose, for JSON parsing) ──

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpecJson = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

const HTTP_METHODS = ["get", "post", "put", "delete", "patch"] as const;

// ── Public API ──

/**
 * Parse an OpenAPI/Swagger JSON spec into a {@link ParsedSpec}.
 *
 * Supports both Swagger 2.0 and OpenAPI 3.x specs.
 */
export function parseSpec(spec: SpecJson): ParsedSpec {
  const isSwagger2 = typeof spec["swagger"] === "string" && spec["swagger"].startsWith("2");

  const title = spec["info"]?.["title"] ?? "UnnamedApi";
  const basePath = isSwagger2 ? (spec["basePath"] ?? "/") : extractBasePathFromServers(spec);

  const schemas = isSwagger2
    ? parseSchemas(spec["definitions"] ?? {})
    : parseSchemas(spec["components"]?.["schemas"] ?? {});

  const sharedParameters: SpecJson = isSwagger2
    ? (spec["parameters"] ?? {})
    : (spec["components"]?.["parameters"] ?? {});
  const sharedRequestBodies: SpecJson = isSwagger2
    ? {}
    : (spec["components"]?.["requestBodies"] ?? {});
  const sharedResponses: SpecJson = isSwagger2
    ? (spec["responses"] ?? {})
    : (spec["components"]?.["responses"] ?? {});

  const warnings: string[] = [];
  const endpoints = parseEndpoints(spec["paths"] ?? {}, isSwagger2, {
    parameters: sharedParameters,
    requestBodies: sharedRequestBodies,
    responses: sharedResponses,
    warnings,
  });

  return { title, basePath, endpoints, schemas, warnings };
}

// ── Helpers ──

function extractBasePathFromServers(spec: SpecJson): string {
  const servers = spec["servers"] as SpecJson[] | undefined;
  if (!servers || servers.length === 0) return "/";
  const url = servers[0]?.["url"] as string | undefined;
  if (!url) return "/";
  // If the URL is absolute, extract just the path portion
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    // Relative URL — use as-is
    return url.replace(/\/+$/, "") || "/";
  }
}

function parseSchemas(definitions: SpecJson): Map<string, ParsedSchema> {
  const schemas = new Map<string, ParsedSchema>();
  for (const [name, def] of Object.entries(definitions)) {
    schemas.set(name, parseSchemaDef(def as SpecJson, name));
  }
  return schemas;
}

function parseSchemaDef(def: SpecJson, name?: string): ParsedSchema {
  if (def["$ref"]) {
    const refName = extractRefName(def["$ref"] as string);
    return { name, type: "object", ref: refName };
  }

  const rawType = (def["type"] as string) ?? "object";
  const type = mapType(rawType);

  const schema: ParsedSchema = { name, type };

  if (type === "array" && def["items"]) {
    schema.items = parseSchemaDef(def["items"] as SpecJson);
  }

  if (type === "object" || def["properties"]) {
    const requiredFields = new Set<string>((def["required"] as string[]) ?? []);
    const props = new Map<string, ParsedSchemaProperty>();
    for (const [propName, propDef] of Object.entries((def["properties"] ?? {}) as SpecJson)) {
      const p = propDef as SpecJson;
      const prop: ParsedSchemaProperty = {
        type: mapType((p["type"] as string) ?? "unknown"),
        required: requiredFields.has(propName),
        description: p["description"] as string | undefined,
      };
      if (p["$ref"]) {
        prop.ref = extractRefName(p["$ref"] as string);
        prop.type = "object";
      }
      if (p["type"] === "array" && p["items"]) {
        prop.items = parseSchemaDef(p["items"] as SpecJson);
      }
      props.set(propName, prop);
    }
    if (props.size > 0) {
      schema.properties = props;
    }
  }

  return schema;
}

/** Reusable spec components that `$ref`s may point into. */
interface SpecComponents {
  parameters: SpecJson;
  requestBodies: SpecJson;
  responses: SpecJson;
  warnings: string[];
}

function parseEndpoints(
  paths: SpecJson,
  isSwagger2: boolean,
  components: SpecComponents,
): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as SpecJson)[method] as SpecJson | undefined;
      if (!op) continue;

      const rawParams = mergeParameters(pathItem as SpecJson, op, components);
      const parameters = parseParameters(rawParams, isSwagger2);
      addMissingPathParameters(method, path, parameters, components.warnings);
      const requestBody = isSwagger2
        ? extractSwagger2Body(rawParams)
        : extractOpenApi3Body(op, components);
      const responseSchema = extractResponseSchema(op, isSwagger2, components);

      endpoints.push({
        method,
        path,
        operationId: op["operationId"] as string | undefined,
        summary: (op["summary"] ?? op["description"]) as string | undefined,
        parameters,
        requestBody,
        responseSchema,
        tags: (op["tags"] as string[]) ?? [],
      });
    }
  }

  return endpoints;
}

/** Follow a local `$ref` ("#/parameters/id", "#/components/parameters/id") into `pool`. */
function resolveRef(value: SpecJson, pool: SpecJson): SpecJson | undefined {
  let current: SpecJson | undefined = value;
  // Bounded to avoid looping on a self-referencing spec.
  for (let depth = 0; current && typeof current["$ref"] === "string" && depth < 10; depth++) {
    current = pool[extractRefName(current["$ref"] as string)] as SpecJson | undefined;
  }
  return current;
}

/**
 * Path-item parameters merged with operation parameters (the operation wins
 * on the same name + location), with `$ref` parameters resolved.
 */
function mergeParameters(pathItem: SpecJson, op: SpecJson, components: SpecComponents): SpecJson[] {
  const merged = new Map<string, SpecJson>();
  const add = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list as SpecJson[]) {
      const p = resolveRef(raw, components.parameters);
      if (!p) {
        components.warnings.push(`Unresolvable parameter reference: ${String(raw?.["$ref"])}`);
        continue;
      }
      merged.set(`${String(p["in"])}:${String(p["name"])}`, p);
    }
  };
  add(pathItem["parameters"]);
  add(op["parameters"]);
  return [...merged.values()];
}

/**
 * Every `{name}` placeholder in the path needs a path parameter, or the
 * generated method would request the literal "{name}". Synthesize a required
 * string parameter for any that are missing and record a warning.
 */
function addMissingPathParameters(
  method: string,
  path: string,
  params: ParsedParameter[],
  warnings: string[],
): void {
  for (const match of path.matchAll(/\{([^{}]+)\}/g)) {
    const name = match[1] as string;
    if (params.some((p) => p.in === "path" && p.name === name)) continue;
    warnings.push(
      `${method.toUpperCase()} ${path}: placeholder {${name}} has no path parameter; generating a required string parameter`,
    );
    params.push({ name, in: "path", required: true, type: "string" });
  }
}

function parseParameters(raw: SpecJson[], isSwagger2: boolean): ParsedParameter[] {
  const params: ParsedParameter[] = [];

  for (const p of raw) {
    const location = p["in"] as string;
    // In Swagger 2.0, body params are handled separately
    if (isSwagger2 && location === "body") continue;
    if (!["path", "query", "header"].includes(location)) continue;

    params.push({
      name: p["name"] as string,
      in: location as "path" | "query" | "header",
      required: (p["required"] as boolean) ?? false,
      type: mapType((p["schema"]?.["type"] as string) ?? (p["type"] as string) ?? "string"),
    });
  }

  return params;
}

/** Schema used when a body exists but its schema is missing or not JSON. */
const UNKNOWN_SCHEMA: ParsedSchema = { type: "unknown" };

function extractSwagger2Body(params: SpecJson[]): ParsedSchema | undefined {
  const bodyParam = params.find((p) => p["in"] === "body");
  if (!bodyParam) return undefined;
  if (!bodyParam["schema"]) return { ...UNKNOWN_SCHEMA };
  return parseSchemaDef(bodyParam["schema"] as SpecJson);
}

/**
 * Pick the JSON-like media type from an OpenAPI 3 `content` map:
 * `application/json`, then any `+json` / `/json` type (e.g.
 * `application/vnd.hedtech.integration.v12+json`), then `*\/*`.
 */
export function pickJsonMediaType(content: SpecJson | undefined): SpecJson | undefined {
  if (!content || typeof content !== "object") return undefined;
  const keys = Object.keys(content);
  const base = (k: string) => k.split(";")[0]!.trim().toLowerCase();
  const key =
    keys.find((k) => base(k) === "application/json") ??
    keys.find((k) => base(k).endsWith("+json") || base(k).endsWith("/json")) ??
    keys.find((k) => base(k) === "*/*" || base(k) === "application/*");
  return key === undefined ? undefined : (content[key] as SpecJson);
}

function extractOpenApi3Body(op: SpecJson, components: SpecComponents): ParsedSchema | undefined {
  if (!op["requestBody"]) return undefined;
  const requestBody = resolveRef(op["requestBody"] as SpecJson, components.requestBodies);
  const media = pickJsonMediaType(requestBody?.["content"]);
  // A body exists: never drop it, even if its schema is unusable.
  if (!media?.["schema"]) return { ...UNKNOWN_SCHEMA };
  return parseSchemaDef(media["schema"] as SpecJson);
}

function extractResponseSchema(
  op: SpecJson,
  isSwagger2: boolean,
  components: SpecComponents,
): ParsedSchema | undefined {
  const responses = op["responses"] as SpecJson | undefined;
  if (!responses) return undefined;

  // Prefer 200, then 201, then any other 2xx.
  const successKey =
    ["200", "201"].find((k) => k in responses) ??
    Object.keys(responses)
      .filter((k) => /^2(\d\d|XX)$/i.test(k))
      .sort()[0];
  if (successKey === undefined) return undefined;
  const successResponse = resolveRef(responses[successKey] as SpecJson, components.responses);
  if (!successResponse) return undefined;

  if (isSwagger2) {
    if (!successResponse["schema"]) return undefined;
    return parseSchemaDef(successResponse["schema"] as SpecJson);
  }

  // OpenAPI 3.x
  const media = pickJsonMediaType(successResponse["content"]);
  if (!media?.["schema"]) return undefined;
  return parseSchemaDef(media["schema"] as SpecJson);
}

function extractRefName(ref: string): string {
  // "#/definitions/Foo" or "#/components/schemas/Foo" -> "Foo"
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? ref;
}

function mapType(raw: string): ParsedSchema["type"] {
  switch (raw) {
    case "string":
      return "string";
    case "integer":
    case "number":
    case "float":
    case "double":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}
