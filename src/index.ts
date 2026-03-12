// Auth
export { EthosAuth } from "./auth/ethos-auth.js";
export { BannerAuth } from "./auth/banner-auth.js";
export type { EthosAuthConfig, BannerAuthConfig } from "./auth/types.js";

// Ethos Client
export { EthosClient } from "./ethos/client.js";
export { EthosResource } from "./ethos/resource.js";
export { EthosNotifications } from "./ethos/notifications.js";
export type { ChangeNotification, ConsumeOptions } from "./ethos/notifications.js";
export { EthosQapi } from "./ethos/qapi.js";
export { EthosGraphQL } from "./ethos/graphql.js";
export type { GraphQLRequest, GraphQLResponse, GraphQLError } from "./ethos/graphql.js";
export { buildCriteriaParam, buildNamedQueryParam } from "./ethos/criteria.js";
export type { EthosClientConfig } from "./ethos/types.js";

// EEDM Resource Types
export type {
  // Common
  AcademicLevelRef,
  CourseLevelRef,
  Credit,
  CreditCategory,
  EedmMetadata,
  GradeSchemeRef,
  GuidRef,
  InstructionalMethodRef,
  NamedRef,
  OwningInstitutionUnit,
  // Persons (v12)
  Person,
  PersonAddress,
  PersonAlternativeCredential,
  PersonCredential,
  PersonEmail,
  PersonName,
  PersonPhone,
  PersonRole,
  // Students (v16)
  Student,
  StudentLevelClassification,
  StudentResidency,
  StudentType,
  // Courses (v4)
  Course,
  CourseSubject,
  // Sections (v16)
  Section,
  SectionTitle,
  SectionStatus,
  // Academic Periods (v16)
  AcademicPeriod,
  AcademicPeriodCategory,
  // Grades (v6)
  Grade,
  GradeScheme,
  GradeValue,
  // Section Registrations (v16)
  SectionRegistration,
  RegistrationApproval,
  RegistrationGrade,
  RegistrationStatus,
  // Instructional Events (v11)
  InstructionalEvent,
  InstructionalEventInstructor,
  InstructionalEventLocation,
  // Student Academic Credentials (v1)
  StudentAcademicCredential,
  CredentialDiscipline,
  CredentialRecognition,
  // Financial Aid
  FinancialAidApplication,
  FinancialAidAward,
  FinancialAidFund,
  // Finance
  AccountingString,
  AccountingStringComponent,
  CurrencyAmount,
  LedgerActivity,
  // HR
  Employee,
  EmployeeContract,
  Position,
  Job,
} from "./ethos/types/index.js";

// Banner Client
export { BannerClient, BannerApiClient } from "./banner/client.js";
export type { BannerClientConfig } from "./banner/client.js";

// HTTP Client
export { HttpClient } from "./common/http-client.js";
export type { AuthProvider, HttpClientConfig } from "./common/http-client.js";

// Pagination
export { parsePaginatedResponse, paginateAll, DEFAULT_PAGE_SIZE } from "./common/pagination.js";

// Retry
export { withRetry } from "./common/retry.js";
export type { RetryOptions } from "./common/retry.js";

// Errors
export {
  BannerError,
  AuthError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ServerError,
  fromResponse,
} from "./common/errors.js";
export type { PaginatedResponse, RequestOptions } from "./common/types.js";
