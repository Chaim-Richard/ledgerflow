/**
 * CON-4b: a filed VAT return can name the registration it is for, so a workspace with two Israeli registrations
 * (Tel Aviv 514000001 on the books, Eilat 514000002 on the label world:eilat) records each one's return apart.
 * Figures by hand (agorot), September 2026:
 *   Tel Aviv INV 1001 net 100,000 + 18% 18,000;  Eilat INV 2001 net 50,000 exempt (a sale in Eilat by the Eilat dealer)
 *   the Tel Aviv return filed for 514000001: 1 document, output VAT 18,000 — the Eilat invoice is not in its copy
 *   the same again → 409; the whole workspace for the same month afterwards → 409; a registration not in the profiles → 400
 * The journey counts a return as filed only for its own registration; one filed for the whole workspace still cannot
 * be told whose it is when there are two. On the screen, an owner records one registration's return as filed.
 */
import './helpers/dom';
import test, { afterEach, after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { israelMonthJourney } from '../lib/israelMonthJourney';
import type { TaxProfiles } from '../lib/tax/profile';
import { IsraelMonthJourneyPanel } from '../components/reporting/IsraelMonthJourneyReportView';

const PROFILES: TaxProfiles = {
  books: { name: 'Tel Aviv Ltd', place: { country: 'IL', city: 'Tel Aviv' }, registrations: [{ kind: 'vat', number: '514000001', place: { country: 'IL' }, validFrom: '2020-01-01', filing: 'monthly' }] },
  labels: { 'world:eilat': { name: 'Eilat Ltd', place: { country: 'IL', city: 'Eilat' }, registrations: [{ kind: 'vat', number: '514000002', place: { country: 'IL' }, validFrom: '2020-01-01', filing: 'monthly' }] } },
};
const TA = 'vat:IL:514000001';
const EILAT = 'vat:IL:514000002';
const invoices = [
  { id: 'i1', number: '1001', date: '2026-09-10', status: 'sent', taxVersion: 2, amountCents: 118_000, taxAmountCents: 18_000, taxTreatment: 'standard' },
  { id: 'i2', number: '2001', date: '2026-09-12', status: 'sent', taxVersion: 2, amountCents: 50_000, taxAmountCents: 0, taxTreatment: 'exempt', dimensions: { world: 'eilat' } },
];
const journey = (filedPeriods: Array<{ startDate: string; endDate: string; registration?: string }>) =>
  israelMonthJourney({ month: '2026-09', today: '2026-10-05', currency: 'ILS', profiles: PROFILES, order: ['world'], invoices: invoices as never, filedPeriods });
const filedOf = (j: ReturnType<typeof journey>) => j.steps.find(s => s.id === 'vat-report')!.returns.map(r => [r.registration, r.filed, r.recordedForDates]);

test('a return filed for one registration counts for that one only', () => {
  assert.deepEqual(filedOf(journey([{ startDate: '2026-09-01', endDate: '2026-09-30', registration: TA }])), [[TA, true, false], [EILAT, false, false]]);
  // the whole workspace, with two registrations: recorded, but whose it is cannot be told
  assert.deepEqual(filedOf(journey([{ startDate: '2026-09-01', endDate: '2026-09-30' }])), [[TA, false, true], [EILAT, false, true]]);
  assert.deepEqual(filedOf(journey([{ startDate: '2026-09-01', endDate: '2026-09-30', registration: TA }, { startDate: '2026-09-01', endDate: '2026-09-30', registration: EILAT }])), [[TA, true, false], [EILAT, true, false]]);
});

describe('on the screen', () => {
  afterEach(() => cleanup());
  test('an owner records the Eilat registration\'s return as filed; the request names it', async () => {
    const asked: Array<Record<string, string>> = [];
    render(<IsraelMonthJourneyPanel journey={journey([{ startDate: '2026-09-01', endDate: '2026-09-30', registration: TA }])} preview={null} currency="ILS"
      monthText="2026-09" onMonthChange={() => {}} dealerId="" onDealerIdChange={() => {}} onRecordFiled={async r => { asked.push(r); }} />);
    assert.equal(screen.queryByRole('button', { name: 'Record 514000001 as filed' }), null, 'already filed');
    fireEvent.click(screen.getByRole('button', { name: 'Record 514000002 as filed' }));
    await waitFor(() => assert.deepEqual(asked, [{ ...asked[0], registration: EILAT, startDate: '2026-09-01', endDate: '2026-09-30' }]));
  });
  test('a refusal is shown in words; without the right role there is no button', async () => {
    const view = render(<IsraelMonthJourneyPanel journey={journey([])} preview={null} currency="ILS" monthText="2026-09" onMonthChange={() => {}} dealerId="" onDealerIdChange={() => {}}
      onRecordFiled={async () => { throw new Error('A return for this period was already filed'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Record 514000001 as filed' }));
    await waitFor(() => assert.match(screen.getByRole('alert').textContent || '', /already filed/));
    view.unmount();
    render(<IsraelMonthJourneyPanel journey={journey([])} preview={null} currency="ILS" monthText="2026-09" onMonthChange={() => {}} dealerId="" onDealerIdChange={() => {}} />);
    assert.equal(screen.queryByRole('button', { name: /as filed/ }), null);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Filing for one registration (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_con4b_${crypto.randomBytes(4).toString('hex')}`;
  let db: import('../server/db/pgFirestore').Firestore;
  let svc: typeof import('../server/services/taxReturnService');
  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as never;
    svc = await import('../server/services/taxReturnService');
    await db.collection('workspaces').doc(ws).set({ uid: 'o', name: 'Two dealers', currency: 'ILS', members: ['o'], taxProfiles: PROFILES, dimensions: [{ id: 'world', isWorld: true, name: 'Entity' }] });
    for (const inv of invoices) await db.collection('invoices').doc(`${ws}_${inv.id}`).set({ ...inv, workspaceId: ws });
  });
  after(async () => {
    for (const table of ['invoices', 'taxReturns', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('the Tel Aviv return holds Tel Aviv\'s document only; the same again and the whole workspace are refused', async () => {
    const period = { workspaceId: ws, uid: 'o', startDate: '2026-09-01', endDate: '2026-09-30' };
    const filed = await svc.fileTaxReturn(db as never, { ...period, registration: TA });
    assert.equal(filed.registration, TA);
    assert.equal(filed.documentCount, 1, 'the Eilat invoice is not in its copy');
    assert.equal(filed.boxes.find(b => b.key === '3')?.cents, 18_000);
    await assert.rejects(svc.fileTaxReturn(db as never, { ...period, registration: TA }), /already filed/);
    await assert.rejects(svc.fileTaxReturn(db as never, period), /single registrations were already filed/);
    await assert.rejects(svc.fileTaxReturn(db as never, { ...period, registration: 'vat:IL:999999999' }), /not one of this workspace's registrations/);
    const eilat = await svc.fileTaxReturn(db as never, { ...period, registration: EILAT });
    assert.equal(eilat.documentCount, 1);
    const listed = (await svc.listTaxReturns(db as never, ws)).map(r => r.registration).sort();
    assert.deepEqual(listed, [TA, EILAT]);
  });
});
