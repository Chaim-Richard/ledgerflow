/**
 * E-48: explain one spreadsheet import by row counts, not by inferred ledger amounts.
 * A row-count match is not accounting reconciliation or proof of durable balances.
 * Values here come from the source preview and the authenticated import response.
 */
export interface ImportCountInput {
  sourceRows: number;
  preparedRows: number;
  created: number;
  skipped: number;
}

export interface ImportCountResult {
  sourceRows: number;
  preparedRows: number;
  excludedBeforeSubmit: number;
  created: number;
  skipped: number;
  accountedFor: number;
  unexplained: number;
  status: 'counts-explained' | 'review-required' | 'unavailable';
}

export function reconcileImportCounts(input: ImportCountInput): ImportCountResult {
  const { sourceRows, preparedRows, created, skipped } = input;
  const valid = [sourceRows, preparedRows, created, skipped].every(
    value => Number.isSafeInteger(value) && value >= 0,
  ) && preparedRows <= sourceRows && preparedRows > 0 &&
    Number.isSafeInteger(created + skipped);
  const accountedFor = valid ? created + skipped : 0;
  const unexplained = valid ? preparedRows - accountedFor : 0;
  return {
    sourceRows,
    preparedRows,
    excludedBeforeSubmit: valid ? sourceRows - preparedRows : 0,
    created,
    skipped,
    accountedFor,
    unexplained,
    status: !valid ? 'unavailable' : unexplained === 0 && sourceRows === preparedRows
      ? 'counts-explained' : 'review-required',
  };
}
