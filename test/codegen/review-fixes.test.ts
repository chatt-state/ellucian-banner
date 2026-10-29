import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { describe, it, expect, afterAll } from "vitest";
import { parseSpec, pickJsonMediaType } from "../../src/codegen/parser.js";
import { generateClient } from "../../src/codegen/generator.js";

const repoRoot = resolve(__dirname, "../..");
const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** Type-check generated files against this repo's sources. Returns diagnostics text. */
function compileGenerated(files: { types: string; client: string }): string[] {
  const dir = mkdtempSync(join(tmpdir(), "eb-codegen-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "types.ts"), files.types);
  writeFileSync(join(dir, "client.ts"), files.client);
  const program = ts.createProgram([join(dir, "client.ts"), join(dir, "types.ts")], {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    noUnusedLocals: false,
    types: ["node"],
    typeRoots: [join(repoRoot, "node_modules", "@types")],
    paths: { "ellucian-banner": [join(repoRoot, "src", "index.ts")] },
  });
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

describe("path-item and $ref parameters", () => {
  const swagger = {
    swagger: "2.0",
    info: { title: "S" },
    parameters: { id: { in: "path", name: "id", required: true, type: "string" } },
    paths: {
      "/students/{id}": {
        parameters: [{ $ref: "#/parameters/id" }],
        get: { operationId: "getStudent", responses: { "200": { schema: { type: "object" } } } },
      },
      "/terms/{code}": {
        parameters: [{ in: "path", name: "code", required: true, type: "string" }],
        get: {
          operationId: "getTerm",
          // op-level wins over the path-level definition of the same param
          parameters: [{ in: "path", name: "code", required: true, type: "integer" }],
        },
      },
    },
  };

  it("resolves $ref parameters and merges path-level parameters", () => {
    const parsed = parseSpec(swagger);
    const student = parsed.endpoints.find((e) => e.operationId === "getStudent")!;
    expect(student.parameters).toEqual([
      { name: "id", in: "path", required: true, type: "string" },
    ]);
    const term = parsed.endpoints.find((e) => e.operationId === "getTerm")!;
    expect(term.parameters).toEqual([{ name: "code", in: "path", required: true, type: "number" }]);
    expect(parsed.warnings).toEqual([]);
  });

  it("generates URLs that substitute the parameters", () => {
    const out = generateClient(parseSpec(swagger), "S").client;
    expect(out).toContain('"/students/" + encodeURIComponent(String(id))');
    expect(out).not.toContain('"/students/{id}"');
  });

  it("resolves OpenAPI 3 components.parameters", () => {
    const parsed = parseSpec({
      openapi: "3.0.0",
      info: { title: "O" },
      components: {
        parameters: { id: { in: "path", name: "id", required: true, schema: { type: "string" } } },
      },
      paths: { "/x/{id}": { get: { parameters: [{ $ref: "#/components/parameters/id" }] } } },
    });
    expect(parsed.endpoints[0]!.parameters).toEqual([
      { name: "id", in: "path", required: true, type: "string" },
    ]);
  });

  it("synthesizes and warns about a placeholder with no parameter", () => {
    const parsed = parseSpec({
      openapi: "3.0.0",
      info: { title: "O" },
      paths: { "/x/{orphan}": { get: {} } },
    });
    expect(parsed.endpoints[0]!.parameters).toEqual([
      { name: "orphan", in: "path", required: true, type: "string" },
    ]);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings![0]).toContain("{orphan}");
    expect(generateClient(parsed, "O").client).toContain(
      '"/x/" + encodeURIComponent(String(orphan))',
    );
  });
});

describe("JSON-like media types", () => {
  it("picks application/json, then +json, then */*", () => {
    expect(pickJsonMediaType({ "text/plain": 1, "application/json": 2 })).toBe(2);
    expect(
      pickJsonMediaType({ "text/plain": 1, "application/vnd.hedtech.integration.v1+json": 3 }),
    ).toBe(3);
    expect(pickJsonMediaType({ "*/*": 4 })).toBe(4);
    expect(pickJsonMediaType({ "text/plain": 1 })).toBeUndefined();
  });

  const spec = {
    openapi: "3.0.0",
    info: { title: "V" },
    components: {
      schemas: { Student: { type: "object", properties: { id: { type: "string" } } } },
    },
    paths: {
      "/students": {
        put: {
          operationId: "putVendor",
          requestBody: {
            content: {
              "application/vnd.hedtech.integration.v1+json": {
                schema: { $ref: "#/components/schemas/Student" },
              },
            },
          },
          responses: {
            "200": {
              content: { "*/*": { schema: { $ref: "#/components/schemas/Student" } } },
            },
          },
        },
        post: {
          operationId: "postNoSchema",
          requestBody: { content: { "application/xml": {} } },
        },
      },
    },
  };

  it("keeps vendor-typed request and response bodies", () => {
    const out = generateClient(parseSpec(spec), "V").client;
    expect(out).toContain(
      "async putVendor(body: Student, options?: RequestOptions): Promise<Student>",
    );
    expect(out).toContain('this.put<Student>("/students", body, options)');
  });

  it("generates body: unknown when a request body has no usable schema", () => {
    const out = generateClient(parseSpec(spec), "V").client;
    expect(out).toContain("async postNoSchema(body: unknown");
    expect(out).toContain('this.post<unknown>("/students", body, options)');
  });
});

describe("generated clients compile", () => {
  const spec = {
    swagger: "2.0",
    info: { title: "Bulk" },
    basePath: "/",
    definitions: {
      Student: { type: "object", properties: { id: { type: "string" } } },
      Term: { type: "object", properties: { code: { type: "string" } } },
    },
    paths: {
      "/": { get: { responses: { "200": { schema: { type: "object" } } } } },
      "/students/bulk": {
        post: {
          operationId: "bulkCreate",
          parameters: [
            {
              in: "body",
              name: "body",
              schema: { type: "array", items: { $ref: "#/definitions/Student" } },
            },
          ],
        },
      },
      "/terms": {
        put: {
          operationId: "nested",
          parameters: [
            {
              in: "body",
              name: "body",
              schema: {
                type: "array",
                items: { type: "array", items: { $ref: "#/definitions/Term" } },
              },
            },
          ],
        },
      },
      "/a": { delete: { operationId: "delete" } },
      "/b": { delete: { operationId: "delete" } },
      "/c": { get: { operationId: "getRaw" } },
      "/d": { get: { operationId: "withQuery" } },
    },
  };
  const files = generateClient(parseSpec(spec), "Bulk");

  it("imports item types of array (and nested array) request bodies", () => {
    expect(files.client).toContain('import type { Student, Term } from "./types.js";');
    expect(files.client).toContain("bulkCreate(body: Student[]");
    expect(files.client).toContain("nested(body: Term[][]");
  });

  it("renames methods that would collide with BannerApiClient members or each other", () => {
    expect(files.client).toContain("async getOp(options?: RequestOptions)");
    expect(files.client).toContain('return this.get<Record<string, unknown>>("/", options);');
    expect(files.client).toContain("async deleteOp(");
    expect(files.client).toContain("async deleteOp2(");
    expect(files.client).toContain("async getRawOp(");
    expect(files.client).toContain("async withQueryOp(");
    expect(files.client).not.toMatch(/async (get|delete|getRaw|withQuery)\(/);
  });

  it("type-checks with tsc", () => {
    expect(compileGenerated(files)).toEqual([]);
  }, 60_000);
});

describe("spec paths cannot inject code", () => {
  const specWith = (path: string) => ({
    swagger: "2.0",
    info: { title: "Evil" },
    paths: { [path]: { get: { operationId: "evil" } } },
  });

  it.each([
    ['/x"+require("child_process").execSync("calc")+"'],
    ["/x`+process.exit()+`"],
    ["/x\\u0022"],
    ["/x y"],
  ])("rejects %s", (path) => {
    expect(() => generateClient(parseSpec(specWith(path)), "Evil")).toThrow(/Unsafe characters/);
  });

  it("treats ${...} as an ordinary placeholder, never as template-literal code", () => {
    const files = generateClient(parseSpec(specWith("/x/${process.exit()}")), "Evil");
    expect(files.client).not.toContain("`");
    expect(files.client).toContain('"/x/$" + encodeURIComponent(String(processExit))');
  });

  it("yields a safe literal for a spec path with backtick / ${ / backslash (SEC-1)", () => {
    // Backtick and backslash can close or escape a string literal -> rejected.
    for (const p of ["/x/`+a+`", "/x/a\\b"]) {
      expect(() => generateClient(parseSpec(specWith(p)), "Evil")).toThrow(/Unsafe characters/);
    }
    // A surviving "${...}" is emitted as an ordinary quoted literal, not code.
    const { client } = generateClient(parseSpec(specWith("/x/${global.process.exit()}")), "Evil");
    expect(client).not.toContain("`");
    expect(client).not.toContain("${");
    expect(client).toContain("encodeURIComponent(");
  });

  it("emits static path text only as JSON string literals", () => {
    const parsed = parseSpec({
      swagger: "2.0",
      info: { title: "Ok" },
      paths: {
        "/odd/$x/{id}": {
          get: {
            operationId: "odd",
            parameters: [{ in: "path", name: "id", required: true, type: "string" }],
          },
        },
      },
    });
    const files = generateClient(parsed, "Ok");
    expect(files.client).toContain('"/odd/$x/" + encodeURIComponent(String(id))');
    expect(files.client).not.toContain("`");
    expect(compileGenerated(files)).toEqual([]);
  }, 60_000);
});
