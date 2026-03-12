/**
 * EEDM Financial Aid resource types.
 *
 * Covers financial aid applications (v9), awards, and fund definitions
 * used to track student financial assistance.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Financial Aid Application (v9)
// ---------------------------------------------------------------------------

/**
 * A financial aid application (EEDM financial-aid-applications v9).
 *
 * Represents a student's application for financial assistance during
 * a specific aid year.
 */
export interface FinancialAidApplication {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the application. */
  id: string;
  /** A reference to the applicant (person). */
  applicant: GuidRef;
  /** A reference to the aid year. */
  aidYear: GuidRef;
  /** The methodology used to determine need (e.g., "federal", "institutional"). */
  methodology?: string;
  /** The applicant's expected family contribution. */
  expectedFamilyContribution?: number;
  /** The total estimated cost of attendance. */
  totalEstimatedCostOfAttendance?: number;
  /** The applicant's financial need. */
  totalNeed?: number;
}

// ---------------------------------------------------------------------------
// Financial Aid Award
// ---------------------------------------------------------------------------

/**
 * A financial aid award record.
 *
 * Links a student to a specific fund for an aid year with an amount.
 */
export interface FinancialAidAward {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the award. */
  id: string;
  /** A reference to the student (person). */
  student: GuidRef;
  /** A reference to the aid year. */
  aidYear: GuidRef;
  /** A reference to the financial aid fund. */
  fund: GuidRef;
  /** The amount of the award in the institutional currency. */
  amount?: number;
  /** The status of the award (e.g., "offered", "accepted", "declined"). */
  status?: string;
}

// ---------------------------------------------------------------------------
// Financial Aid Fund
// ---------------------------------------------------------------------------

/**
 * A financial aid fund definition.
 *
 * Describes a source of financial aid such as a grant, loan, or scholarship.
 */
export interface FinancialAidFund {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the fund. */
  id: string;
  /** The fund code. */
  code?: string;
  /** The human-readable title of the fund. */
  title?: string;
  /** A description of the fund. */
  description?: string;
  /** The category of financial aid (e.g., "grant", "loan", "scholarship", "work"). */
  category?: string;
  /** The source of the fund (e.g., "federal", "state", "institutional"). */
  source?: string;
}
