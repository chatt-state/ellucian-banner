/**
 * EEDM Financial Aid resource types.
 *
 * Covers financial aid applications (v9), student awards (v11), and fund definitions
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
// Student Financial Aid Award (v11)
// ---------------------------------------------------------------------------

/** A monetary amount on a financial aid award. */
export interface FinancialAidAwardAmount {
  /** The monetary value. */
  value: number;
  /** The ISO 4217 currency code (e.g., "USD"). */
  currency: string;
}

/** The status of an award within one award period. */
export interface FinancialAidAwardPeriodStatus {
  /** The award state (e.g., "offered", "accepted", "declined", "rejected"). */
  state: string;
  /** The date the award entered this state (YYYY-MM-DD). */
  stateOn?: string;
}

/** Award amounts for one award period. */
export interface FinancialAidAwardsByPeriod {
  /** A reference to the financial aid award period. */
  awardPeriod: GuidRef;
  /** The academic periods covered by the award period. */
  academicPeriods?: GuidRef[];
  /** The award's status in this period. */
  status?: FinancialAidAwardPeriodStatus;
  /** The amounts offered, accepted, declined, rejected and disbursed. */
  amounts?: {
    originalOffered?: FinancialAidAwardAmount;
    offered?: FinancialAidAwardAmount;
    accepted?: FinancialAidAwardAmount;
    declined?: FinancialAidAwardAmount;
    rejected?: FinancialAidAwardAmount;
    disbursed?: FinancialAidAwardAmount;
  };
}

/**
 * A student financial aid award (EEDM `student-financial-aid-awards` v11;
 * `restricted-student-financial-aid-awards` has the same shape).
 *
 * Links a student to a fund for an aid year, with amounts per award period.
 */
export interface FinancialAidAward {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the award. */
  id: string;
  /** A reference to the student (person). */
  student: GuidRef;
  /** A reference to the financial aid fund. */
  awardFund: GuidRef;
  /** A reference to the aid year. */
  aidYear: GuidRef;
  /** The date the award was first offered (YYYY-MM-DD). */
  originallyOfferedOn?: string;
  /** Status and amounts broken down by award period. */
  awardsByPeriod?: FinancialAidAwardsByPeriod[];
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
