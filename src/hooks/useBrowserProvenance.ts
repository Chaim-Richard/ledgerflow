import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import type { LedgerKey } from '../lib/ledgerCollections';
import { browserProvenance, type ReportProvenance } from '../lib/reportProvenance';

/** The collections a statement worked out in the browser reads. */
export const STATEMENT_COLLECTIONS: readonly LedgerKey[] = ['transactions', 'accounts'];

/** AUD-10: the provenance of figures worked out in this browser from `keys`, from the live stores. */
export function useBrowserProvenance(keys: readonly LedgerKey[], serverError: boolean): ReportProvenance {
  const truncatedCollections = useLedgerStore(s => s.truncatedCollections);
  const isDataTruncated = useLedgerStore(s => s.isDataTruncated);
  const failed = useDataNeedsStore(s => s.failed);
  return browserProvenance(keys, { truncatedCollections: truncatedCollections || {}, isDataTruncated, failed }, serverError);
}
