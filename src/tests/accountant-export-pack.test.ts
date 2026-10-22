import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNTANT_PACK_FORMAT, accountantPackFileName, accountantPackZip, buildAccountantPack,
  monthEndISO, packCsvFiles, packMonths, packReadme, packSlug,
} from '../lib/accountantExportPack';
import type { AccountantPackInput } from '../lib/accountantExportPack';
import { csvMoney } from '../lib/csvExport';

/**
 * E-58 worked figures, written by hand before the code ran.
 *
 * Opening balances: Cash 1,000.00 + Inventory 2,000.00 = Equity 3,000.00 (all debit/credit balanced).
 * Entries:
 *   10 Jan  sale 1 (paid):   AR 1,200.00 debit / Sales 1,000.00 + Sales tax payable 200.00 credit
 *   20 Jan  bill 1 (paid):   COGS 500.00 debit / AP 500.00 credit
 *   05 Feb  receipt:         Cash 1,200.00 debit / AR 1,200.00 credit
 *   15 Feb  payment:         AP 500.00 debit / Cash 500.00 credit
 *   20 Feb  sale 2 (open):   AR 550.00 debit / Sales 500.00 + Sales tax payable 50.00 credit
 *
 * Trial balance at 28 Feb 2026:
 *   Cash debit 2,200.00 credit 500.00 (balance 1,700.00)   AR debit 1,750.00 credit 1,200.00 (550.00)
 *   Inventory debit 2,000.00 (2,000.00)                    AP debit 500.00 credit 500.00 (0)
 *   Equity credit 3,000.00 (-3,000.00)                     Sales credit 1,500.00 (-1,500.00)
 *   COGS debit 500.00 (500.00)                             Sales tax payable credit 250.00 (-250.00)
 *   Totals: debits 6,950.00 = credits 6,950.00.
 *
 * A/R on 5 Mar 2026: customer 1 has invoice 2 (550.00, due 25 Feb → 1–30 days); customer 2 has an
 * older 300.00 invoice (due 31 Dec 2025 → 64 days → 61–90 days). Total 850.00.
 * A/P on 5 Mar 2026: vendor 2's bill (214.00, due 10 Mar) is not yet due; vendor 1's bill is paid.
 *
 * Tax by period: January output 200.00, input 0 → 200.00; February output 50.00, input 14.00 →
 * 36.00; the period total is 236.00 in 4 counted documents.
 */
function accounts() {
  return [
    { id: 'cash', workspaceId: 'ws1', name: 'Cash', code: '1000', type: 'asset', category: 'Cash', openingBalanceCents: 100000 },
    { id: 'ar', workspaceId: 'ws1', name: 'Accounts Receivable', code: '1100', type: 'asset', category: 'Receivables' },
    { id: 'inventory', workspaceId: 'ws1', name: 'Inventory', code: '1200', type: 'asset', category: 'Current Assets', openingBalanceCents: 200000 },
    { id: 'ap', workspaceId: 'ws1', name: 'Accounts Payable', code: '2000', type: 'liability', category: 'Payables' },
    { id: 'tax', workspaceId: 'ws1', name: 'Sales tax payable', code: '2200', type: 'liability', category: 'Payables' },
    { id: 'equity', workspaceId: 'ws1', name: 'Owner equity', code: '3000', type: 'equity', category: 'Equity', openingBalanceCents: 300000 },
    { id: 'sales', workspaceId: 'ws1', name: 'Sales', code: '4000', type: 'revenue', category: 'Revenue' },
    { id: 'cogs', workspaceId: 'ws1', name: 'Cost of goods sold', code: '5000', type: 'cost_of_goods', category: 'COGS' },
    { id: 'empty', workspaceId: 'ws1', name: 'Unused account', code: '9999', type: 'expense', category: 'Expenses' },
  ] as never[];
}

function transaction(id: string, date: string, description: string, lines: Array<[string, number]>) {
  return {
    id, workspaceId: 'ws1', date, description, status: 'posted',
    lines: lines.map(([accountId, amountCents]) => ({ accountId, amountCents })),
  } as never;
}

function input(overrides: Partial<AccountantPackInput> = {}): AccountantPackInput {
  return {
    workspaceName: 'Galil Design Studio',
    currency: 'USD',
    startDate: '2026-01-01',
    endDate: '2026-02-28',
    asOfDate: '2026-03-05',
    generatedAt: '2026-03-05T09:30:00.000Z',
    accounts: accounts(),
    transactions: [
      transaction('t1', '2026-01-10', 'Invoice INV-1', [['ar', 120000], ['sales', -100000], ['tax', -20000]]),
      transaction('t2', '2026-01-20', 'Bill BILL-1', [['cogs', 50000], ['ap', -50000]]),
      transaction('t3', '2026-02-05', 'Receipt INV-1', [['cash', 120000], ['ar', -120000]]),
      transaction('t4', '2026-02-15', 'Payment BILL-1', [['ap', 50000], ['cash', -50000]]),
      transaction('t5', '2026-02-20', 'Invoice INV-2', [['ar', 55000], ['sales', -50000], ['tax', -5000]]),
    ] as never[],
    customers: [{ id: 'c1', workspaceId: 'ws1', name: 'Alpha Ltd' }, { id: 'c2', workspaceId: 'ws1', name: 'Beta Co' }] as never[],
    vendors: [{ id: 'v1', workspaceId: 'ws1', name: 'Gamma Supply' }, { id: 'v2', workspaceId: 'ws1', name: 'Delta Parts' }] as never[],
    invoices: [
      { id: 'inv1', workspaceId: 'ws1', customerId: 'c1', date: '2026-01-10', dueDate: '2026-02-09', status: 'paid', amountCents: 120000, amountPaidCents: 120000, taxCents: 20000, taxTreatment: 'standard' },
      { id: 'inv2', workspaceId: 'ws1', customerId: 'c1', date: '2026-02-20', dueDate: '2026-02-25', status: 'sent', amountCents: 55000, taxCents: 5000, taxTreatment: 'standard' },
      { id: 'inv3', workspaceId: 'ws1', customerId: 'c2', date: '2025-12-01', dueDate: '2025-12-31', status: 'sent', amountCents: 30000, taxCents: 0 },
    ] as never[],
    bills: [
      { id: 'bill1', workspaceId: 'ws1', vendorId: 'v1', date: '2026-01-20', dueDate: '2026-02-19', status: 'paid', amountCents: 50000, amountPaidCents: 50000, taxCents: 0 },
      { id: 'bill2', workspaceId: 'ws1', vendorId: 'v2', date: '2026-02-10', dueDate: '2026-03-10', status: 'unpaid', amountCents: 21400, taxCents: 1400, taxTreatment: 'standard' },
    ] as never[],
    ...overrides,
  };
}

test('trial balance: hand-worked debits and credits, by account, without empty accounts', () => {
  const pack = buildAccountantPack(input());
  const tb = pack.sections.find(section => section.key === 'trial-balance');
  assert.ok(tb);
  assert.equal(tb.rows.length, 8 + 1, 'eight accounts with a balance plus the total row');
  assert.ok(!tb.rows.some(row => String(row[1]) === 'Unused account'), 'a zero account is left out by default');
  assert.equal(pack.totals.debitCents, 695000);
  assert.equal(pack.totals.creditCents, 695000);
  assert.deepEqual(tb.rows.find(row => String(row[0]) === '1000')?.slice(3), ['2200.00', '500.00', '1700.00']);
  assert.deepEqual(tb.rows.find(row => String(row[0]) === '1100')?.slice(3), ['1750.00', '1200.00', '550.00']);
  // netSigned is the balance in the account's own direction (positive = credit for revenue)
  assert.deepEqual(tb.rows.find(row => String(row[0]) === '4000')?.slice(3), ['0.00', '1500.00', '1500.00']);
  assert.deepEqual(tb.rows.find(row => String(row[0]) === '2200')?.slice(3), ['0.00', '250.00', '250.00']);
  assert.deepEqual(tb.rows.at(-1)?.slice(3), ['6950.00', '6950.00', '']);
  assert.equal(pack.warnings.filter(warning => /does not balance/.test(warning)).length, 0);
});

test('trial balance can list the whole chart when asked', () => {
  const pack = buildAccountantPack(input({ includeEmptyAccounts: true }));
  const tb = pack.sections.find(section => section.key === 'trial-balance');
  assert.equal(tb?.rows.length, 9 + 1);
  assert.ok(tb?.rows.some(row => String(row[1]) === 'Unused account'));
});

test('general ledger: opening balance, entries and closing balance per account', () => {
  const pack = buildAccountantPack(input());
  const gl = pack.sections.find(section => section.key === 'general-ledger');
  assert.ok(gl);
  const cash = gl.rows.filter(row => String(row[0]) === '1000');
  assert.deepEqual(cash.map(row => String(row[3])), ['Opening balance', 'Entry', 'Entry', 'Account total 2026-01-01 to 2026-02-28']);
  assert.equal(cash[0][9], '1000.00');
  assert.deepEqual(cash.slice(1, 3).map(row => [row[2], row[7], row[8], row[9]]), [
    ['2026-02-05', '1200.00', '', '2200.00'],
    ['2026-02-15', '', '500.00', '1700.00'],
  ]);
  assert.equal(cash.at(-1)?.[9], '1700.00');
  const receivables = gl.rows.filter(row => String(row[0]) === '1100');
  assert.equal(receivables.at(-1)?.[9], '550.00');
  // A chart account with no opening balance and no movement has no block.
  assert.equal(gl.rows.filter(row => String(row[0]) === '9999').length, 0);
});

test('A/R and A/P: open documents by days past due on the aging date', () => {
  const pack = buildAccountantPack(input());
  const ar = pack.sections.find(section => section.key === 'receivables');
  const ap = pack.sections.find(section => section.key === 'payables');
  assert.ok(ar && ap);
  assert.deepEqual(ar.rows[0], ['Alpha Ltd', '0.00', '550.00', '0.00', '0.00', '0.00', '550.00']);
  assert.deepEqual(ar.rows[1], ['Beta Co', '0.00', '0.00', '0.00', '300.00', '0.00', '300.00']);
  assert.deepEqual(ar.rows.at(-1), ['Total', '0.00', '550.00', '0.00', '300.00', '0.00', '850.00']);
  assert.equal(pack.totals.receivableCents, 85000);
  assert.deepEqual(ap.rows[0], ['Delta Parts', '214.00', '0.00', '0.00', '0.00', '0.00', '214.00']);
  assert.deepEqual(ap.rows.at(-1), ['Total', '214.00', '0.00', '0.00', '0.00', '0.00', '214.00']);
  assert.equal(pack.totals.payableCents, 21400);
});

test('tax liability by period: calendar months with output, input and net tax', () => {
  const pack = buildAccountantPack(input());
  const tax = pack.sections.find(section => section.key === 'tax-by-period');
  assert.ok(tax);
  assert.equal(tax.rows.length, 3, 'January, February and the total');
  const january = tax.rows[0], february = tax.rows[1], total = tax.rows[2];
  assert.deepEqual([january[0], january[1], january[2], january[3]], ['2026-01', '2026-01-01', '2026-01-31', '2']);
  assert.deepEqual(january.slice(4, 9), ['200.00', '0.00', '200.00', '0.00', '200.00']);
  assert.deepEqual([february[0], february[3]], ['2026-02', '2']);
  assert.deepEqual(february.slice(4, 9), ['50.00', '0.00', '50.00', '14.00', '36.00']);
  assert.deepEqual([total[0], total[3]], ['Total', '4']);
  assert.deepEqual(total.slice(4, 9), ['250.00', '0.00', '250.00', '14.00', '236.00']);
  assert.equal(pack.totals.taxDueCents, 23600);
});

test('CSV files: UTF-8 byte-order mark, spreadsheet-safe cells, README cross-checks, and one ZIP', async () => {
  const pack = buildAccountantPack(input());
  const files = packCsvFiles(pack);
  assert.deepEqual(files.map(file => file.path.split('/').pop()), [
    'README.txt', 'trial-balance.csv', 'general-ledger.csv', 'accounts-receivable.csv', 'accounts-payable.csv', 'tax-liability-by-period.csv',
  ]);
  assert.ok(files[0].path.startsWith('accountant-pack-galil-design-studio-2026-01-01-to-2026-02-28/'));
  for (const file of files.slice(1)) {
    assert.ok(file.content.startsWith('\uFEFF'), `${file.path} starts with a byte-order mark`);
      assert.equal(file.content.charCodeAt(0), 0xFEFF, `${file.path} starts with the marker itself`);
  }
  const trial = files.find(file => file.path.endsWith('trial-balance.csv'))!.content.replace(/^\uFEFF/, '');
  assert.match(trial, /^"Account code","Account name","Type","Debit \(USD\)"/);
  assert.match(trial, /"1000","Cash","asset","2200.00","500.00","1700.00"/);
  const readme = packReadme(pack);
  assert.match(readme, /Trial balance debits 6950\.00 \/ credits 6950\.00 \(equal\)/);
  assert.match(readme, /Tax liability for the period 236\.00/);
  assert.match(readme, /not a dated snapshot at the period end/);
  assert.equal(ACCOUNTANT_PACK_FORMAT, 'ledgerflow-accountant-pack-v1');

  const zip = accountantPackZip(pack);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'a real ZIP starts with PK\\x03\\x04');
  const text = new TextDecoder().decode(bytes);
  for (const name of ['README.txt', 'trial-balance.csv', 'general-ledger.csv', 'accounts-receivable.csv', 'accounts-payable.csv', 'tax-liability-by-period.csv']) {
    assert.ok(text.includes(name), `${name} is named in the ZIP central directory`);
  }
  assert.equal(accountantPackFileName(pack), 'accountant-pack-galil-design-studio-2026-01-01-to-2026-02-28.zip');
});

test('a pack that does not balance says so, and never hides it', () => {
  const unbalanced = input({ accounts: accounts().filter((account: { id: string }) => account.id !== 'equity') });
  const pack = buildAccountantPack(unbalanced);
  assert.ok(pack.warnings.some(warning => /does not balance/.test(warning)));
  assert.notEqual(pack.totals.debitCents, pack.totals.creditCents);
});

test('periods: calendar months clipped to the chosen dates, with real month ends', () => {
  assert.equal(monthEndISO('2024-02'), '2024-02-29', 'a leap year');
  assert.equal(monthEndISO('2026-02'), '2026-02-28');
  assert.equal(monthEndISO('2026-12'), '2026-12-31');
  assert.deepEqual(packMonths('2026-01-15', '2026-03-10'), [
    { month: '2026-01', from: '2026-01-15', to: '2026-01-31' },
    { month: '2026-02', from: '2026-02-01', to: '2026-02-28' },
    { month: '2026-03', from: '2026-03-01', to: '2026-03-10' },
  ]);
  assert.throws(() => packMonths('2026-03-01', '2026-01-01'), /start date must not be after/);
  assert.throws(() => buildAccountantPack(input({ endDate: 'not-a-date' })), /start and end date/);
});

test('file names stay safe for any workspace name', () => {
  assert.equal(packSlug('Galil Design Studio'), 'galil-design-studio');
  assert.equal(packSlug('  גליל עיצוב  '), 'workspace', 'a name with no Latin letters still gets a usable folder');
  assert.equal(packSlug('A/B\\C:D*E?F"G<H>I|J'), 'a-b-c-d-e-f-g-h-i-j');
  assert.equal(csvMoney(170000), '1700.00');
});
