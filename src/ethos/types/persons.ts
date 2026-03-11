/**
 * EEDM Persons resource types (v12).
 *
 * Represents biographical and demographic data for individuals known to an
 * institution. This is one of the most heavily used EEDM resources and
 * includes names, addresses, phones, emails, credentials, and roles.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

/** The type classification of a person name. */
export interface PersonNameType {
  /** The category of the name (e.g., "personal", "birth", "legal"). */
  category: string;
  /** A reference to a more specific name type. */
  detail?: GuidRef;
}

/**
 * A name associated with a person.
 *
 * At least one name with category "legal" is required per person.
 */
export interface PersonName {
  /** The type classification of the name. */
  type: PersonNameType;
  /** Indicates whether this is the preferred name of the given type. */
  preference?: string;
  /** The full display name. */
  fullName?: string;
  /** The person's title (e.g., "Mr.", "Dr."). */
  title?: string;
  /** The person's first (given) name. */
  firstName?: string;
  /** The person's middle name. */
  middleName?: string;
  /** A prefix to the last name (e.g., "van", "de"). */
  lastNamePrefix?: string;
  /** The person's last (family) name. */
  lastName?: string;
  /** A pedigree suffix (e.g., "Jr.", "III"). */
  pedigree?: string;
  /** Post-nominal professional abbreviations (e.g., "Ph.D.", "M.D."). */
  professionalAbbreviations?: string[];
}

// ---------------------------------------------------------------------------
// Credential
// ---------------------------------------------------------------------------

/**
 * An identifying credential for a person within a system.
 *
 * Common credential types include bannerId, colleaguePersonId, and ssn.
 */
export interface PersonCredential {
  /** The type of credential (e.g., "bannerId", "ssn", "colleaguePersonId"). */
  type: string;
  /** The credential value. */
  value: string;
  /** The date the credential becomes valid. */
  startOn?: string;
  /** The date the credential ceases to be valid. */
  endOn?: string;
}

/**
 * An alternative credential that uniquely identifies a person.
 *
 * Used for non-primary identification such as elevateId.
 */
export interface PersonAlternativeCredential {
  /** The type of alternative credential. */
  type: GuidRef;
  /** The credential value. */
  value: string;
}

// ---------------------------------------------------------------------------
// Contact information
// ---------------------------------------------------------------------------

/** The type classification of a contact method (email, phone, address). */
export interface ContactType {
  /** The standard type (e.g., "personal", "business", "home", "mobile"). */
  type: string;
  /** An optional custom type for further identification. */
  detail?: GuidRef;
}

/** An email address associated with a person. */
export interface PersonEmail {
  /** The type of email address. */
  type: ContactType;
  /** The email address string. */
  address: string;
  /** Indicates the email preference ("primary" if preferred). */
  preference?: string;
}

/** A phone number associated with a person. */
export interface PersonPhone {
  /** The type of phone (e.g., "mobile", "home"). */
  type: ContactType;
  /** The phone number. */
  number: string;
  /** The international country calling code. */
  countryCallingCode?: string;
  /** The phone extension. */
  extension?: string;
  /** The preference indicator. */
  preference?: string;
}

/** A physical or mailing address associated with a person. */
export interface PersonAddress {
  /** The address details. */
  address: AddressDetail;
  /** The type of address (e.g., "home", "school", "mailing"). */
  type: ContactType;
  /** The date the address became valid. */
  startOn?: string;
  /** The date the address ceased to be valid. */
  endOn?: string;
  /** Indicates address preference ("primary" if preferred). */
  preference?: string;
  /** Seasons when this address is typically occupied. */
  seasonalOccupancies?: SeasonalOccupancy[];
}

/** The physical details of an address. */
export interface AddressDetail {
  /** A globally unique identifier for the address. */
  id?: string;
  /** Address line items. */
  addressLines?: string[];
  /** The municipality or city. */
  place?: AddressPlace;
  /** The country. */
  country?: AddressCountry;
  /** The latitude of the address. */
  latitude?: number;
  /** The longitude of the address. */
  longitude?: number;
}

/** The place component of an address. */
export interface AddressPlace {
  /** The country sub-region. */
  country: AddressCountry;
}

/** The country component of an address. */
export interface AddressCountry {
  /** The ISO 3166-1 alpha-3 country code. */
  code?: string;
  /** The locality (city or town). */
  locality?: string;
  /** The region (state or province). */
  region?: AddressRegion;
  /** The sub-region. */
  subRegion?: AddressRegion;
  /** The postal code. */
  postalCode?: string;
  /** The title of the country. */
  title?: string;
}

/** A region within a country (state, province). */
export interface AddressRegion {
  /** The region code. */
  code?: string;
  /** The human-readable region title. */
  title?: string;
}

/** A time range during which an address is seasonally occupied. */
export interface SeasonalOccupancy {
  /** The day and month the occupancy begins (MM-DD). */
  startOn?: string;
  /** The day and month the occupancy ends (MM-DD). */
  endOn?: string;
}

// ---------------------------------------------------------------------------
// Social media
// ---------------------------------------------------------------------------

/** A social media account associated with a person. */
export interface PersonSocialMedia {
  /** The type of social media (e.g., "twitter", "facebook"). */
  type: ContactType;
  /** The social media address or handle. */
  address: string;
  /** Indicates social media preference. */
  preference?: string;
}

// ---------------------------------------------------------------------------
// Roles, Ethnicity, Race, Language, Interests
// ---------------------------------------------------------------------------

/** A role a person fills at the institution (e.g., "student", "instructor"). */
export interface PersonRole {
  /** The role type (e.g., "student", "instructor", "employee", "vendor", "alumni"). */
  role: string;
  /** The date the role started. */
  startOn?: string;
  /** The date the role ended. */
  endOn?: string;
}

/** Ethnicity information for a person. */
export interface PersonEthnicity {
  /** The ethnicity group reference. */
  ethnicGroup?: GuidRef;
  /** Reporting values for the ethnicity. */
  reporting?: EthnicityReporting[];
}

/** A reporting value for ethnicity (e.g., US federal). */
export interface EthnicityReporting {
  /** The reporting country. */
  country?: GuidRef;
  /** The ethnicity reporting category. */
  ethnicCategory?: string;
}

/** A racial group associated with a person. */
export interface PersonRace {
  /** A reference to the racial group. */
  race: GuidRef;
  /** Reporting values for the race. */
  reporting?: RaceReporting[];
}

/** A reporting value for race. */
export interface RaceReporting {
  /** The reporting country. */
  country?: GuidRef;
  /** The race reporting category. */
  racialCategory?: string;
}

/** A language a person has proficiency in. */
export interface PersonLanguage {
  /** A reference to the language. */
  code: string;
  /** The preference for the language. */
  preference?: string;
}

/** An identity document associated with a person. */
export interface PersonIdentityDocument {
  /** The type of identity document. */
  type?: GuidRef;
  /** The country of issue. */
  countryIssuingCode?: string;
  /** The document ID number. */
  documentId?: string;
  /** The expiration date of the document. */
  expiresOn?: string;
}

/** An interest recorded for a person. */
export interface PersonInterest {
  /** A reference to the interest. */
  interest: GuidRef;
}

// ---------------------------------------------------------------------------
// Main Person interface
// ---------------------------------------------------------------------------

/**
 * A person known to the institution (EEDM persons v12).
 *
 * Contains biographical, demographic, and contact information. This resource
 * is the foundation for students, instructors, employees, and other roles.
 */
export interface Person {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the person. */
  id: string;
  /** Privacy status of the person's information. */
  privacyStatus?: GuidRef | string;
  /** The names associated with the person, specified by type. */
  names: PersonName[];
  /** The date when the person was born (YYYY-MM-DD). */
  dateOfBirth?: string;
  /** The date when the person died (YYYY-MM-DD). */
  dateDeceased?: string;
  /** The biological sex of the person (e.g., "male", "female"). */
  gender?: string;
  /** The person's self-selected gender identity. */
  genderIdentity?: GuidRef;
  /** The person's self-selected pronoun. */
  personalPronoun?: GuidRef;
  /** The religion of the person. */
  religion?: GuidRef;
  /** The ethnicity of the person. */
  ethnicity?: PersonEthnicity;
  /** The racial groups to which the person belongs. */
  races?: PersonRace[];
  /** Languages the person has proficiency in. */
  languages?: PersonLanguage[];
  /** The current marital status of the person. */
  maritalStatus?: GuidRef;
  /** The veteran status of the person. */
  veteranStatus?: GuidRef;
  /** The citizenship status of the person at the institution location. */
  citizenshipStatus?: GuidRef;
  /** The ISO 3166-1 alpha-3 code of the person's country of birth. */
  countryOfBirth?: string;
  /** The ISO 3166-1 alpha-3 code of the person's citizenship country. */
  citizenshipCountry?: string;
  /** The roles the person fills at the institution. */
  roles?: PersonRole[];
  /** Government-issued identity documents. */
  identityDocuments?: PersonIdentityDocument[];
  /** Credentials that identify the person within systems. */
  credentials?: PersonCredential[];
  /** Alternative credentials for the person. */
  alternativeCredentials?: PersonAlternativeCredential[];
  /** Interests recorded for the person. */
  interests?: PersonInterest[];
  /** Physical and mailing addresses. */
  addresses?: PersonAddress[];
  /** Phone numbers. */
  phones?: PersonPhone[];
  /** Email addresses. */
  emails?: PersonEmail[];
  /** Social media accounts. */
  socialMedia?: PersonSocialMedia[];
}
