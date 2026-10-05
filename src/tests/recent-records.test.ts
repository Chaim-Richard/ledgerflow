import './helpers/dom';
import test from 'node:test';
import assert from 'node:assert/strict';
import { useRecentRecordsStore, startRecentRecordTracking } from '../stores/useRecentRecordsStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { setComponentWorkspace } from './helpers/componentFixtures';

test('recent records retain ten distinct opens, persist and isolate users and workspaces', () => {
  localStorage.clear(); setComponentWorkspace(); useUIStore.setState({ focusRecord: null });
  const stop = startRecentRecordTracking();
  try {
    for (let i = 0; i < 12; i++) useUIStore.getState().openRecord({ type: 'transaction', id: `tx-${i}` });
    assert.equal(useRecentRecordsStore.getState().records.length, 10);
    useUIStore.getState().openRecord({ type: 'transaction', id: 'tx-5' });
    assert.equal(useRecentRecordsStore.getState().records[0].id, 'tx-5');
    assert.equal(new Set(useRecentRecordsStore.getState().records.map(r => r.id)).size, 10);
    const originalKey = useRecentRecordsStore.getState().key;
    assert.equal(JSON.parse(localStorage.getItem(originalKey) || '[]')[0].id, 'tx-5');
    const originalUser = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...originalUser, uid: 'other-user' } });
    assert.deepEqual(useRecentRecordsStore.getState().records, []);
    useUIStore.getState().openRecord({ type: 'invoice', id: 'other-invoice' });
    useAuthStore.setState({ user: originalUser });
    assert.equal(useRecentRecordsStore.getState().records[0].id, 'tx-5');
    useAuthStore.setState({ currentWorkspaceId: 'other-workspace' });
    assert.deepEqual(useRecentRecordsStore.getState().records, []);
    useAuthStore.setState({ currentWorkspaceId: 'component-workspace' });
    assert.equal(useRecentRecordsStore.getState().records[0].id, 'tx-5');
  } finally { stop(); stop(); }
  useUIStore.getState().openRecord({ type: 'bill', id: 'after-stop' });
  assert.equal(useRecentRecordsStore.getState().records[0].id, 'tx-5');
});
test('invalid stored references are ignored and multiple tracking owners can clean up independently', () => {
  localStorage.clear(); setComponentWorkspace(); useUIStore.setState({ focusRecord: null });
  localStorage.setItem('lf_recent_records:test-user:component-workspace', JSON.stringify([{ type: 'bogus', id: 'bad' }, { type: 'invoice', id: 'valid' }, { type: 'invoice', id: 'valid' }]));
  useRecentRecordsStore.setState({ key: 'force-reload', records: [] });
  const first = startRecentRecordTracking(), second = startRecentRecordTracking();
  assert.deepEqual(useRecentRecordsStore.getState().records, [{ type: 'invoice', id: 'valid' }]);
  first(); useUIStore.getState().openRecord({ type: 'account', id: 'cash' });
  assert.equal(useRecentRecordsStore.getState().records[0].id, 'cash'); second();
});
