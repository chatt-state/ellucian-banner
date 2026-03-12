import { EthosAuth } from "../auth/ethos-auth.js";
import { HttpClient } from "../common/http-client.js";
import { parsePaginatedResponse, paginateAll, DEFAULT_PAGE_SIZE } from "../common/pagination.js";
import { EthosResource } from "./resource.js";
import { EthosNotifications } from "./notifications.js";
import { EthosQapi } from "./qapi.js";
import { EthosGraphQL } from "./graphql.js";
import { buildCriteriaParam, buildNamedQueryParam } from "./criteria.js";
import type { EthosClientConfig } from "./types.js";
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
import type { FinancialAidApplication, FinancialAidAward, FinancialAidFund } from "./types/financial-aid.js";
import type { AccountingString, LedgerActivity } from "./types/finance.js";
import type { Employee, Position, Job } from "./types/employees.js";

const DEFAULT_BASE_URL = "https://integrate.elluciancloud.com";

/**
 * Client for Ellucian Ethos Integration proxy API.
 * Provides CRUD operations on EEDM resources via the Ethos proxy.
 */
export class EthosClient {
  private readonly http: HttpClient;

  /** Pre-bound accessor for persons (EEDM v12). */
  readonly persons: EthosResource<Person>;
  /** Pre-bound accessor for students (EEDM v16). */
  readonly students: EthosResource<Student>;
  /** Pre-bound accessor for courses (EEDM v4). */
  readonly courses: EthosResource<Course>;
  /** Pre-bound accessor for sections (EEDM v16). */
  readonly sections: EthosResource<Section>;
  /** Pre-bound accessor for academic-periods (EEDM v16). */
  readonly academicPeriods: EthosResource<AcademicPeriod>;
  /** Pre-bound accessor for grades (EEDM v6). */
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
  /** Pre-bound accessor for financial-aid-awards. */
  readonly financialAidAwards: EthosResource<FinancialAidAward>;
  /** Pre-bound accessor for financial-aid-funds. */
  readonly financialAidFunds: EthosResource<FinancialAidFund>;
  /** Pre-bound accessor for accounting-strings (EEDM v12). */
  readonly accountingStrings: EthosResource<AccountingString>;
  /** Pre-bound accessor for ledger-activities. */
  readonly ledgerActivities: EthosResource<LedgerActivity>;
  /** Pre-bound accessor for employees (EEDM v12). */
  readonly employees: EthosResource<Employee>;
  /** Pre-bound accessor for positions (EEDM v12). */
  readonly positions: EthosResource<Position>;
  /** Pre-bound accessor for jobs (EEDM v12). */
  readonly jobs: EthosResource<Job>;
  /** Change notification consumer. */
  readonly notifications: EthosNotifications;
  /** QAPI (POST-based search) client. */
  readonly qapi: EthosQapi;
  /** GraphQL query client. */
  readonly graphql: EthosGraphQL;

  constructor(config: EthosClientConfig) {
    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const auth = new EthosAuth({ apiKey: config.apiKey, baseUrl });

    this.http = new HttpClient({
      baseUrl,
      authProvider: () => auth.getToken().then((t) => `Bearer ${t}`),
      timeout: config.timeout,
      debug: config.debug,
    });

    // Pre-bound resource accessors with typed defaults
    this.persons = new EthosResource<Person>(this, "persons", 12);
    this.students = new EthosResource<Student>(this, "students", 16);
    this.courses = new EthosResource<Course>(this, "courses", 4);
    this.sections = new EthosResource<Section>(this, "sections", 16);
    this.academicPeriods = new EthosResource<AcademicPeriod>(this, "academic-periods", 16);
    this.grades = new EthosResource<Grade>(this, "grades", 6);
    this.gradeSchemes = new EthosResource<GradeScheme>(this, "grade-schemes", 6);
    this.sectionRegistrations = new EthosResource<SectionRegistration>(this, "section-registrations", 16);
    this.instructionalEvents = new EthosResource<InstructionalEvent>(this, "instructional-events", 11);
    this.studentAcademicCredentials = new EthosResource<StudentAcademicCredential>(this, "student-academic-credentials", 1);
    this.financialAidApplications = new EthosResource<FinancialAidApplication>(this, "financial-aid-applications", 9);
    this.financialAidAwards = new EthosResource<FinancialAidAward>(this, "financial-aid-awards");
    this.financialAidFunds = new EthosResource<FinancialAidFund>(this, "financial-aid-funds");
    this.accountingStrings = new EthosResource<AccountingString>(this, "accounting-strings", 12);
    this.ledgerActivities = new EthosResource<LedgerActivity>(this, "ledger-activities");
    this.employees = new EthosResource<Employee>(this, "employees", 12);
    this.positions = new EthosResource<Position>(this, "positions", 12);
    this.jobs = new EthosResource<Job>(this, "jobs", 12);
    this.notifications = new EthosNotifications(this.http);
    this.qapi = new EthosQapi(this.http);
    this.graphql = new EthosGraphQL(this.http);
  }

  /** Create a custom resource accessor for any EEDM resource. */
  resource<T = unknown>(name: string, version?: number): EthosResource<T> {
    return new EthosResource<T>(this, name, version);
  }

  /** GET a single resource by ID. */
  async get<T = unknown>(
    resource: string,
    id: string,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.get(
      `/api/${resource}/${id}`,
      this.eedmHeaders(version),
      options,
    );
    return response.json() as Promise<T>;
  }

  /** GET a page of resources. */
  async getPage<T = unknown>(
    resource: string,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const response = await this.http.get(
      `/api/${resource}?offset=${offset}&limit=${limit}`,
      this.eedmHeaders(version),
      options,
    );
    return parsePaginatedResponse<T>(response, offset);
  }

  /** Async generator that yields all pages of a resource. */
  async *getAll<T = unknown>(
    resource: string,
    pageSize = DEFAULT_PAGE_SIZE,
    version?: number,
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
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.post(
      `/api/${resource}`,
      body,
      this.eedmHeaders(version, true),
      options,
    );
    return response.json() as Promise<T>;
  }

  /** PUT (update) a resource by ID. */
  async update<T = unknown>(
    resource: string,
    id: string,
    body: unknown,
    version?: number,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.http.put(
      `/api/${resource}/${id}`,
      body,
      this.eedmHeaders(version, true),
      options,
    );
    return response.json() as Promise<T>;
  }

  /** DELETE a resource by ID. */
  async delete(
    resource: string,
    id: string,
    version?: number,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.delete(`/api/${resource}/${id}`, this.eedmHeaders(version), options);
  }

  /** GET resources filtered by criteria. */
  async filter<T = unknown>(
    resource: string,
    criteria: Record<string, unknown>,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const query = `${buildCriteriaParam(criteria)}&offset=${offset}&limit=${limit}`;
    const response = await this.http.get(
      `/api/${resource}?${query}`,
      this.eedmHeaders(version),
      options,
    );
    return parsePaginatedResponse<T>(response, offset);
  }

  /** GET resources using a named query. */
  async namedQuery<T = unknown>(
    resource: string,
    queryName: string,
    params: Record<string, unknown>,
    offset = 0,
    limit = DEFAULT_PAGE_SIZE,
    version?: number,
    options?: RequestOptions,
  ): Promise<PaginatedResponse<T>> {
    const query = `${buildNamedQueryParam(queryName, params)}&offset=${offset}&limit=${limit}`;
    const response = await this.http.get(
      `/api/${resource}?${query}`,
      this.eedmHeaders(version),
      options,
    );
    return parsePaginatedResponse<T>(response, offset);
  }

  /** Build EEDM versioned Accept/Content-Type headers. */
  private eedmHeaders(version?: number, includeContentType = false): Record<string, string> {
    if (!version) {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (includeContentType) headers["Content-Type"] = "application/json";
      return headers;
    }
    const mediaType = `application/vnd.hedtech.integration.v${version}+json`;
    const headers: Record<string, string> = { Accept: mediaType };
    if (includeContentType) headers["Content-Type"] = mediaType;
    return headers;
  }
}
