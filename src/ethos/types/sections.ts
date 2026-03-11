/**
 * EEDM Sections resource types (v16).
 *
 * Represents course section offerings -- specific instances of a course
 * scheduled during an academic period with instructors, meeting times, and
 * enrollment limits.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type {
  AcademicLevelRef,
  CourseLevelRef,
  Credit,
  EedmMetadata,
  GradeSchemeRef,
  GuidRef,
  InstructionalMethodRef,
  NamedRef,
  OwningInstitutionUnit,
} from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A title entry for a section (sections can have multiple title types). */
export interface SectionTitle {
  /** The type of title (e.g., "short", "long"). */
  type?: string;
  /** The title text. */
  value: string;
}

/** A description entry for a section. */
export interface SectionDescription {
  /** The type of description. */
  type?: string;
  /** The description text. */
  value: string;
}

/** A course category classification (e.g., "Vocational", "Lab"). */
export interface SectionCourseCategory {
  /** A reference to the course-categories resource. */
  detail?: GuidRef;
  /** The type of the course category. */
  type?: string;
}

/** Hours assigned to a section by instructional method. */
export interface SectionHour {
  /** The minimum hours. */
  minimum?: number;
  /** The maximum hours. */
  maximum?: number;
  /** The interval (e.g., "week", "term"). */
  interval?: string;
  /** A reference to the administrative instructional method. */
  administrativeInstructionalMethod?: GuidRef;
}

/** Duration calculation scheme for the section. */
export interface SectionDuration {
  /** The length of the duration. */
  length?: number;
  /** The unit of duration (e.g., "days", "weeks", "months"). */
  unit?: string;
}

/** Waitlist configuration for a section. */
export interface SectionWaitlist {
  /** The maximum number of students on the waitlist. */
  maximum?: number;
  /** The registration status for the waitlist. */
  registrationStatus?: string;
}

/** An alternate identifier for a section (non-Ethos system). */
export interface SectionAlternateId {
  /** The type of alternate identifier. */
  type?: string;
  /** The alternate identifier value. */
  value?: string;
}

// ---------------------------------------------------------------------------
// Main Section interface
// ---------------------------------------------------------------------------

/**
 * A course section offering (EEDM sections v16).
 *
 * Describes a specific instance of a course during an academic period,
 * including scheduling dates, credits, enrollment limits, and site location.
 */
export interface Section {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the section. */
  id: string;
  /** The section titles. */
  titles: SectionTitle[];
  /** The section descriptions. */
  descriptions?: SectionDescription[];
  /** The date when the section begins (YYYY-MM-DD). */
  startOn: string;
  /** The date when the section ends (YYYY-MM-DD). */
  endOn?: string;
  /** A human-readable section identifier, generally unique per period. */
  code?: string;
  /** A number distinguishing multiple sections of the same course in a period. */
  number?: string;
  /** The technology platform managing section administration. */
  instructionalPlatform?: NamedRef;
  /** The academic period (term) for the section. */
  academicPeriod?: NamedRef;
  /** Census dates overriding the period defaults (YYYY-MM-DD). */
  censusDates?: string[];
  /** A reference to the parent course. */
  course: GuidRef;
  /** Course categories (e.g., "Vocational", "Lab", "Music"). */
  courseCategories?: SectionCourseCategory[];
  /** Credit specifications for the section. */
  credits?: Credit[];
  /** The primary site (campus/location) for section meetings. */
  site?: NamedRef;
  /** Academic levels associated with the section. */
  academicLevels?: AcademicLevelRef[];
  /** Grading schemes available for the section. */
  gradeSchemes?: GradeSchemeRef[];
  /** Course level classifications. */
  courseLevels?: CourseLevelRef[];
  /** Instructional methods used (e.g., "Lecture", "Lab"). */
  instructionalMethods?: InstructionalMethodRef[];
  /** Hours assigned by instructional method. */
  hours?: SectionHour[];
  /** The delivery method for instruction (e.g., "inPerson", "online", "hybrid"). */
  instructionalDeliveryMethod?: GuidRef;
  /** The current status of the section (e.g., "open", "closed", "cancelled"). */
  status?: SectionStatus;
  /** The duration of the section. */
  duration?: SectionDuration;
  /** The maximum number of students that may enroll. */
  maxEnrollment?: number;
  /** The maximum number of reserved seats. */
  reservedSeatsMaximum?: number;
  /** Waitlist configuration. */
  waitlist?: SectionWaitlist;
  /** Cross-listing information. */
  crossListed?: GuidRef;
  /** Institution units responsible for the section. */
  owningInstitutionUnits?: OwningInstitutionUnit[];
  /** Billing units for calculating section charges. */
  billing?: number;
  /** The method for assessing section charges. */
  chargeAssessmentMethod?: string;
  /** Non-Ethos alternate identifiers. */
  alternateIds?: SectionAlternateId[];
  /** The academic period used for reporting. */
  reportingAcademicPeriod?: NamedRef;
}

/** The status of a section. */
export interface SectionStatus {
  /** The category of the status (e.g., "open", "closed", "pending", "cancelled"). */
  category?: string;
  /** A reference to a more specific status detail. */
  detail?: GuidRef;
}
