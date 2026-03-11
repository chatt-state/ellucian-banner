// Auth
export { EthosAuth } from "./auth/ethos-auth.js";
export { BannerAuth } from "./auth/banner-auth.js";
export type { EthosAuthConfig, BannerAuthConfig } from "./auth/types.js";

// Ethos Client
export { EthosClient } from "./ethos/client.js";
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
} from "./ethos/types/index.js";

// HTTP Client
export { HttpClient } from "./common/http-client.js";
export type { AuthProvider, HttpClientConfig } from "./common/http-client.js";

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
