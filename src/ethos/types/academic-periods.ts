/**
 * EEDM Academic Periods resource types (v16).
 *
 * Represents terms, semesters, and other academic time divisions used to
 * organize course offerings and enrollment at an institution.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** The category of an academic period (e.g., "term", "subterm", "year"). */
export interface AcademicPeriodCategory {
  /** The type of academic period (e.g., "term", "subterm", "year"). */
  type?: string;
  /** The parent academic period if this is a sub-period. */
  parent?: GuidRef;
  /** A reference to a specific period category detail. */
  detail?: GuidRef;
}

/** Registration status configuration for an academic period. */
export interface AcademicPeriodRegistration {
  /** The registration status (e.g., "open", "closed"). */
  status?: string;
}

// ---------------------------------------------------------------------------
// Main AcademicPeriod interface
// ---------------------------------------------------------------------------

/**
 * An academic time period (EEDM academic-periods v16).
 *
 * Describes a term or semester with its date range, category, and
 * registration status. Academic periods organize when sections are offered
 * and when students may enroll.
 */
export interface AcademicPeriod {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the academic period. */
  id: string;
  /** A short code identifying the period (e.g., "2024FA"). */
  code?: string;
  /** The full name of the academic period (e.g., "Fall 2024"). */
  title: string;
  /** A description of the academic period. */
  description?: string;
  /** The date the academic period begins (YYYY-MM-DD). */
  startOn: string;
  /** The date the academic period ends (YYYY-MM-DD). */
  endOn: string;
  /** Default census dates for enrollment determination (YYYY-MM-DD). */
  censusDates?: string[];
  /** The category of the academic period. */
  category: AcademicPeriodCategory;
  /** The registration status for the academic period. */
  registration?: AcademicPeriodRegistration;
}
