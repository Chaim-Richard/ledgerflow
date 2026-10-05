/**
 * Archive, restore and delete a customer or vendor from its list (I-22): archive hides it from the
 * list (records keep it); delete goes to the server, which refuses a contact that is in use.
 */
import { stubFetchWithBodies } from './helpers/dom';
import test, { afterEach, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PartyRowActions, { ArchivedBadge, ShowArchivedToggle } from '../components/common/PartyRowActions';
import { isArchivedParty } from '../lib/contacts';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { makeCustomer, makeVendor } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';

const acme = makeCustomer({ id: 'c1', name: 'Acme' });
const asked: string[] = [];

describe('Contact row actions', () => {
  beforeEach(() => {
    setComponentWorkspace('bookkeeper');
    useLedgerStore.setState({ customers: [acme, makeCustomer({ id: 'c2', name: 'Beta' })], vendors: [makeVendor({ id: 'v1', name: 'Paper Co' })] });
    asked.length = 0;
    window.confirm = (message?: string) => { asked.push(String(message)); return true; };
  });
  afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });

  test('archive saves the status; an archived one can be restored', async () => {
    const calls = stubFetchWithBodies(200, {});
    render(<PartyRowActions side="customer" party={acme} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Archive Acme' })); });
    await waitFor(() => assert.ok(calls.some(c => c.url.includes('/rpc/lf_update'))));
    const update = calls.find(c => c.url.includes('/rpc/lf_update'))!.body as { p_table: string; p_id: string; p_set: Record<string, unknown> };
    assert.deepEqual([update.p_table, update.p_id, update.p_set.status], ['customers', 'c1', 'inactive']);
    cleanup();
    render(<PartyRowActions side="customer" party={{ ...acme, status: 'inactive' }} />);
    assert.ok(screen.getByRole('button', { name: 'Restore Acme' }));
  });

  test('delete asks first, then the server deletes it and it leaves the list', async () => {
    const calls = stubFetchWithBodies(200, { status: 'success' });
    render(<PartyRowActions side="customer" party={acme} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete Acme' })); });
    await waitFor(() => assert.equal(useLedgerStore.getState().customers.length, 1));
    assert.deepEqual(asked, ['Delete customer "Acme"? This cannot be undone.']);
    assert.deepEqual([calls[0].url, calls[0].method], ['/api/v1/workspaces/component-workspace/contacts/customer/c1', 'DELETE']);
    assert.deepEqual(useLedgerStore.getState().customers.map(c => c.id), ['c2']);
  });

  test('a contact in use is not deleted; answering No sends nothing', async () => {
    const calls = stubFetchWithBodies(409, { message: '"Paper Co" is used by 2 bills: archive it instead (those records keep it)' });
    render(<PartyRowActions side="vendor" party={makeVendor({ id: 'v1', name: 'Paper Co' })} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete Paper Co' })); });
    await waitFor(() => assert.equal(calls.length, 1));
    assert.equal(calls[0].url, '/api/v1/workspaces/component-workspace/contacts/vendor/v1');
    assert.equal(useLedgerStore.getState().vendors.length, 1, 'still listed');
    window.confirm = () => false;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete Paper Co' })); });
    assert.equal(calls.length, 1);
  });

  test('the list toggle and badge', () => {
    assert.equal(isArchivedParty({ status: 'inactive' }), true);
    assert.equal(isArchivedParty({ status: 'archived' }), true);
    assert.equal(isArchivedParty({ status: 'active' }), false);
    assert.equal(isArchivedParty({}), false);
    let on = false;
    const { rerender } = render(<ShowArchivedToggle count={0} on={false} onChange={v => { on = v; }} noun="vendor" />);
    assert.equal(screen.queryByRole('button'), null, 'nothing archived: no toggle');
    rerender(<ShowArchivedToggle count={3} on={false} onChange={v => { on = v; }} noun="vendor" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show archived vendors (3)' }));
    assert.equal(on, true);
    cleanup();
    render(<ArchivedBadge party={{ status: 'inactive' }} />);
    assert.ok(screen.getByText('Archived'));
  });
});
