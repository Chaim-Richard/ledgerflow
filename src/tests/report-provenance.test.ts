/**
 * AUD-10: the provenance contract (src/lib/reportProvenance.ts) and its words, worked by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { browserProvenance, clockTime, combineProvenance, describeProvenance, provenanceFromResponse, serverProvenance } from '../lib/reportProvenance';
import { LEDGER_COLLECTIONS } from '../lib/ledgerCollections';

const none = { truncatedCollections: {}, isDataTruncated: false, failed: {} };

test('server: complete; a cached answer carries the moment it was worked out', () => {
  assert.deepEqual(serverProvenance(), { source: 'server', completeness: 'complete' });
  const at = Date.parse('2026-05-20T11:02:00.000Z');
  assert.deepEqual(serverProvenance(at), { source: 'server', completeness: 'complete', cachedAt: '2026-05-20T11:02:00.000Z' });
  assert.deepEqual(describeProvenance(serverProvenance()), { complete: true, headline: 'Complete', detail: 'Worked out by the server from every entry.' });
  assert.equal(describeProvenance(serverProvenance(at)).headline, `Cached at ${clockTime('2026-05-20T11:02:00.000Z')}`);
  assert.equal(describeProvenance(serverProvenance(at)).complete, false);
});

test('a response without provenance (older server) reads as a fresh server answer', () => {
  assert.deepEqual(provenanceFromResponse({ netIncome: 1 }), serverProvenance());
  assert.deepEqual(provenanceFromResponse(null), serverProvenance());
  assert.deepEqual(provenanceFromResponse({ provenance: { source: 'server', completeness: 'complete', cachedAt: 'x' } }), { source: 'server', completeness: 'complete', cachedAt: 'x' });
});

test('browser: the cap of the collection that reached it; 20,000 entries is the ledger cap', () => {
  assert.equal(LEDGER_COLLECTIONS.transactions.cap, 20000);
  // 20,000 rows loaded of 20,001: the snapshot has docs.length >= cap, so the flag is set
  const capped = browserProvenance(['transactions', 'accounts'], { ...none, truncatedCollections: { transactions: true }, isDataTruncated: true });
  assert.deepEqual(capped, { source: 'browser', completeness: { cappedAt: 20000, collection: 'transactions' } });
  assert.equal(describeProvenance(capped).headline, 'Capped at 20,000 entries');
  // the accounts key is stored under its table name, chartAccounts
  assert.deepEqual(browserProvenance(['accounts'], { ...none, truncatedCollections: { chartAccounts: true }, isDataTruncated: true }).completeness, { cappedAt: 2000, collection: 'accounts' });
});

test('browser: a collection the report does not read being capped leaves it complete', () => {
  const p = browserProvenance(['transactions', 'accounts'], { ...none, truncatedCollections: { auditLogs: true }, isDataTruncated: true });
  assert.equal(p.completeness, 'complete');
});

test('browser: partial when a collection failed, or truncation is known without which', () => {
  assert.equal(browserProvenance(['transactions'], { ...none, failed: { transactions: 'offline' } }).completeness, 'partial');
  assert.equal(browserProvenance(['transactions'], { ...none, isDataTruncated: true }).completeness, 'partial');
  assert.equal(describeProvenance(browserProvenance(['transactions'], { ...none, isDataTruncated: true }, true)).detail,
    'Worked out in this browser, but not everything could be loaded, so the figures may be incomplete. The server report could not be loaded.');
});

test('browser complete: every loaded entry; says when the server failed', () => {
  assert.deepEqual(describeProvenance(browserProvenance(['transactions'], none)), { complete: true, headline: 'Complete', detail: 'Worked out in this browser from every loaded entry.' });
  assert.equal(describeProvenance(browserProvenance(['transactions'], none, true)).detail, 'Worked out in this browser from every loaded entry. The server report could not be loaded.');
});

test('columns: the least complete answer wins; among server answers the oldest cache', () => {
  assert.equal(combineProvenance([]), null);
  const a = serverProvenance(Date.parse('2026-05-20T11:02:00Z')), b = serverProvenance(Date.parse('2026-05-20T11:01:00Z'));
  assert.equal(combineProvenance([serverProvenance(), a, b])!.cachedAt, '2026-05-20T11:01:00.000Z');
  assert.deepEqual(combineProvenance([serverProvenance()]), serverProvenance());
  const capped = browserProvenance(['transactions'], { ...none, truncatedCollections: { transactions: true } });
  assert.deepEqual(combineProvenance([serverProvenance(), capped]), capped);
});
