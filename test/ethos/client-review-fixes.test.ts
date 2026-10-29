import { describe, it, expect, vi, beforeEach } from "vitest";
import { EthosClient } from "../../src/ethos/client.js";
import { AuthError, BannerError, ServerError } from "../../src/common/errors.js";

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

/** Mock fetch: /auth returns a token, everything else returns `respond(url)`. */
function mockEthos(respond: (url: string) => Response = () => json([])) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth")) return new Response("token");
    return respond(url);
  });
}

const apiCalls = (spy: ReturnType<typeof mockEthos>) =>
  spy.mock.calls
    .filter((c) => !String(c[0]).endsWith("/auth"))
    .map((c) => ({
      url: String(c[0]),
      accept: (c[1]!.headers as Record<string, string>).Accept,
      method: c[1]!.method,
    }));

describe("EthosClient rejects path traversal in resource names and ids", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["get", (c: EthosClient) => c.get("..", "consume")],
    ["get dot", (c: EthosClient) => c.get(".", "x")],
    ["get encoded", (c: EthosClient) => c.get("%2e%2e", "consume")],
    ["get slash", (c: EthosClient) => c.get("a/../b", "x")],
    ["delete id ..", (c: EthosClient) => c.delete("persons", "..")],
    ["delete id .", (c: EthosClient) => c.delete("persons", ".")],
    ["delete id %2e%2e", (c: EthosClient) => c.delete("persons", "%2e%2e")],
    ["update id a/../b", (c: EthosClient) => c.update("persons", "a/../b", {})],
    ["delete resource ..", (c: EthosClient) => c.delete("..", "X")],
    ["getPage", (c: EthosClient) => c.getPage("..")],
    ["filter", (c: EthosClient) => c.filter("../consume", {})],
    ["qapi", (c: EthosClient) => c.qapi.search("..", {})],
    ["resource()", (c: EthosClient) => c.resource("..").getPage()],
  ])("%s throws TypeError and sends nothing", async (_name, call) => {
    const spy = mockEthos();
    const client = new EthosClient({ apiKey: "k" });
    await expect(call(client)).rejects.toBeInstanceOf(TypeError);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("pre-bound accessors call real EEDM resources and versions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["positions", "institution-positions", 12],
    ["jobs", "institution-jobs", 12],
    ["studentFinancialAidAwards", "student-financial-aid-awards", 11],
    ["financialAidAwards", "student-financial-aid-awards", 11],
    ["restrictedStudentFinancialAidAwards", "restricted-student-financial-aid-awards", 11],
    ["gradeDefinitions", "grade-definitions", 6],
    ["grades", "grade-definitions", 6],
    ["courses", "courses", 6],
    ["accountingStrings", "accounting-strings", 7],
  ] as const)("%s -> /api/%s v%s", async (accessor, resource, version) => {
    const spy = mockEthos();
    const client = new EthosClient({ apiKey: "k" });
    await client[accessor].getPage(0, 5);
    expect(apiCalls(spy)).toEqual([
      {
        url: `https://integrate.elluciancloud.com/api/${resource}?offset=0&limit=5`,
        accept: `application/vnd.hedtech.integration.v${version}+json`,
        method: "GET",
      },
    ]);
  });

  it("deprecated aliases are the same accessor", () => {
    const client = new EthosClient({ apiKey: "k" });
    expect(client.grades).toBe(client.gradeDefinitions);
    expect(client.financialAidAwards).toBe(client.studentFinancialAidAwards);
  });

  it("accessor filter sends the accessor's version, generic filter sends application/json", async () => {
    const spy = mockEthos();
    const client = new EthosClient({ apiKey: "k" });
    await client.sectionRegistrations.filter({ registrant: { id: "p1" } });
    await client.filter("section-registrations", { registrant: { id: "p1" } });
    const [typed, generic] = apiCalls(spy);
    expect(typed!.accept).toBe("application/vnd.hedtech.integration.v16+json");
    expect(generic!.accept).toBe("application/json");
    expect(typed!.url).toBe(generic!.url);
  });

  it("accessor qapiSearch posts to /qapi with the accessor's version", async () => {
    const spy = mockEthos();
    const client = new EthosClient({ apiKey: "k" });
    await client.persons.qapiSearch({ names: [{ lastName: "Smith" }] });
    expect(apiCalls(spy)).toEqual([
      {
        url: "https://integrate.elluciancloud.com/qapi/persons?offset=0&limit=25",
        accept: "application/vnd.hedtech.integration.v12+json",
        method: "POST",
      },
    ]);
  });
});

describe("namedQuery wrap options and namedQueryAll", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends an unwrapped named query with { wrap: false }", async () => {
    const spy = mockEthos();
    const client = new EthosClient({ apiKey: "k" });
    const params = { statuses: ["registered"], academicPeriod: { id: "t1" } };
    await client.namedQuery(
      "section-registrations",
      "registrationStatusesByAcademicPeriod",
      params,
      0,
      25,
      16,
      { wrap: false, headers: { "X-Trace": "1" } },
    );
    const call = spy.mock.calls.find((c) => !String(c[0]).endsWith("/auth"))!;
    expect(String(call[0])).toContain(
      `registrationStatusesByAcademicPeriod=${encodeURIComponent(JSON.stringify(params))}`,
    );
    expect((call[1]!.headers as Record<string, string>)["X-Trace"]).toBe("1");
  });

  it("namedQueryAll pages through every result", async () => {
    let n = 0;
    const spy = mockEthos(() =>
      ++n === 1
        ? json([{ id: "a" }, { id: "b" }], { "x-total-count": "3" })
        : json([{ id: "c" }], { "x-total-count": "3" }),
    );
    const client = new EthosClient({ apiKey: "k" });
    const ids: string[] = [];
    for await (const batch of client.sections.namedQueryAll<{ id: string }>(
      "keywordSearch",
      "math",
      2,
    )) {
      ids.push(...batch.map((s) => s.id));
    }
    expect(ids).toEqual(["a", "b", "c"]);
    const urls = apiCalls(spy).map((c) => c.url);
    expect(urls[0]).toContain("offset=0&limit=2");
    expect(urls[1]).toContain("offset=2&limit=2");
  });
});

describe("Ethos /auth retries and error mapping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries a transient 503 from /auth", async () => {
    let authCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/auth")) {
        return ++authCalls === 1 ? new Response("busy", { status: 503 }) : new Response("token");
      }
      return json({ id: "p1" });
    });
    const client = new EthosClient({ apiKey: "k", retry: { baseDelay: 1, maxRetries: 2 } });
    expect(await client.get("persons", "p1", 12)).toEqual({ id: "p1" });
    expect(authCalls).toBe(2);
  });

  it("retries a network error from /auth", async () => {
    let authCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/auth")) {
        if (++authCalls === 1) throw new TypeError("fetch failed");
        return new Response("token");
      }
      return json({ id: "p1" });
    });
    const client = new EthosClient({ apiKey: "k", retry: { baseDelay: 1, maxRetries: 2 } });
    await client.get("persons", "p1", 12);
    expect(authCalls).toBe(2);
  });

  it("gives up with AuthError after exhausting retries on 5xx", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("down", { status: 500 }),
    );
    const client = new EthosClient({ apiKey: "k", retry: { baseDelay: 1, maxRetries: 1 } });
    const err = await client.get("persons", "p1", 12).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).not.toBeInstanceOf(ServerError);
  });

  it("does not retry 401 from /auth (bad API key)", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("no", { status: 401 }));
    const client = new EthosClient({ apiKey: "k", retry: { baseDelay: 1, maxRetries: 3 } });
    await expect(client.get("persons", "p1", 12)).rejects.toBeInstanceOf(AuthError);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("non-JSON bodies surface as BannerError without body text in the message", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const html = () =>
    new Response("<html>Jane Doe A00123456</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });

  it.each([
    ["list", (c: EthosClient) => c.getPage("persons")],
    ["filter", (c: EthosClient) => c.filter("persons", { names: [{ lastName: "Doe" }] })],
    [
      "graphql",
      (c: EthosClient) => c.graphql.query({ query: "{ persons12 { edges { node { id } } } }" }),
    ],
    ["notifications", (c: EthosClient) => c.notifications.consume()],
  ])("%s", async (_name, call) => {
    mockEthos(html);
    const err = (await call(new EthosClient({ apiKey: "k" })).catch(
      (e: unknown) => e,
    )) as BannerError;
    expect(err).toBeInstanceOf(BannerError);
    expect(err.message).not.toContain("Jane");
    expect(err.message).not.toContain("A00123456");
    expect(err.responseBody).toContain("Jane Doe");
  });
});
