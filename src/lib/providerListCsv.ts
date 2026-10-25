/**
 * Shared cells for the provider list readers (E-44 Xero, E-45 Wave, E-46 Zoho Books, E-47 Sage 50):
 * header-named column lookup and address joining. Nothing here validates, posts or writes —
 * each reader reshapes a provider export into the app's own columns and the existing
 * `guessMapping`/`prepareImport`/server route keep every check (recordImport.ts).
 */

/** Column-name key: case/punctuation/space-insensitive, a leading `*` (a required-field mark) ignored. */
export const columnKey = (value: string): string =>
  String(value ?? '').trim().replace(/^\*+/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The cell under the first **alias** that appears in the header (alias order wins over column order), or ''. */
export const columnText = (
  header: readonly string[],
  row: readonly string[],
  ...names: string[]
): string => {
  for (const name of names) {
    const wanted = columnKey(name);
    const index = header.findIndex(cell => columnKey(cell) === wanted);
    if (index >= 0) return String(row[index] ?? '').trim();
  }
  return '';
};

/** Street, city, state, zip and country parts joined the way the review screen shows them. */
export const joinedAddress = (...parts: string[]): string => parts.filter(Boolean).join(', ');

/** A two-part name, or '' when both parts are empty. */
export const personName = (first: string, last: string): string => [first, last].filter(Boolean).join(' ');
