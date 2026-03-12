/**
 * EEDM Grades resource types (v6).
 *
 * Represents grade definitions and grade schemes used by an institution
 * to evaluate student performance.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------

/**
 * A grade definition (EEDM grades v6).
 *
 * Represents a single grade value within a grade scheme (e.g., "A", "B+", "P").
 */
export interface Grade {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the grade. */
  id: string;
  /** The grade scheme this grade belongs to. */
  scheme: GuidRef;
  /** The grade value (e.g., "A", "B+", "P"). */
  grade?: GradeValue;
  /** The quality points associated with this grade. */
  qualityPoints?: number;
  /** Whether credits are included for this grade. */
  creditsIncluded?: boolean;
  /** Whether this grade counts as attempted credits. */
  attemptedCreditsIncluded?: boolean;
  /** Whether this grade counts as completed credits. */
  completedCreditsIncluded?: boolean;
  /** The priority or ordering of the grade within the scheme. */
  priority?: number;
}

/** The value portion of a grade. */
export interface GradeValue {
  /** The grade letter or symbol. */
  value?: string;
  /** A longer description of the grade. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Grade Scheme
// ---------------------------------------------------------------------------

/**
 * A grade scheme (EEDM grade-schemes v6).
 *
 * A collection of grades used for evaluating student performance.
 */
export interface GradeScheme {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the grade scheme. */
  id: string;
  /** The code for the grade scheme. */
  code?: string;
  /** The human-readable title. */
  title?: string;
  /** A description of the grade scheme. */
  description?: string;
  /** The academic level the scheme applies to. */
  academicLevel?: GuidRef;
  /** The date the scheme becomes effective (YYYY-MM-DD). */
  startOn?: string;
  /** The date the scheme ceases to be effective (YYYY-MM-DD). */
  endOn?: string;
}
