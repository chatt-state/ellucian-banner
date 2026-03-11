/**
 * Common EEDM types shared across multiple resources.
 *
 * These types represent the foundational building blocks used throughout
 * the Ellucian Ethos Data Model (EEDM).
 */

/** A reference to another EEDM resource by GUID. */
export interface GuidRef {
  /** The globally unique identifier (GUID) of the referenced resource. */
  id: string;
}

/** A reference with an id and optional title. */
export interface NamedRef {
  /** The globally unique identifier (GUID) of the referenced resource. */
  id: string;
  /** The human-readable title of the referenced resource. */
  title?: string;
}

/** Metadata attached to every EEDM resource payload. */
export interface EedmMetadata {
  /** The date and time the resource was created. */
  createdOn?: string;
  /** The date and time the resource was last modified. */
  modifiedOn?: string;
}

/**
 * A credit category classifying the type of academic credit.
 *
 * Used by both courses and sections to describe credit characteristics.
 */
export interface CreditCategory {
  /** The type of credit (e.g., "institutional", "transfer", "continuingEducation"). */
  creditType?: string;
  /** A reference to the credit category detail. */
  detail?: GuidRef;
}

/**
 * A unit of academic credit awarded for a course or section.
 *
 * Describes the credit range (minimum to maximum) and the unit of measure.
 */
export interface Credit {
  /** The academic credit category. */
  creditCategory?: CreditCategory;
  /** The unit of measurement for the credit (e.g., "credit", "hour", "ceu"). */
  measure?: string;
  /** The minimum number of credits. */
  minimum?: number;
  /** The maximum number of credits. */
  maximum?: number;
  /** The increment step between minimum and maximum. */
  increment?: number;
}

/** A reference to an academic level (e.g., "Undergraduate", "Graduate"). */
export interface AcademicLevelRef {
  /** A reference to the academic-levels resource. */
  id: string;
  /** The title of the academic level. */
  title?: string;
}

/** A reference to a course level (e.g., "100-level", "200-level"). */
export interface CourseLevelRef {
  /** A reference to the course-levels resource. */
  id: string;
  /** The title of the course level. */
  title?: string;
}

/** A reference to a grade scheme used for awarding grades. */
export interface GradeSchemeRef {
  /** A reference to the grade-schemes resource. */
  id: string;
  /** The title of the grade scheme. */
  title?: string;
}

/** A reference to an instructional method (e.g., "Lecture", "Lab"). */
export interface InstructionalMethodRef {
  /** A reference to the instructional-methods resource. */
  id: string;
  /** The title of the instructional method. */
  title?: string;
  /** An abbreviation for the instructional method. */
  abbreviation?: string;
}

/** An institution unit that owns or is responsible for a resource. */
export interface OwningInstitutionUnit {
  /** A reference to the owning institution unit. */
  institutionUnit: GuidRef;
  /** The percentage of ownership. */
  ownershipPercentage?: number;
}
