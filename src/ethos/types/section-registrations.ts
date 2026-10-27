/**
 * EEDM Section Registrations resource types (v16).
 *
 * Represents enrollment records linking a student to a course section,
 * including registration status, credits, and grade information.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { Credit, EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** The approval status of a section registration. */
export interface RegistrationApproval {
  /** The type of approval (e.g., "all", "instructorConsent"). */
  type?: string;
  /** A reference to the approving entity. */
  approvedBy?: GuidRef;
}

/**
 * Status information for a section registration.
 *
 * To answer "is this student registered for this section?", test
 * `registrationStatus === "registered"`. Dropped and withdrawn registrations
 * have `registrationStatus: "notRegistered"`; the reason (dropped, withdrawn,
 * ...) is in `sectionRegistrationStatusReason`.
 */
export interface RegistrationStatus {
  /** Whether the student is registered: `"registered"` or `"notRegistered"`. */
  registrationStatus: "registered" | "notRegistered";
  /**
   * Why the registration has this status, e.g. "registered", "dropped",
   * "withdrawn", "auditing", "pass", "incomplete" (EEDM enumeration).
   */
  sectionRegistrationStatusReason?: string;
  /** The institution's own registration status code (Banner STVRSTS), as a GUID reference. */
  detail?: GuidRef;
}

/** A grade outcome for a section registration. */
export interface RegistrationGrade {
  /** The type of grade (e.g., "midterm", "final"). */
  type?: string;
  /** A reference to the grade. */
  grade?: GuidRef;
  /** The date the grade was submitted (YYYY-MM-DD). */
  submittedOn?: string;
  /** A reference to the person who submitted the grade. */
  submittedBy?: GuidRef;
}

/** The involvement details for a section registration. */
export interface RegistrationInvolvement {
  /** The date the student first attended (YYYY-MM-DD). */
  startOn?: string;
  /** The date the student last attended (YYYY-MM-DD). */
  endOn?: string;
}

// ---------------------------------------------------------------------------
// Main SectionRegistration interface
// ---------------------------------------------------------------------------

/**
 * A section registration record (EEDM section-registrations v16).
 *
 * Links a student (registrant) to a section with status, credits, and grades.
 */
export interface SectionRegistration {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the registration. */
  id: string;
  /** A reference to the registrant (person). */
  registrant: GuidRef;
  /** A reference to the section. */
  section: GuidRef;
  /** The current status of the registration. */
  status?: RegistrationStatus;
  /** The date the current status took effect (YYYY-MM-DD). */
  statusDate?: string;
  /** Approval information for the registration. */
  approvals?: RegistrationApproval[];
  /** Credit information for the registration. */
  credit?: Credit;
  /** The grade scheme used for this registration. */
  gradeScheme?: GuidRef;
  /** Grades associated with this registration. */
  grades?: RegistrationGrade[];
  /** Involvement (attendance) details. */
  involvement?: RegistrationInvolvement;
  /** The academic level for this registration. */
  academicLevel?: GuidRef;
  /** The date the registration was originally created (YYYY-MM-DD). */
  originallyRegisteredOn?: string;
}
