import { EthosAuth } from "../auth/ethos-auth.js";
import { HttpClient } from "../common/http-client.js";
import { parsePaginatedResponse, paginateAll, DEFAULT_PAGE_SIZE } from "../common/pagination.js";
import { readJson } from "../common/json.js";
import { EthosResource } from "./resource.js";
import { EthosNotifications } from "./notifications.js";
import { EthosQapi } from "./qapi.js";
import { EthosGraphQL } from "./graphql.js";
import { buildCriteriaParam, buildNamedQueryParam } from "./criteria.js";
import type { NamedQueryOptions } from "./criteria.js";
import { collectionPath, itemPath, pageQuery } from "./path.js";
import { eedmHeaders } from "./media-type.js";
import type { EedmVersion, EthosClientConfig } from "./types.js";
import type { PaginatedResponse, RequestOptions } from "../common/types.js";
import type { Person } from "./types/persons.js";
import type { Student } from "./types/students.js";
import type { Course } from "./types/courses.js";
import type { Section } from "./types/sections.js";
import type { AcademicPeriod } from "./types/academic-periods.js";
import type { Grade } from "./types/grades.js";
import type { GradeScheme } from "./types/grades.js";
import type { SectionRegistration } from "./types/section-registrations.js";
import type { InstructionalEvent } from "./types/instructional-events.js";
import type { StudentAcademicCredential } from "./types/student-academic-credentials.js";
import type {
  FinancialAidApplication,
  FinancialAidAward,
  FinancialAidFund,
} from "./types/financial-aid.js";
import type { AccountingString, LedgerActivity } from "./types/finance.js";
import type { Employee, Position, Job } from "./types/employees.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";

/** Request options for {@link EthosClient.namedQuery}: transport options plus how to wrap the query JSON. */
export interface NamedQueryRequestOptions extends RequestOptions, NamedQueryOptions {}

/**
 * Client for Ellucian Ethos Integration proxy API.
 * Provides CRUD operations on EEDM resources via the Ethos proxy.
 *
 * Version note: the pre-bound accessors (`ethos.persons`, `ethos.sections`, ...)
 * always send their pinned EEDM version, including for `filter`/`namedQuery`.
 * The generic methods (`ethos.get(resource, ...)`, `ethos.filter(...)`, ...)
 * send `Accept: application/json` when `version` is omitted, and Ethos then
 * returns the **latest** version, whose schema can change when the tenant
 * upgrades. Prefer the accessors, or pass a version explicitly.
 */
export class EthosClient {
  private readonly http: HttpClient;
  private readonly auth: EthosAuth;

  /** Pre-bound accessor for persons (EEDM v12). */
  readonly persons: EthosResource<Person>;
  /** Pre-bound accessor for students (EEDM v16). */
  readonly students: EthosResource<Student>;
  /** Pre-bound accessor for courses (EEDM v6). */
  readonly courses: EthosResource<Course>;
  /** Pre-bound accessor for sections (EEDM v16). */
  readonly sections: EthosResource<Section>;
  /** Pre-bound accessor for academic-periods (EEDM v16). */
  readonly academicPeriods: EthosResource<AcademicPeriod>;
  /** Pre-bound accessor for grade-definitions (EEDM v6). */
  readonly gradeDefinitions: EthosResource<Grade>;
  /**
   * Alias of {@link gradeDefinitions}. EEDM has no `grades` resource; this
   * accessor calls `grade-definitions`.
   * @deprecated Use `gradeDefinitions`.
   */
  readonly grades: EthosResource<Grade>;
  /** Pre-bound accessor for grade-schemes (EEDM v6). */
  readonly gradeSchemes: EthosResource<GradeScheme>;
  /** Pre-bound accessor for section-registrations (EEDM v16). */
  readonly sectionRegistrations: EthosResource<SectionRegistration>;
  /** Pre-bound accessor for instructional-events (EEDM v11). */
  readonly instructionalEvents: EthosResource<InstructionalEvent>;
  /** Pre-bound accessor for student-academic-credentials (EEDM v1). */
  readonly studentAcademicCredentials: EthosResource<StudentAcademicCredential>;
  /** Pre-bound accessor for financial-aid-applications (EEDM v9). */
  readonly financialAidApplications: EthosResource<FinancialAidApplication>;
  /** Pre-bound accessor for student-financial-aid-awards (EEDM v11). */
  readonly studentFinancialAidAwards: EthosResource<FinancialAidAward>;
  /** Pre-bound accessor for restricted-student-financial-aid-awards (EEDM v11). */
  readonly restrictedStudentFinancialAidAwards: EthosResource<FinancialAidAward>;
  /**
   * Alias of {@link studentFinancialAidAwards} (`student-financial-aid-awards`
   * v11). EEDM has no `financial-aid-awards` resource.
   * @deprecated Use `studentFinancialAidAwards`.
   */
  readonly financialAidAwards: EthosResource<FinancialAidAward>;
  /** Pre-bound accessor for financial-aid-funds. */
  readonly financialAidFunds: EthosResource<FinancialAidFund>;
  /** Pre-bound accessor for accounting-strings (EEDM v7, the only published version). */
  readonly accountingStrings: EthosResource<AccountingString>;
  /** Pre-bound accessor for ledger-activities. */
  readonly ledgerActivities: EthosResource<LedgerActivity>;
  /** Pre-bound accessor for employees (EEDM v12). */
  readonly employees: EthosResource<Employee>;
  /** Pre-bound accessor for institution-positions (EEDM v12). */
  readonly positions: EthosResource<Position>;
  /** Pre-bound accessor for institution-jobs (EEDM v12). */
  readonly jobs: EthosResource<Job>;
  /** Change notification consumer. */
  readonly notifications: EthosNotifications;
  /** QAPI (POST-based search) client. */
  readonly qapi: EthosQapi;
  /** GraphQL query client. */
  readonly graphql: EthosGraphQL;

  constructor(config: EthosClientConfig = {}) {
    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const auth = new EthosAuth({
      apiKey: config.apiKey,
      baseUrl,
      refreshBuffer: config.refreshBuffer,
      expirationMinutes: config.expirationMinutes,
      timeout: config.timeout,
      retry: config.retry ?? true,
      allowInsecureHttp: config.allowInsecureHttp,
    });
    this.auth = auth;

    this.http = new HttpClient({
      baseUrl,
      authProvider: (signal) => auth.getToken(signal).then((t) => `Bearer ${t}`),
      timeout: config.timeout,
      debug: config.debug,
      retry: config.retry ?? true,
      // A 401 means Ethos rejected the token (expired early, revoked, or
      // rotated). Drop it and retry once with a fresh one.
      onUnauthorized: (rejected) => {
        auth.invalidate(rejected.replace(/^Bearer\s+/i, ""));
        return true;
      },
    });

    // Pre-bound resource accessors with typed defaults
    this.persons = new EthosResource<Person>(this, "persons", 12);
    this.students = new EthosResource<Student>(this, "students", 16);
    this.courses = new EthosResource<Course>(this, "courses", 6);
    this.sections = new EthosResource<Section>(this, "sections", 16);
    this.academicPeriods = new EthosResource<AcademicPeriod>(this, "academic-periods", 16);
    this.gradeDefinitions = new EthosResource<Grade>(this, "grade-definitions", 6);
    this.grades = this.gradeDefinitions;
    this.gradeSchemes = new EthosResource<GradeScheme>(this, "grade-schemes", 6);
    this.sectionRegistrations = new EthosResource<SectionRegistration>(
      this,
      "section-registrations",
      16,
    );
    this.instructionalEvents = new EthosResource<InstructionalEvent>(
      this,
      "instructional-events",
      11,
    );
    this.studentAcademicCredentials = new EthosResource<StudentAcademicCredential>(
      this,
      "student-academic-credentials",
      1,
    );
    this.financialAidApplications = new EthosResource<FinancialAidApplication>(
      this,
      "financial-aid-applications",
      9,
    );
    this.studentFinancialAidAwards = new EthosResource<FinancialAidAward>(
      this,
      "student-financial-aid-awards",
      11,
    );
    this.restrictedStudentFinancialAidAwards = new EthosResource<FinancialAidAward>(
      this,
      "restricted-student-financial-aid-awards",
      11,
    );
    this.financialAidAwards = this.studentFinancialAidAwards;
    this.financialAidFunds = new EthosResource<FinancialAidFund>(this, "financial-aid-funds");
    this.accountingStrings = new EthosResource<AccountingString>(this, "accounting-strings", 7);
    this.ledgerActivities = new EthosResource<LedgerActivity>(this, "ledger-activities");
    this.employees = new EthosResource<Employee>(this, "employees", 12);
    this.positions = new EthosResource<Position>(this, "institution-positions", 12);
    this.jobs = new EthosResource<Job>(this, "institution-jobs", 12);
    this.notifications = new EthosNotifications(this.http);
    this.qapi = new EthosQapi(this.http);
    this.graphql = new EthosGraphQL(this.http);
  }

  /** Create a custom resource accessor for any EEDM resource. */
  resource<T = unknown>(name: string, version?: EedmVersion): EthosResource<T> {
    return new EthosResource<T>(this, name, version);
  }

  /** GET a single resource by ID. */
  async get<T = unknown>(
    resource: string,
    id: string,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.get(itemPath(resource, id), eedmHeaders(version), options);
    return readJson<T>(response);
  }

  /** GET a page of resources. */
  async getPage<T = unknown>(
    resource: string,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const response = await this.http.get(
      `${collectionPath(resource)}?${pageQuery(offset, limit)}`,
      eedmHeaders(version),
      options,
    );
    return parsePaginatedResponse<T>(response, offset, limit);
  }

  /** Async generator that yields all pages of a resource. */
  async *getAll<T = unknown>(
    resource: string,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* paginateAll<T>(
      (off, lim) => this.getPage<T>(resource, off, lim, version, options),
      pageSize,
    );
  }

  /** POST (create) a new resource. */
  async create<T = unknown>(
    resource: string,
    body: unknown,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.post(
      collectionPath(resource),
      body,
      eedmHeaders(version, true),
      options,
    );
    return readJson<T>(response);
  }

  /** PUT (update) a resource by ID. */
  async update<T = unknown>(
    resource: string,
    id: string,
    body: unknown,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.put(
      itemPath(resource, id),
      body,
      eedmHeaders(version, true),
      options,
    );
    return readJson<T>(response);
  }

  /** DELETE a resource by ID. */
  async delete(
    resource: string,
    id: string,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<void> {
    const response = await this.http.delete(itemPath(resource, id), eedmHeaders(version), options);
    await response.body?.cancel().catch(() => undefined);
  }

  /**
   * GET resources filtered by criteria (`?criteria=<url-encoded JSON>`).
   *
   * Without `version`, Ethos returns the latest version of the resource.
   * Prefer the typed accessor (`ethos.persons.filter(...)`), which sends its
   * pinned version.
   *
   * @example
   * await client.filter("persons", { names: [{ firstName: "John" }] });
   */
  async filter<T = unknown>(
    resource: string,
    criteria: Record<string, unknown>,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const query = `${buildCriteriaParam(criteria)}&${pageQuery(offset, limit)}`;
    const response = await this.http.get(
      `${collectionPath(resource)}?${query}`,
      eedmHeaders(version),
      options,
    );
    return parsePaginatedResponse<T>(response, offset, limit);
  }

  /** Async generator that yields all pages of a criteria-filtered resource. */
  async *filterAll<T = unknown>(
    resource: string,
    criteria: Record<string, unknown>,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: RequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* paginateAll<T>(
      (off, lim) => this.filter<T>(resource, criteria, off, lim, version, options),
      pageSize,
    );
  }

  /**
   * GET resources using a named query (`?{queryName}=<url-encoded JSON>`).
   *
   * `params` is wrapped as `{ [queryName]: params }` unless it is already in
   * that shape. Pass `{ wrap: false }` in `options` for queries whose JSON
   * keys differ from the query name (see {@link buildNamedQueryParam}).
   * Without `version`, Ethos returns the latest version of the resource.
   *
   * @example
   * await client.namedQuery("sections", "keywordSearch", "math");
   * await client.namedQuery("persons", "personFilter", { personFilter: { id: guid } });
   * await client.namedQuery(
   *   "section-registrations",
   *   "registrationStatusesByAcademicPeriod",
   *   { statuses: ["registered"], academicPeriod: { id: termGuid } },
   *   0, 25, 16,
   *   { wrap: false },
   * );
   */
  async namedQuery<T = unknown>(
    resource: string,
    queryName: string,
    params: unknown,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: NamedQueryRequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const wrapOptions: NamedQueryOptions =
      options?.wrap === undefined ? {} : { wrap: options.wrap };
    const query = `${buildNamedQueryParam(queryName, params, wrapOptions)}&${pageQuery(offset, limit)}`;
    const requestOptions: RequestOptions | undefined = options
      ? { headers: options.headers, signal: options.signal }
      : undefined;
    const response = await this.http.get(
      `${collectionPath(resource)}?${query}`,
      eedmHeaders(version),
      requestOptions,
    );
    return parsePaginatedResponse<T>(response, offset, limit);
  }

  /** Async generator that yields all pages of a named query. */
  async *namedQueryAll<T = unknown>(
    resource: string,
    queryName: string,
    params: unknown,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: EedmVersion,
    options?: NamedQueryRequestOptions,
  ): AsyncGenerator<T[], void, unknown> {
    yield* paginateAll<T>(
      (off, lim) => this.namedQuery<T>(resource, queryName, params, off, lim, version, options),
      pageSize,
    );
  }

  /** Discard the cached access token; the next request fetches a fresh one. */
  invalidateToken(): void {
    this.auth.invalidate();
  }
}
