/** The Forensic Auditor's checks (H-16). */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerComplianceStats } from '../lib/forensicChecks';
import { lineAmount } from '../lib/txFilters';
import { makeTransaction } from './fixtures';

const count = (stats: ReturnType<typeof ledgerComplianceStats>, label: string) => stats.find(s => s.label === label)!.count;

describe('forensic checks', () => {
  test('a balanced foreign-currency entry is not called unbalanced (L-164)', () => {
    // 0.05 EUR at 1.10: converted line by line, +5.5 rounds to 6 and -5.5 to -5
    const eur = makeTransaction({ id: 'e', currency: 'EUR', exchangeRate: 1.1, lines: [{ accountId: 'a', accountName: 'A', amountCents: 5 }, { accountId: 'b', accountName: 'B', amountCents: -5 }] });
    assert.equal(eur.lines.reduce((s, l) => s + lineAmount(l, eur), 0), 1);   // what the old check added up
    assert.equal(count(ledgerComplianceStats([eur]), 'Unbalanced Journal Entries'), 0);
  });

  test('a really unbalanced entry is counted; drafts are left out', () => {
    const bad = makeTransaction({ id: 'x', lines: [{ accountId: 'a', accountName: 'A', amountCents: 100 }, { accountId: 'b', accountName: 'B', amountCents: -90 }] });
    const draft = makeTransaction({ id: 'd', status: 'draft', lines: [{ accountId: 'a', accountName: 'A', amountCents: 1 }] });
    const stats = ledgerComplianceStats([bad, draft]);
    assert.equal(count(stats, 'Unbalanced Journal Entries'), 1);
    assert.equal(stats[0].status, 'fail');
  });

  test('possible duplicates: same amount, date and payee', () => {
    const t = (id: string) => makeTransaction({ id, totalAmountCents: 5000, date: '2026-05-01', payee: 'Acme', lines: [{ accountId: 'a', accountName: 'A', amountCents: 5000 }, { accountId: 'b', accountName: 'B', amountCents: -5000 }] });
    assert.equal(count(ledgerComplianceStats([t('1'), t('2'), t('3')]), 'Potential Redundant Entries'), 2);
  });
});
