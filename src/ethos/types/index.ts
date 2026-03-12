// Common EEDM types
export type {
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
} from "./common.js";

// Persons (v12)
export type {
  AddressCountry,
  AddressDetail,
  AddressPlace,
  AddressRegion,
  ContactType,
  EthnicityReporting,
  Person,
  PersonAddress,
  PersonAlternativeCredential,
  PersonCredential,
  PersonEmail,
  PersonEthnicity,
  PersonIdentityDocument,
  PersonInterest,
  PersonLanguage,
  PersonName,
  PersonNameType,
  PersonPhone,
  PersonRace,
  PersonRole,
  PersonSocialMedia,
  RaceReporting,
  SeasonalOccupancy,
} from "./persons.js";

// Students (v16)
export type {
  Student,
  StudentClassification,
  StudentLevelClassification,
  StudentResidency,
  StudentType,
} from "./students.js";

// Courses (v4)
export type { Course, CourseSubject } from "./courses.js";

// Sections (v16)
export type {
  Section,
  SectionAlternateId,
  SectionCourseCategory,
  SectionDescription,
  SectionDuration,
  SectionHour,
  SectionStatus,
  SectionTitle,
  SectionWaitlist,
} from "./sections.js";

// Academic Periods (v16)
export type {
  AcademicPeriod,
  AcademicPeriodCategory,
  AcademicPeriodRegistration,
} from "./academic-periods.js";

// Grades (v6)
export type { Grade, GradeScheme, GradeValue } from "./grades.js";

// Section Registrations (v16)
export type {
  SectionRegistration,
  RegistrationApproval,
  RegistrationGrade,
  RegistrationInvolvement,
  RegistrationStatus,
} from "./section-registrations.js";

// Instructional Events (v11)
export type {
  InstructionalEvent,
  InstructionalEventInstructor,
  InstructionalEventLocation,
  InstructionalEventRecurrence,
  RecurrenceTimePeriod,
  RepeatRule,
  RepeatRuleEnds,
} from "./instructional-events.js";

// Student Academic Credentials (v1)
export type {
  StudentAcademicCredential,
  CredentialDiscipline,
  CredentialRecognition,
} from "./student-academic-credentials.js";

// Financial Aid
export type {
  FinancialAidApplication,
  FinancialAidAward,
  FinancialAidFund,
} from "./financial-aid.js";

// Finance
export type {
  AccountingString,
  AccountingStringComponent,
  CurrencyAmount,
  LedgerActivity,
} from "./finance.js";

// HR — Employees, Positions, Jobs (v12)
export type {
  Employee,
  EmployeeContract,
  Position,
  Job,
} from "./employees.js";
