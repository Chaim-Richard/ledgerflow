/**
 * Warranty and insurance reminders for fixed assets (X-08): from 30 days before the date (and on the
 * day), never after it, never for a disposed asset; the nightly job tells the people who keep the
 * books once for each date; the register shows the dates (editable) and what is coming up.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { assetRemindersDue, reminderText } from '../lib/assetReminders';
import FixedAssetsView from '../components/assets/FixedAssetsView';
import { markComponentCollectionsLoaded, setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getLocalDateISO } from '../lib/utils';
import { addDaysYMD } from '../lib/fiscalCalendar';
import type { Firestore } from '../server/db/pgFirestore';
import type { FixedAsset } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('When an asset is reminded about', () => {
  test('30 days before, on the day, never after; both dates; a disposed asset never', () => {
    assert.deepEqual(assetRemindersDue({ warrantyExpires: '2026-11-06', insuranceRenews: '2026-10-07' }, '2026-10-07'),
      [{ kind: 'warranty', date: '2026-11-06', daysLeft: 30 }, { kind: 'insurance', date: '2026-10-07', daysLeft: 0 }]);
    assert.deepEqual(assetRemindersDue({ warrantyExpires: '2026-11-07' }, '2026-10-07'), [], '31 days away');
    assert.deepEqual(assetRemindersDue({ warrantyExpires: '2026-10-06' }, '2026-10-07'), [], 'already past');
    assert.deepEqual(assetRemindersDue({ status: 'disposed', warrantyExpires: '2026-10-10' }, '2026-10-07'), []);
    assert.deepEqual(assetRemindersDue({ insuranceRenews: '2024-03-01' }, '2024-02-28'), [{ kind: 'insurance', date: '2024-03-01', daysLeft: 2 }], 'a leap year');
    assert.equal(reminderText('Van', { kind: 'warranty', date: '2026-10-08', daysLeft: 1 }), 'The warranty on Van ends tomorrow');
    assert.equal(reminderText('Van', { kind: 'insurance', date: '2026-10-17', daysLeft: 10 }), 'The insurance on Van renews in 10 days (2026-10-17)');
  });
});

describe('The nightly reminders (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_assetrem_${crypto.randomBytes(4).toString('hex')}`;
  let db: Firestore;
  let job: typeof import('../server/services/assetReminderService');

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb();
    job = await import('../server/services/assetReminderService');
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Reminder Co', timezone: 'UTC', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    const asset = (id: string, fields: Record<string, unknown>) => db.collection('assets').doc(`${ws}_${id}`).set({ workspaceId: ws, uid: 'owner-1', status: 'active', purchasePriceCents: 100_000, ...fields });
    await asset('van', { name: 'Van', warrantyExpires: '2026-10-17' });
    await asset('press', { name: 'Press', insuranceRenews: '2026-12-01' });
    await asset('old', { name: 'Old truck', status: 'disposed', warrantyExpires: '2026-10-10' });
  });

  after(async () => {
    for (const table of ['notifications', 'assets', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('the van\'s warranty (10 days away) is told to the owner and the bookkeeper, once; the rest are not', async () => {
    await job.runAssetReminders(db, new Date('2026-10-07T12:00:00Z'));
    await job.runAssetReminders(db, new Date('2026-10-08T12:00:00Z'));
    const { rows } = await db.pool.query<{ uid: string; title: string }>(
      `select data->>'uid' as uid, data->>'title' as title from public.notifications where workspace_id = $1 order by 1`, [ws]);
    assert.deepEqual(rows, [
      { uid: 'book-1', title: 'The warranty on Van ends in 10 days (2026-10-17)' },
      { uid: 'owner-1', title: 'The warranty on Van ends in 10 days (2026-10-17)' },
    ]);
  });
});

describe('Warranty and insurance on the register', () => {
  afterEach(() => cleanup());

  test('the dates show and can be edited; one coming up is called out', () => {
    setComponentWorkspace('bookkeeper');
    const today = getLocalDateISO();
    const van = {
      id: 'van', uid: 'u', workspaceId: 'component-workspace', name: 'Delivery van', purchaseDate: '2026-01-01', purchasePriceCents: 1_200_000,
      salvageValueCents: 0, usefulLifeYears: 5, depreciationMethod: 'straight-line', accumulatedDepreciationCents: 0, status: 'active',
      createdAt: '2026-01-01', warrantyExpires: addDaysYMD(today, 12),
    } as FixedAsset;
    useLedgerStore.setState({ assets: [van], accounts: [] } as never);
    markComponentCollectionsLoaded('assets');
    render(<FixedAssetsView />);
    assert.ok(screen.getByRole('button', { name: 'Edit Warranty ends for Delivery van' }));
    assert.ok(screen.getByRole('button', { name: 'Edit Insurance renews for Delivery van' }));
    assert.ok(screen.getByText(`The warranty on Delivery van ends in 12 days (${addDaysYMD(today, 12)})`));
  });
});
