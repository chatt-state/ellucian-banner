import { describe, it, expect } from "vitest";
import { parseSpec } from "../../src/codegen/parser.js";

const SWAGGER_2_SPEC = {
  swagger: "2.0",
  info: { title: "StudentApi", version: "1.0" },
  basePath: "/StudentApi/api",
  definitions: {
    Student: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string", description: "Student identifier" },
        name: { type: "string" },
        gpa: { type: "number" },
        active: { type: "boolean" },
      },
    },
    Address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
      },
    },
  },
  paths: {
    "/students": {
      get: {
        operationId: "listStudents",
        summary: "List all students",
        tags: ["students"],
        parameters: [
          { name: "limit", in: "query", type: "integer", required: false },
        ],
        responses: {
          "200": {
            schema: { type: "array", items: { $ref: "#/definitions/Student" } },
          },
        },
      },
      post: {
        operationId: "createStudent",
        summary: "Create a student",
        tags: ["students"],
        parameters: [
          {
            name: "body",
            in: "body",
            required: true,
            schema: { $ref: "#/definitions/Student" },
          },
        ],
        responses: {
          "201": {
            schema: { $ref: "#/definitions/Student" },
          },
        },
      },
    },
    "/students/{id}": {
      get: {
        operationId: "getStudent",
        summary: "Get a student by ID",
        tags: ["students"],
        parameters: [
          { name: "id", in: "path", type: "string", required: true },
        ],
        responses: {
          "200": {
            schema: { $ref: "#/definitions/Student" },
          },
        },
      },
      delete: {
        operationId: "deleteStudent",
        tags: ["students"],
        parameters: [
          { name: "id", in: "path", type: "string", required: true },
        ],
        responses: {
          "204": { description: "Deleted" },
        },
      },
    },
  },
};

const OPENAPI_3_SPEC = {
  openapi: "3.0.3",
  info: { title: "Course API", version: "2.0" },
  servers: [{ url: "https://banner.example.edu/api/v2" }],
  components: {
    schemas: {
      Course: {
        type: "object",
        required: ["courseId"],
        properties: {
          courseId: { type: "string" },
          title: { type: "string", description: "Course title" },
          credits: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/courses": {
      get: {
        operationId: "listCourses",
        summary: "List courses",
        tags: ["courses"],
        parameters: [
          {
            name: "subject",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Course" },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createCourse",
        summary: "Create a course",
        tags: ["courses"],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Course" },
            },
          },
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Course" },
              },
            },
          },
        },
      },
    },
  },
};

describe("parseSpec", () => {
  describe("Swagger 2.0", () => {
    it("parses title and basePath", () => {
      const result = parseSpec(SWAGGER_2_SPEC);
      expect(result.title).toBe("StudentApi");
      expect(result.basePath).toBe("/StudentApi/api");
    });

    it("parses schema definitions", () => {
      const result = parseSpec(SWAGGER_2_SPEC);
      expect(result.schemas.size).toBe(2);

      const student = result.schemas.get("Student");
      expect(student).toBeDefined();
      expect(student!.type).toBe("object");
      expect(student!.properties?.size).toBe(4);
      expect(student!.properties?.get("id")?.required).toBe(true);
      expect(student!.properties?.get("gpa")?.type).toBe("number");
      expect(student!.properties?.get("active")?.type).toBe("boolean");
    });

    it("parses endpoints", () => {
      const result = parseSpec(SWAGGER_2_SPEC);
      expect(result.endpoints).toHaveLength(4);

      const listStudents = result.endpoints.find((e) => e.operationId === "listStudents");
      expect(listStudents).toBeDefined();
      expect(listStudents!.method).toBe("get");
      expect(listStudents!.path).toBe("/students");
      expect(listStudents!.summary).toBe("List all students");
      expect(listStudents!.parameters).toHaveLength(1);
      expect(listStudents!.parameters[0]?.name).toBe("limit");
    });

    it("parses body parameters as requestBody", () => {
      const result = parseSpec(SWAGGER_2_SPEC);
      const create = result.endpoints.find((e) => e.operationId === "createStudent");
      expect(create!.requestBody).toBeDefined();
      expect(create!.requestBody!.ref).toBe("Student");
    });

    it("parses response schemas", () => {
      const result = parseSpec(SWAGGER_2_SPEC);
      const list = result.endpoints.find((e) => e.operationId === "listStudents");
      expect(list!.responseSchema?.type).toBe("array");
      expect(list!.responseSchema?.items?.ref).toBe("Student");

      const getOne = result.endpoints.find((e) => e.operationId === "getStudent");
      expect(getOne!.responseSchema?.ref).toBe("Student");
    });

    it("excludes body params from parameters list", () => {
      const result = parseSpec(SWAGGER_2_SPEC);
      const create = result.endpoints.find((e) => e.operationId === "createStudent");
      expect(create!.parameters).toHaveLength(0);
    });
  });

  describe("OpenAPI 3.0", () => {
    it("parses title and basePath from servers", () => {
      const result = parseSpec(OPENAPI_3_SPEC);
      expect(result.title).toBe("Course API");
      expect(result.basePath).toBe("/api/v2");
    });

    it("parses component schemas", () => {
      const result = parseSpec(OPENAPI_3_SPEC);
      expect(result.schemas.size).toBe(1);
      const course = result.schemas.get("Course");
      expect(course).toBeDefined();
      expect(course!.properties?.get("courseId")?.required).toBe(true);
      expect(course!.properties?.get("credits")?.type).toBe("number");
    });

    it("parses requestBody from content", () => {
      const result = parseSpec(OPENAPI_3_SPEC);
      const create = result.endpoints.find((e) => e.operationId === "createCourse");
      expect(create!.requestBody).toBeDefined();
      expect(create!.requestBody!.ref).toBe("Course");
    });

    it("parses response schema from content", () => {
      const result = parseSpec(OPENAPI_3_SPEC);
      const list = result.endpoints.find((e) => e.operationId === "listCourses");
      expect(list!.responseSchema?.type).toBe("array");
      expect(list!.responseSchema?.items?.ref).toBe("Course");
    });

    it("handles missing servers gracefully", () => {
      const spec = { ...OPENAPI_3_SPEC, servers: [] };
      const result = parseSpec(spec);
      expect(result.basePath).toBe("/");
    });
  });

  it("generates method name from path when operationId is missing", () => {
    const spec = {
      swagger: "2.0",
      info: { title: "Test", version: "1.0" },
      basePath: "/",
      paths: {
        "/things/{id}": {
          get: {
            tags: [],
            parameters: [{ name: "id", in: "path", type: "string", required: true }],
            responses: { "200": { schema: { type: "object" } } },
          },
        },
      },
    };
    const result = parseSpec(spec);
    expect(result.endpoints[0]?.operationId).toBeUndefined();
    expect(result.endpoints[0]?.path).toBe("/things/{id}");
  });
});
