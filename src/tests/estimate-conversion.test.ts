/**
 * Estimate → invoice (H-24, L-163): a draft invoice with the estimate's lines, going through the
 * posting path; no screen writes invoices, bills, credits or payments to the database directly.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertEstimateToInvoice } from '../lib/estimateConverter';
import type { Estimate } from '../types';

const estimate: Estimate = {
  id: 'est1', uid: 'u1', workspaceId: 'w1', number: 'EST-7', customerId: 'c1', customerName: 'Acme',
  amountCents: 25000, date: '2026-09-01', status: 'accepted', createdAt: '2026-09-01T00:00:00Z',
  lines: [
    { description: 'Design', quantity: 2, unitPriceCents: 10000, amountCents: 20000 },
    { description: 'Hosting', quantity: 1, unitPriceCents: 5000, amountCents: 5000 },
  ],
};

describe('estimate conversion', () => {
  test('a draft invoice with the lines, stable ids and no made-up account', () => {
    const inv = convertEstimateToInvoice(estimate);
    assert.equal(inv.status, 'draft');
    assert.equal(inv.amountCents, 25000);
    assert.deepEqual(inv.items?.map(i => [i.id, i.description, i.quantity, i.rateCents, i.amountCents, i.accountId]), [
      ['est1-0', 'Design', 2, 10000, 20000, ''],
      ['est1-1', 'Hosting', 1, 5000, 5000, ''],
    ]);
  });

  test('an estimate saved as one amount becomes one line', () => {
    const inv = convertEstimateToInvoice({ ...estimate, lines: [] });
    assert.deepEqual(inv.items?.map(i => [i.description, i.amountCents]), [['Estimate EST-7', 25000]]);
  });

  test('a declined estimate is refused', () => {
    assert.throws(() => convertEstimateToInvoice({ ...estimate, status: 'declined' }));
  });

  test('guard: screens never write money documents straight to the database (they skip the ledger)', () => {
    const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap(name => {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) return name === 'tests' || name === 'server' ? [] : walk(p);
      return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
    const direct = /(addDoc|setDoc|updateDoc|deleteDoc)\(\s*(collection|doc)\(db,\s*['"](invoices|bills|creditNotes|vendorCredits|payments|transactions)['"]/;
    const offenders = walk('src').flatMap(f => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => direct.test(l) ? `${f}:${i + 1}: ${l.trim()}` : '').filter(Boolean));
    assert.deepEqual(offenders, []);
    assert.ok(direct.test("const invRef = await addDoc(collection(db, 'invoices'), invData);"));
  });
});
