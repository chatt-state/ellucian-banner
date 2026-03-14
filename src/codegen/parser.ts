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

  const endpoints = parseEndpoints(spec["paths"] ?? {}, isSwagger2, schemas);

  return { title, basePath, endpoints, schemas };
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

function parseEndpoints(
  paths: SpecJson,
  isSwagger2: boolean,
  schemas: Map<string, ParsedSchema>,
): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as SpecJson)[method] as SpecJson | undefined;
      if (!op) continue;

      const parameters = parseParameters(op, isSwagger2);
      const requestBody = isSwagger2
        ? extractSwagger2Body(op)
        : extractOpenApi3Body(op, schemas);
      const responseSchema = extractResponseSchema(op, isSwagger2, schemas);

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

function parseParameters(op: SpecJson, isSwagger2: boolean): ParsedParameter[] {
  const raw = (op["parameters"] as SpecJson[]) ?? [];
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
      type: mapType(
        (p["schema"]?.["type"] as string) ?? (p["type"] as string) ?? "string",
      ),
    });
  }

  return params;
}

function extractSwagger2Body(op: SpecJson): ParsedSchema | undefined {
  const params = (op["parameters"] as SpecJson[]) ?? [];
  const bodyParam = params.find((p) => p["in"] === "body");
  if (!bodyParam?.["schema"]) return undefined;
  return parseSchemaDef(bodyParam["schema"] as SpecJson);
}

function extractOpenApi3Body(
  op: SpecJson,
  _schemas: Map<string, ParsedSchema>,
): ParsedSchema | undefined {
  const content = op["requestBody"]?.["content"];
  if (!content) return undefined;
  const json = content["application/json"];
  if (!json?.["schema"]) return undefined;
  return parseSchemaDef(json["schema"] as SpecJson);
}

function extractResponseSchema(
  op: SpecJson,
  isSwagger2: boolean,
  _schemas: Map<string, ParsedSchema>,
): ParsedSchema | undefined {
  const responses = op["responses"] as SpecJson | undefined;
  if (!responses) return undefined;

  // Look for 200 or 201 response
  const successResponse = (responses["200"] ?? responses["201"]) as SpecJson | undefined;
  if (!successResponse) return undefined;

  if (isSwagger2) {
    if (!successResponse["schema"]) return undefined;
    return parseSchemaDef(successResponse["schema"] as SpecJson);
  }

  // OpenAPI 3.x
  const content = successResponse["content"]?.["application/json"];
  if (!content?.["schema"]) return undefined;
  return parseSchemaDef(content["schema"] as SpecJson);
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
