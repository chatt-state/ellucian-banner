/**
 * EEDM Students resource types (v16).
 *
 * Represents student-specific attributes for a person who has enrolled, or is
 * eligible to enroll, at an institution. Links to the persons resource via the
 * `person` reference.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A type classification for a student (e.g., "matriculated", "nonMatriculated"). */
export interface StudentType {
  /** A reference to the student-types resource. */
  type: GuidRef;
}

/** A residency classification for a student during a period. */
export interface StudentResidency {
  /** A reference to the residency-types resource. */
  residency: GuidRef;
  /** The date the residency became effective (YYYY-MM-DD). */
  startOn?: string;
  /** The administrative period in which the residency started. */
  administrativePeriod?: GuidRef;
}

/** The most recent classification at an academic level. */
export interface StudentLevelClassification {
  /** The academic level associated with the student. */
  level: GuidRef;
  /** The latest classification at this level. */
  latestClassification: StudentClassification;
}

/** A classification detail for a student (e.g., "Freshman", "Sophomore"). */
export interface StudentClassification {
  /** A reference to the student-classifications resource. */
  classification: GuidRef;
}

// ---------------------------------------------------------------------------
// Main Student interface
// ---------------------------------------------------------------------------

/**
 * A student record (EEDM students v16).
 *
 * Links to a person via `person.id` and adds student-specific attributes
 * such as type, residency, and academic level classifications.
 */
export interface Student {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the student record. */
  id: string;
  /** A reference to the associated person. */
  person: GuidRef;
  /** The types of the student (e.g., "matriculated"). */
  types?: StudentType[];
  /** Residency classifications for the student over time. */
  residencies?: StudentResidency[];
  /** The most recent classification at each academic level. */
  levelClassifications?: StudentLevelClassification[];
}
