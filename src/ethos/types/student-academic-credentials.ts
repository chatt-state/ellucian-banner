/**
 * EEDM Student Academic Credentials resource types (v1).
 *
 * Represents degrees, certificates, and other academic credentials
 * that have been awarded or are in progress for a student.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A discipline (major, minor, concentration) for a credential. */
export interface CredentialDiscipline {
  /** A reference to the academic-disciplines resource. */
  discipline: GuidRef;
  /** The type of discipline (e.g., "major", "minor", "concentration"). */
  type?: string;
}

/** Recognition or honors associated with a credential. */
export interface CredentialRecognition {
  /** The type of recognition (e.g., "honors", "distinction"). */
  type?: string;
  /** A reference to the recognition detail. */
  detail?: GuidRef;
}

// ---------------------------------------------------------------------------
// Main StudentAcademicCredential interface
// ---------------------------------------------------------------------------

/**
 * A student academic credential (EEDM student-academic-credentials v1).
 *
 * Represents a degree, certificate, or diploma awarded to or in progress
 * for a student at a specific academic level.
 */
export interface StudentAcademicCredential {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the credential. */
  id: string;
  /** A reference to the student (person). */
  student: GuidRef;
  /** A reference to the academic credential type (e.g., "Bachelor of Science"). */
  credential?: GuidRef;
  /** The date the credential was awarded (YYYY-MM-DD). */
  earnedOn?: string;
  /** The academic level associated with the credential. */
  academicLevel?: GuidRef;
  /** The academic period in which the credential was earned. */
  academicPeriod?: GuidRef;
  /** The disciplines (majors, minors, etc.) for the credential. */
  disciplines?: CredentialDiscipline[];
  /** Recognitions and honors awarded with the credential. */
  recognitions?: CredentialRecognition[];
  /** The cumulative GPA at time of award. */
  cumulativeGradePointAverage?: number;
  /** The thesis or dissertation title. */
  thesisTitle?: string;
}
