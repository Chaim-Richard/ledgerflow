/**
 * E-45: Wave **customers** CSV → the app's own import columns.
 *
 * Wave documents exactly one list CSV: its customers file (Sales & Payments → Customers →
 * Import or Export; the upload template Wave publishes at support.waveapps.com
 * /hc/en-us/articles/208623076, whose columns the Wave Connect add-on repeats:
 * `Customer Name`, `First Name`, `Last Name`, `Email`, `Phone`, `Mobile`, `Fax`, `Website`,
 * `Currency`, address lines, `City`, `Province/State`, `Country`, `Postal/Zip Code`,
 * `Account Number`, `Notes`). This reader is header-driven over those names; a file whose
 * headers do not match fails the required-name check instead of being guessed.
 *
 * Scope, said honestly and on the screen:
 * - Wave has no vendor CSV export to key a header read on, and Wave's chart-of-accounts names
 *   (its own account types) are already recognised by the shared account-type parser
 *   (`parseAccountType`, CE-09/BK-03), so Wave chart CSVs ride the standard spreadsheet source.
 *   Wave's accountants' data download is a transactions/money export — not a list import, and
 *   deliberately not touched here (a list importer never posts).
 * - Names: `Customer Name` wins, then `Business`, then the person's first and last name
 *   (Wave's own import requires at least one of company/first/last name, per the same page).
 * - Currency: left as found; Wave's template documents that a blank currency becomes the
 *   business default — we keep it blank rather than invent one, and the shared importer leaves
 *   a blank currency out of the record.
 *
 * Nothing here validates, posts or writes: the reshaped table goes through the same
 * `guessMapping` / `prepareImport` / checked server route as every other CSV.
 */
import type { ImportKind } from './recordImport';
import { columnText, joinedAddress, personName } from './providerListCsv';

const CUSTOMERS_HEADER = ['Name', 'Email', 'Phone', 'Address', 'Currency', 'Notes'];

/** Pure normalization; validation, duplicates, permissions and the write stay where they are. */
export function normalizeWaveCsv(kind: ImportKind, table: readonly (readonly string[])[]): string[][] {
  if (!table.length || kind !== 'customers') {
    // Only the documented Wave customers CSV is normalised; anything else goes through unchanged
    // so the ordinary header-alias review reads it (Wave chart CSVs via parseAccountType).
    return table.map(row => [...row]);
  }
  const [header, ...rows] = table;
  return [
    CUSTOMERS_HEADER,
    ...rows.map(row => [
      columnText(header, row, 'Customer Name', 'Business', 'Business Name', 'Company', 'Company Name') ||
        personName(columnText(header, row, 'First Name'), columnText(header, row, 'Last Name')),
      columnText(header, row, 'Email', 'Email Address'),
      columnText(header, row, 'Phone') || columnText(header, row, 'Mobile'),
      joinedAddress(
        columnText(header, row, 'Address Line 1', 'Address Line One', 'Street Address'),
        columnText(header, row, 'Address Line 2', 'Address Line Two'),
        columnText(header, row, 'City'),
        columnText(header, row, 'Province/State', 'State/Province', 'Province', 'State'),
        columnText(header, row, 'Postal/Zip Code', 'Zip/Postal Code', 'Postal Code', 'Zip'),
        columnText(header, row, 'Country'),
      ),
      columnText(header, row, 'Currency', 'Currency Code'),
      columnText(header, row, 'Notes', 'Memo'),
    ]),
  ];
}
