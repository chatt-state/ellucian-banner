/**
 * EEDM Courses resource types (v4 / v6 compatible).
 *
 * Represents course catalog entries -- the smallest unit of instruction for
 * which an organization grants credits. Courses are offered as sections during
 * academic periods.
 *
 * The v4 schema is a subset of v6. These types cover both versions.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type {
  AcademicLevelRef,
  CourseLevelRef,
  Credit,
  EedmMetadata,
  GradeSchemeRef,
  InstructionalMethodRef,
  OwningInstitutionUnit,
} from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A reference to the academic subject area of a course (e.g., "Mathematics"). */
export interface CourseSubject {
  /** A reference to the subjects resource. */
  id: string;
  /** The subject title. */
  title?: string;
  /** The subject abbreviation (e.g., "MATH"). */
  abbreviation?: string;
}

// ---------------------------------------------------------------------------
// Main Course interface
// ---------------------------------------------------------------------------

/**
 * A course catalog entry (EEDM courses v4).
 *
 * Describes the subject, numbering, credit specifications, and scheduling
 * window for a course as it appears in the institution's catalog.
 */
export interface Course {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the course. */
  id: string;
  /** The full name of the course as it appears in the catalog. */
  title: string;
  /** A description of the course content. */
  description?: string;
  /** The academic subject area of the course. */
  subject: CourseSubject;
  /** The course number within the subject (e.g., "101", "4500"). */
  number: string;
  /** The academic levels associated with the course (e.g., "Undergraduate"). */
  academicLevels?: AcademicLevelRef[];
  /** The course levels (e.g., "100-level"). */
  courseLevels?: CourseLevelRef[];
  /** The instructional methods used to teach the course. */
  instructionalMethods?: InstructionalMethodRef[];
  /** The grading schemes that may be used for this course. */
  gradeSchemes?: GradeSchemeRef[];
  /** The credit specifications for the course. */
  credits?: Credit[];
  /** Institution units that own or are responsible for the course. */
  owningInstitutionUnits?: OwningInstitutionUnit[];
  /** The earliest date the course is available for section scheduling (YYYY-MM-DD). */
  schedulingStartOn?: string;
  /** The date the course is no longer available for section scheduling (YYYY-MM-DD). */
  schedulingEndOn?: string;
}
