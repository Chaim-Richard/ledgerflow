/** Comparison-only folding. Keep original labels, stored IDs and import fingerprints intact. */
export function normalizeSearchText(text: string | null | undefined): string {
  return (text || '').normalize('NFC').toLowerCase()
    // Hebrew vocalization/cantillation and invisible direction controls aren't search terms.
    .replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

/** Read a quoted directive value without changing its data. */
export function unquoteSearchValue(value: string): string {
  return value.replace(/^(?:"([^"]*)"|'([^']*)')$/, (_match, double: string | undefined, single: string | undefined) => double ?? single ?? value);
}
