/**
 * EEDM Instructional Events resource types (v11).
 *
 * Represents class meeting patterns including recurrence rules,
 * locations, and instructor assignments for a section.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef, NamedRef } from "./common.js";

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

/** A day-of-week recurrence pattern. */
export interface RecurrenceTimePeriod {
  /** The day of the week (e.g., "monday", "wednesday", "friday"). */
  day?: string;
}

/** The recurrence schedule for an instructional event. */
export interface InstructionalEventRecurrence {
  /** The recurrence time periods (meeting days). */
  timePeriod?: RecurrenceTimePeriod;
  /** How often the event repeats (e.g., "weekly"). */
  repeatRule?: RepeatRule;
}

/** A repeat rule defining the frequency of recurrence. */
export interface RepeatRule {
  /** The repeat type (e.g., "weekly"). */
  type?: string;
  /** The interval between occurrences. */
  interval?: number;
  /** The days of the week for weekly recurrence. */
  daysOfWeek?: string[];
  /** The end date for the recurrence (YYYY-MM-DD). */
  ends?: RepeatRuleEnds;
}

/** When a repeat rule ends. */
export interface RepeatRuleEnds {
  /** The date the repetition ends (YYYY-MM-DD). */
  date?: string;
  /** The number of repetitions. */
  repetitions?: number;
}

/** A location where an instructional event is held. */
export interface InstructionalEventLocation {
  /** A reference to the room or location resource. */
  location?: NamedRef;
}

/** An instructor assigned to an instructional event. */
export interface InstructionalEventInstructor {
  /** A reference to the instructor (person). */
  instructor: GuidRef;
  /** The role of the instructor (e.g., "primary", "secondary"). */
  instructorRole?: string;
  /** The percentage of the workload assigned to this instructor. */
  workLoadPercentage?: number;
  /** The responsibility percentage for this instructor. */
  responsibilityPercentage?: number;
}

// ---------------------------------------------------------------------------
// Main InstructionalEvent interface
// ---------------------------------------------------------------------------

/**
 * An instructional event (EEDM instructional-events v11).
 *
 * Describes a class meeting pattern for a section, including the days, times,
 * locations, and instructors.
 */
export interface InstructionalEvent {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the instructional event. */
  id: string;
  /** A reference to the section this event belongs to. */
  section: GuidRef;
  /** The instructional method (e.g., "Lecture", "Lab"). */
  instructionalMethod?: GuidRef;
  /** The workload expressed as hours. */
  workload?: number;
  /** The recurrence pattern for the event. */
  recurrence?: InstructionalEventRecurrence;
  /** The locations where the event meets. */
  locations?: InstructionalEventLocation[];
  /** The instructors assigned to the event. */
  instructors?: InstructionalEventInstructor[];
  /** The start time of the event (HH:MM:SS). */
  startOn?: string;
  /** The end time of the event (HH:MM:SS). */
  endOn?: string;
}
