/**
 * Saved CSV column layouts (src/lib/importColumnMaps.ts) and the endpoint that stores them
 * (POST /api/v1/workspaces/:id/import-maps; database part runs with LF_TEST_DATABASE_URL).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { headerSignature, mappingToSaved, savedToMapping } from '../lib/importColumnMaps';
import type { ColumnMapping } from '../lib/importColumnMaps';
import type { Firestore } from '../server/db/pgFirestore';

const header = ['Posted Date', 'Description', 'Debit', 'Credit', 'Balance'];
const mapping: ColumnMapping = { date: 0, description: 1, amount: -1, debit: 2, credit: 3, payee: -1, memo: -1, skipRows: 1 };

describe('Saved column layouts', () => {
  test('the same header gives the same key, whatever the spacing or case', () => {
    assert.equal(headerSignature(header), headerSignature([' posted  date', 'DESCRIPTION', 'Debit', 'Credit', 'Balance ']));
    assert.notEqual(headerSignature(header), headerSignature(['Date', 'Description', 'Amount']));
    assert.match(headerSignature(header), /^csv_5_[0-9a-f]{8}$/);
  });

  test('saved by column name, so a reordered export still maps', () => {
    const saved = mappingToSaved(mapping, header);
    assert.deepEqual(saved, { columns: { date: 'Posted Date', description: 'Description', debit: 'Debit', credit: 'Credit' }, skipRows: 1 });
    const reordered = ['Description', 'Credit', 'Debit', 'Posted Date', 'Balance'];
    assert.deepEqual(savedToMapping(saved, reordered), { skipRows: 1, date: 3, description: 0, amount: -1, debit: 2, credit: 1, payee: -1, memo: -1 });
  });

  test('the fiscal year and time zone settings are fields the database accepts on workspaces', () => {
    const migration = fs.readFileSync('supabase/migrations/20260925000000_workspace_fields.sql', 'utf8');
    for (const field of ['timezone', 'fiscalYearStartMonth', 'fiscalYearStartDay', 'importColumnMaps']) assert.match(migration, new RegExp(`'${field}'`));
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Saving a column layout', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_maps_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const save = async (uid: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/import-maps`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body),
    });
    return res.status;
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Maps', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    await db.pool.query('delete from public.workspaces where id = $1', [ws]);
    await db.terminate();
  });

  test('a bookkeeper saves a layout; a viewer cannot; bad layouts are refused', async () => {
    const body = { signature: headerSignature(header), ...mappingToSaved(mapping, header) };
    assert.equal(await save('view-1', body), 403);
    assert.equal(await save('book-1', { ...body, signature: 'x' }), 400);
    assert.equal(await save('book-1', { ...body, columns: { ...body.columns, hack: 'x' } }), 400);
    assert.equal(await save('book-1', body), 200);
    const maps = (await db.collection('workspaces').doc(ws).get()).data()?.importColumnMaps;
    assert.deepEqual(maps[body.signature].columns, body.columns);
  });
});
