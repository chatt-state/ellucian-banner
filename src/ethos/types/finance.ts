/**
 * EEDM Finance resource types.
 *
 * Covers accounting strings (v12) and ledger activities used for
 * institutional financial record keeping.
 *
 * @see https://resources.elluciancloud.com/ethos-data-model
 */

import type { EedmMetadata, GuidRef } from "./common.js";

// ---------------------------------------------------------------------------
// Accounting String (v12)
// ---------------------------------------------------------------------------

/** A component of an accounting string (e.g., fund, org, account). */
export interface AccountingStringComponent {
  /** A reference to the component. */
  id: string;
  /** The value of the component. */
  value?: string;
  /** A description of the component. */
  description?: string;
  /** The type of the component (e.g., "fund", "organization", "account", "program"). */
  type?: string;
}

/**
 * An accounting string (EEDM accounting-strings v12).
 *
 * Represents a chart-of-accounts string used for tracking financial
 * transactions within the institution's general ledger.
 */
export interface AccountingString {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the accounting string. */
  id: string;
  /** The accounting string value (e.g., "11-00-1000-50000"). */
  accountingString?: string;
  /** A description of the accounting string. */
  description?: string;
  /** The component segments of the accounting string. */
  components?: AccountingStringComponent[];
  /** The status of the accounting string (e.g., "available", "unavailable"). */
  status?: string;
}

// ---------------------------------------------------------------------------
// Ledger Activity
// ---------------------------------------------------------------------------

/** An amount with currency. */
export interface CurrencyAmount {
  /** The monetary value. */
  value?: number;
  /** The ISO 4217 currency code (e.g., "USD"). */
  currency?: string;
}

/**
 * A ledger activity record.
 *
 * Represents a financial transaction posted to the general ledger.
 */
export interface LedgerActivity {
  /** Metadata about the JSON payload. */
  metadata?: EedmMetadata;
  /** A globally unique identifier (GUID) for the ledger activity. */
  id: string;
  /** A reference to the accounting string. */
  accountingString?: GuidRef;
  /** A reference to the fiscal year. */
  fiscalYear?: GuidRef;
  /** A reference to the fiscal period. */
  fiscalPeriod?: GuidRef;
  /** The type of ledger entry (e.g., "budget", "actual", "encumbrance"). */
  type?: string;
  /** The transaction date (YYYY-MM-DD). */
  transactionDate?: string;
  /** The amount of the transaction. */
  amount?: CurrencyAmount;
  /** A description of the transaction. */
  description?: string;
}
