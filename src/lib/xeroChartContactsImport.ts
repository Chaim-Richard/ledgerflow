/**
 * E-44 (chart and contacts — invoices are E-28's `xeroDocumentsImport.ts`):
 * Xero **Chart of Accounts export** CSV and **Contacts** CSV → the app's own import columns.
 *
 * Column names are the documented ones from Xero Central:
 * - Chart of accounts (Accounting → Chart of accounts → Export; the same layout the import
 *   template uses, with required columns starred): `*Code`, `*Name`, `*Type`, `Tax Code`,
 *   `Description` (small business guides: https://central.xero.com/0/article/Export-or-print-your-chart-of-accounts,
 *   https://central.xero.com/s/article/Import-a-chart-of-accounts).
 * - Contacts (the customer's/supplier's CSV template): `*Name`, `AccountNumber`, `EmailAddress`,
 *   `POAddressLine1…4`, `POCity`, `PORegion`, `POPostalCode`, `POCountry`, `PhoneNumber`,
 *   `FaxNumber`, `MobileNumber`, `DDI`, `TaxNumber`. Names are keyed without the `*` — Xero stars
 *   required columns and both spellings appear in real exports.
 *
 * Honesty rules, same as the other list readers: everything is looked up **by header name**,
 * never by position; a file whose headers do not match fails the required-name check instead of
 * being guessed; `Type` text passes straight to the shared account-type parser (an unknown Xero
 * type becomes a visible row error, not a guessed type); no transactions, balances or YTD
 * figures are imported (Xero's export does not carry YTD, and it would not be posted anyway).
 * Xero contacts are mixed customers and suppliers in one file — the screen asks which list the
 * user is importing, so nothing is reclassified.
 */
import type { ImportKind } from './recordImport';
import { columnText, joinedAddress, personName } from './providerListCsv';

const ACCOUNTS_HEADER = ['Name', 'Code', 'Type', 'Category', 'Subtype', 'Description', 'Currency'];
const CONTACTS_HEADER = ['Name', 'Email', 'Phone', 'Address', 'Tax ID'];

/** The Xero contact's mailing (PO) address parts, joined for the review table. */
const poAddress = (header: readonly string[], row: readonly string[]): string =>
  joinedAddress(
    columnText(header, row, 'POAddressLine1'),
    columnText(header, row, 'POAddressLine2'),
    columnText(header, row, 'POAddressLine3'),
    columnText(header, row, 'POAddressLine4'),
    columnText(header, row, 'POCity'),
    columnText(header, row, 'PORegion'),
    columnText(header, row, 'POPostalCode'),
    columnText(header, row, 'POCountry'),
  );

/** `*Name`, else the contact's person name (FirstName LastName) — a company-less contact. */
const contactName = (header: readonly string[], row: readonly string[]): string =>
  columnText(header, row, 'Name') ||
  personName(columnText(header, row, 'FirstName'), columnText(header, row, 'LastName'));

const contactPhone = (header: readonly string[], row: readonly string[]): string =>
  columnText(header, row, 'PhoneNumber') || columnText(header, row, 'MobileNumber');

/** Pure normalization; validation, duplicates, permissions and the write stay where they are. */
export function normalizeXeroCsv(kind: ImportKind, table: readonly (readonly string[])[]): string[][] {
  if (!table.length) return [];
  const [header, ...rows] = table;

  if (kind === 'accounts') {
    return [
      ACCOUNTS_HEADER,
      ...rows.map(row => [
        columnText(header, row, 'Name'),
        columnText(header, row, 'Code'),
        columnText(header, row, 'Type'),
        '', // the shared parser reads the category from the account type, a category column is not overwritten
        columnText(header, row, 'Subtype', 'Sub Type'),
        columnText(header, row, 'Description'),
        '', // an account currency is the organisation's, not a row figure — never invented
      ]),
    ];
  }

  if (kind === 'customers' || kind === 'vendors') {
    // Same columns for both lists: a Xero contacts file is mixed; the screen asks which list it is.
    return [
      CONTACTS_HEADER,
      ...rows.map(row => [
        contactName(header, row),
        columnText(header, row, 'EmailAddress'),
        contactPhone(header, row),
        poAddress(header, row),
        columnText(header, row, 'TaxNumber'),
      ]),
    ];
  }

  // Xero items (its inventory template) are not part of E-44; the standard template path reads
  // them by header aliases already. Declaring it here would be a claim about a template we have
  // not shaped a fixture on.
  return table.map(row => [...row]);
}
