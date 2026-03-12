/**
 * EEDM HR resource types.
 *
 * Covers employees (v12), positions, and jobs used for
 * human resources management.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Employee (v12)
// ---------------------------------------------------------------------------

/**
 * An employee record (EEDM employees v12).
 *
 * Represents a person's employment relationship with the institution.
 */
export interface Employee {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the employee. */
  id: string;
  /** A reference to the associated person. */
  person: GuidRef;
  /** The employee status (e.g., "active", "leave", "terminated"). */
  status?: string;
  /** The employee contract type (e.g., "fullTime", "partTime"). */
  contract?: EmployeeContract;
  /** The date employment started (YYYY-MM-DD). */
  startOn?: string;
  /** The date employment ended (YYYY-MM-DD). */
  endOn?: string;
  /** The home department or organizational unit. */
  homeDepartment?: GuidRef;
}

/** Contract details for an employee. */
export interface EmployeeContract {
  /** The type of contract (e.g., "fullTime", "partTime", "contractual"). */
  type?: string;
  /** A reference to a more specific contract detail. */
  detail?: GuidRef;
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

/**
 * A position (EEDM positions v12).
 *
 * Represents an institutional position that can be filled by an employee.
 */
export interface Position {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the position. */
  id: string;
  /** The position code. */
  code?: string;
  /** The human-readable title of the position. */
  title?: string;
  /** A description of the position. */
  description?: string;
  /** A reference to the department. */
  department?: GuidRef;
  /** The status of the position (e.g., "active", "frozen", "cancelled"). */
  status?: string;
  /** Whether the position is exempt from overtime. */
  exemptionType?: string;
  /** The date the position becomes available (YYYY-MM-DD). */
  startOn?: string;
  /** The date the position is no longer available (YYYY-MM-DD). */
  endOn?: string;
  /** The authorized full-time equivalency for this position. */
  authorizedOn?: string;
  /** Whether this is a supervisory position. */
  supervisorPosition?: GuidRef;
}

// ---------------------------------------------------------------------------
// Job
// ---------------------------------------------------------------------------

/**
 * A job assignment (EEDM jobs v12).
 *
 * Represents the assignment of a person to a specific position, including
 * pay information and schedule.
 */
export interface Job {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the job. */
  id: string;
  /** A reference to the person holding the job. */
  person: GuidRef;
  /** A reference to the position. */
  position?: GuidRef;
  /** A reference to the department. */
  department?: GuidRef;
  /** The job title. */
  title?: string;
  /** The status of the job (e.g., "active", "leave", "terminated"). */
  status?: string;
  /** Whether this is the primary job for the person. */
  primary?: boolean;
  /** The date the job assignment starts (YYYY-MM-DD). */
  startOn?: string;
  /** The date the job assignment ends (YYYY-MM-DD). */
  endOn?: string;
  /** The full-time equivalency for this job. */
  fullTimeEquivalency?: number;
  /** Hours worked per period. */
  hoursPerPeriod?: number;
  /** The pay status (e.g., "partialPay", "withPay", "withoutPay"). */
  payStatus?: string;
  /** The pay class (e.g., "hourly", "salary"). */
  payClass?: string;
}
