/** #107: an entry edit started in workspace A that fails after the user switched to B never puts
 * A's list into B; a failure in the same workspace rolls back only that entry. */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createEntryActions } from '../hooks/transactionActions/entryActions';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { makeTransaction } from './fixtures';
import { getSupabase } from '../lib/db/client';

const realFetch = globalThis.fetch;
afterEach(async () => { globalThis.fetch = realFetch; await getSupabase().auth.dispose(); });

const actions = (workspaceId: string) => createEntryActions({
  user: { uid: 'u1', getIdToken: async () => 't' }, currentWorkspaceId: workspaceId, accounts: [],
  setTransactions: useLedgerStore.getState().setTransactions, setIsSyncing: () => {}, recordAudit: async () => {}, isPeriodLocked: () => false,
} as never, { recordRulePattern: async () => {}, balanceTransactionLines: (l: unknown) => l } as never, { handleAddRule: async () => {} } as never);

test('#107: a failed edit from workspace A does not touch workspace B\'s list', async () => {
  useAuthStore.setState({ currentWorkspaceId: 'A' });
  const a1 = makeTransaction({ id: 'a1', workspaceId: 'A', description: 'A one' });
  useLedgerStore.setState({ transactions: [a1] });
  let fail: (e: Error) => void = () => {};
  globalThis.fetch = (async () => new Promise((_r, reject) => { fail = reject; })) as typeof fetch;
  const pending = actions('A').handleUpdateTransaction('a1', { description: 'edited' });
  await new Promise(r => setTimeout(r, 10));
  // the user switches books; B's list loads
  useAuthStore.setState({ currentWorkspaceId: 'B' });
  const b1 = makeTransaction({ id: 'b1', workspaceId: 'B', description: 'B one' });
  useLedgerStore.setState({ transactions: [b1] });
  fail(new Error('network down'));
  assert.equal(await pending, false);
  assert.deepEqual(useLedgerStore.getState().transactions.map(t => t.id), ['b1'], 'B keeps its own list');
});

test('#107: a failed edit in the same workspace rolls back only that entry', async () => {
  useAuthStore.setState({ currentWorkspaceId: 'A' });
  const a1 = makeTransaction({ id: 'a1', workspaceId: 'A', description: 'A one' });
  const a2 = makeTransaction({ id: 'a2', workspaceId: 'A', description: 'A two' });
  useLedgerStore.setState({ transactions: [a1, a2] });
  globalThis.fetch = (async () => { throw new Error('refused'); }) as typeof fetch;
  const pending = actions('A').handleUpdateTransaction('a1', { description: 'edited' });
  // meanwhile another entry changes (e.g. a live update)
  useLedgerStore.setState({ transactions: useLedgerStore.getState().transactions.map(t => (t.id === 'a2' ? { ...t, description: 'A two (newer)' } : t)) });
  assert.equal(await pending, false);
  const list = useLedgerStore.getState().transactions;
  assert.equal(list.find(t => t.id === 'a1')?.description, 'A one', 'the failed edit is undone');
  assert.equal(list.find(t => t.id === 'a2')?.description, 'A two (newer)', 'the other change is kept');
});
