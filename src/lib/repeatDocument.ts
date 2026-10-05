/**
 * "Same as last time" (I-23): a new invoice or bill can copy the lines of the latest one for the
 * same customer or vendor, so repeat billing is one click. Voided documents and ones without
 * lines are skipped; the newest by date (then by when it was made) wins.
 */
export function latestDocumentFor<T extends { date?: string; createdAt?: string; status?: string }>(
  docs: T[], belongs: (doc: T) => boolean, lines: (doc: T) => unknown[] | undefined,
): T | null {
  return docs
    .filter(d => belongs(d) && d.status !== 'void' && (lines(d)?.length || 0) > 0)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
}
