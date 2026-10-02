import { useEffect } from 'react';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useAuthStore } from '../stores/useAuthStore';
import type { LedgerKey } from '../lib/ledgerCollections';

/**
 * A screen that reads these collections from useLedgerStore asks for them here; they load the first
 * time any screen asks and then stay live (src/lib/ledgerCollections.ts). Returns `loading` until
 * every one of them has arrived for the open workspace.
 */
export function useLedgerCollections(...keys: LedgerKey[]): { loading: boolean } {
  const ask = useDataNeedsStore(s => s.ask);
  const loaded = useDataNeedsStore(s => s.loaded);
  // demo mode has no database: what the demo seeded is all there is
  const isGuest = useAuthStore(s => s.isGuest && !s.user);
  const id = keys.join(',');

  useEffect(() => {
    ask(id.split(',').filter(Boolean) as LedgerKey[]);
  }, [ask, id]);

  return { loading: !isGuest && keys.some(k => !loaded[k]) };
}
