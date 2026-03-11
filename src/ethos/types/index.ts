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
