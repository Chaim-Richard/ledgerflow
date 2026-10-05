import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordDetailsForm } from '../components/common/RecordDetailsForm';
import { recordDetailsAdapter } from '../lib/recordDetailsAdapter';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
afterEach(async () => { cleanup(); await getSupabase().auth.dispose(); });
test('connected drawer saves only the vendor address through the database and reloads the confirmed value', async () => {
 setComponentWorkspace(); let address = 'Old'; const writes: Record<string, unknown>[] = [];
 const vendor = { id: 'vendor', uid: 'test-user', workspaceId: 'component-workspace', name: 'ספק Supply', category: 'Supplier', balanceCents: 4500 };
 useLedgerStore.setState({ vendors: [vendor] });
 globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input).includes('/rpc/lf_update')) { const body = JSON.parse(String(init?.body)); writes.push(body); address = body.p_set.address; return new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  return new Response(JSON.stringify({ id: vendor.id, data: { ...vendor, address } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
 }) as typeof fetch;
 const target = { kind: 'vendors' as const, id: vendor.id };
 render(<RecordDetailsForm target={target} adapter={recordDetailsAdapter} />);
 await waitFor(() => assert.ok(screen.getByLabelText('Address')));
 fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'ירושלים\nStreet 7' } }); fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
 await waitFor(() => assert.match(screen.getByRole('status').textContent || '', /saved for future/));
 assert.equal(writes.length, 1); assert.equal(writes[0].p_table, 'vendors'); assert.equal(writes[0].p_id, 'vendor'); const fields = writes[0].p_set as Record<string, unknown>;
 assert.deepEqual(Object.keys(fields).sort(), ['address', 'updatedAt']); assert.equal(fields.address, address); assert.equal(useLedgerStore.getState().vendors[0].balanceCents, 4500);
 cleanup(); render(<RecordDetailsForm target={target} adapter={recordDetailsAdapter} />); await waitFor(() => assert.equal((screen.getByLabelText('Address') as HTMLTextAreaElement).value, address));
});
