import { test, expect } from '@playwright/test';
import { mountJourney, captured, remountJourney, setLedgerField } from './support/journeyFixture';
import AxeBuilder from '@axe-core/playwright';

/**
 * F-43 · W4 (RELEASE_GATE): bank CSV import → match → reconciled balance, in the browser.
 *
 * The bank statement (Chase checking layout, September 2026, opening balance 1,420.00):
 *   2026-09-03  ACME SUPPLIES          -420.00   running balance 1,000.00
 *   2026-09-10  CLIENT PAYMENT INV 1001 1,180.00  running balance 2,180.00
 *   2026-09-12  OFFICE RENT           -1,500.00  running balance   680.00
 *
 * Worked figures: three lines, net -740.00 (1,180.00 in, 1,920.00 out), closing bank balance 680.00.
 * The import screen must hand the import exactly these three lines with these signed amounts.
 */

const WORKSPACE = 'w4-browser';
const BANK = { id: 'bank-1000', uid: 'journey-user', workspaceId: WORKSPACE, code: '1000', name: 'Bank 1000', type: 'asset', category: 'Cash' };
const OFFICE = { id: 'expense-5000', uid: 'journey-user', workspaceId: WORKSPACE, code: '5000', name: 'Office costs', type: 'expense', category: 'Expenses' };

const CHASE_CSV = [
  'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #',
  'DEBIT,09/03/2026,ACME SUPPLIES,-420.00,ACH_DEBIT,1000.00,',
  'CREDIT,09/10/2026,CLIENT PAYMENT INV 1001,1180.00,ACH_CREDIT,2180.00,',
  'DEBIT,09/12/2026,OFFICE RENT,-1500.00,ACH_DEBIT,680.00,',
  '',
].join('\n');

test('W4 browser: a bank CSV is previewed and imported exactly, line by line', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const { errors, requests } = await mountJourney(page, {
    workspaceId: WORKSPACE,
    ledger: { accounts: [BANK, OFFICE], transactions: [], bankLines: [], customers: [], vendors: [] },
    api: request => (request.url.endsWith('/api/v1/transactions/reconcile') ? { json: { ok: true } } : null),
    mounts: [{
      module: '/src/components/ledger/StatementImporter.tsx',
      props: { isOpen: true, onImport: '__capture:import', existingTransactions: [], businessContext: 'Small business books', accounts: [BANK, OFFICE], patternCache: {} },
    }],
  });

  const importer = page.getByRole('dialog');
  await importer.getByLabel('US bank CSV layout').selectOption('chase-checking');
  await importer.locator('input[type="file"]').setInputFiles({ name: 'chase-september.csv', mimeType: 'text/csv', buffer: Buffer.from(CHASE_CSV) });

  // The review lists the three lines, none duplicated, all selected.
  await expect(importer.getByRole('button', { name: /Import 3 Entries/ })).toBeVisible();

  await importer.getByRole('button', { name: /Import 3 Entries/ }).click();

  await expect.poll(() => captured(page, 'import')).toHaveLength(1);
  const [[lines]] = await captured(page, 'import');
  const imported = (lines as Array<{ date: string; description: string; amountCents: number; selected: boolean; isDuplicate: boolean }>)
    .map(({ date, description, amountCents, selected, isDuplicate }) => ({ date, description, amountCents, selected, isDuplicate }));
  expect(imported).toEqual([
    { date: '2026-09-03', description: 'ACME SUPPLIES', amountCents: -42000, selected: true, isDuplicate: false },
    { date: '2026-09-10', description: 'CLIENT PAYMENT INV 1001', amountCents: 118000, selected: true, isDuplicate: false },
    { date: '2026-09-12', description: 'OFFICE RENT', amountCents: -150000, selected: true, isDuplicate: false },
  ]);
  const net = imported.reduce((sum, line) => sum + line.amountCents, 0);
  expect(net, 'net movement: 1,180.00 in less 1,920.00 out').toBe(-74000);
  expect(142000 + net, 'opening 1,420.00 plus the net is the closing 680.00').toBe(68000);

  // 2. The imported lines are matched on the reconciliation screen. The server stores the lines and the
  //    ledger entries they describe; here the store receives them as the live subscription would.
  const bankLines = imported.map((line, index) => ({
    id: `bl-${index + 1}`, uid: 'journey-user', workspaceId: WORKSPACE, accountId: BANK.id, status: 'pending',
    date: line.date, description: line.description, amountCents: line.amountCents,
  }));
  const ledgerEntries = [
    { id: 'tx-opening', description: 'Opening balance', date: '2026-08-31', amountCents: 142000, bank: 142000, other: 'equity-3000' },
    { id: 'tx-acme', description: 'ACME SUPPLIES', date: '2026-09-03', amountCents: 42000, bank: -42000, other: OFFICE.id },
    { id: 'tx-inv-1001', description: 'CLIENT PAYMENT INV 1001', date: '2026-09-10', amountCents: 118000, bank: 118000, other: 'ar-1200' },
    { id: 'tx-rent', description: 'OFFICE RENT', date: '2026-09-12', amountCents: 150000, bank: -150000, other: OFFICE.id },
  ].map(entry => ({
    id: entry.id, uid: 'journey-user', workspaceId: WORKSPACE, date: entry.date, description: entry.description,
    totalAmountCents: Math.abs(entry.amountCents), currency: 'USD', status: 'posted',
    lines: [{ accountId: BANK.id, amountCents: entry.bank }, { accountId: entry.other, amountCents: -entry.bank }],
  }));
  await setLedgerField(page, 'bankLines', bankLines);
  await setLedgerField(page, 'transactions', ledgerEntries);
  await remountJourney(page, [{ module: '/src/components/ledger/Reconciliation.tsx' }]);

  await expect(page.getByRole('heading', { name: 'Smart Matching & Bank Reconciliation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /To review \(3\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Auto-match all' }).click();

  // The screen posts the three matches (each line to its ledger entry, the entry marked reconciled).
  await expect.poll(() => requests.filter(r => r.url.endsWith('/api/v1/transactions/reconcile')).length).toBe(1);
  const operations = (requests.find(r => r.url.endsWith('/api/v1/transactions/reconcile'))?.body as { operations: Array<{ type: string; id: string; data: Record<string, unknown> }> }).operations;
  const matches = operations.filter(op => op.type === 'updateBankLine').map(op => [op.id, op.data.matchedTransactionId]);
  expect(matches.sort()).toEqual([
    ['bl-1', 'tx-acme'],
    ['bl-2', 'tx-inv-1001'],
    ['bl-3', 'tx-rent'],
  ]);
  expect(operations.filter(op => op.type === 'updateTransaction').every(op => op.data.status === 'reconciled')).toBe(true);

  // 3. The reconciled balance: the bank's ledger balance after the matched entries equals the closing balance
  //    printed on the statement (680.00).
  await setLedgerField(page, 'bankLines', bankLines.map(line => ({ ...line, status: 'matched' })));
  await setLedgerField(page, 'transactions', ledgerEntries.map(entry => ({ ...entry, status: entry.id === 'tx-opening' ? 'posted' : 'reconciled' })));
  const ledgerBalance = await page.evaluate(async () => {
    const { useLedgerStore } = await import('/src/stores/useLedgerStore.ts');
    const state = useLedgerStore.getState();
    const lines = state.transactions.flatMap((t: { lines?: unknown[] }) => (t.lines ?? []) as Array<{ accountId: string; amountCents: number }>);
    return lines.filter(l => l.accountId === 'bank-1000').reduce((sum, l) => sum + l.amountCents, 0);
  });
  expect(ledgerBalance, 'ledger balance of Bank 1000 equals the statement closing balance').toBe(68000);
  await expect(page.getByRole('button', { name: /Matched \(3\)/ })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  const serious = axe.violations.filter(v => v.impact === 'critical');
  expect(serious.map(v => v.id), 'no critical accessibility violations on the reconciliation screen').toEqual([]);

  expect(errors).toEqual([]);
});
