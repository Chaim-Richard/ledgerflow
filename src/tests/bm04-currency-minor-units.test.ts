/**
 * BM-04 + BH-02: money is stored in the minor units of its own currency (ISO 4217 decimals: yen 0, dinars 3, the rest 2)
 * and converted with the difference in decimals (src/lib/currencyMinorUnits.ts). Figures by hand:
 *   typed ¥1,000 → 1,000 (yen have no minor unit); KWD 12.345 → 12,345 fils; BHD 0.5 → 500; $12.30 → 1,230 cents
 *   ¥10,000 at 0.0067 USD per yen: 10,000 × 0.0067 × 10^(2−0) = 6,700 cents = $67.00 (not 670,000 = $6,700)
 *   KWD 1.250 at 3.25 USD per dinar: 1,250 × 3.25 × 10^(2−3) = 406.25 → 406 cents = $4.06
 *   $12.34 at 150 yen per dollar: 1,234 × 150 × 10^(0−2) = 1,851 yen
 *   BHD 2.000 at 0.82 KWD per dinar (both 3 decimals): 2,000 × 0.82 = 1,640 fils = KWD 1.640
 *   round trip: $67.00 back to yen at 1 / 0.0067: 6,700 × (1 / 0.0067) × 10^(0−2) = 10,000 yen
 *   an invoice of ¥100,000 at 0.0067 in a USD books → A/R +67,000 cents ($670.00), Sales −67,000; the entry keeps the
 *     document's own rate 0.0067; a bill of KWD 1.250 at 3.25 → A/P −406 cents
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { amountStep, convertMinorUnits, currencyDigits, minorToMajor, minorUnitRate } from '../lib/currencyMinorUnits';
import { TruthEngine } from '../modules/integrity/TruthEngine';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { postBillLedger } from '../services/ledgerPost/billPosting';
import type { LedgerPostContext } from '../services/ledgerPost/postingCore';
import type { Bill, ChartAccount, Invoice, Workspace } from '../types';

test('each currency has its ISO 4217 decimals', () => {
  assert.deepEqual(['JPY', 'KRW', 'KWD', 'BHD', 'OMR', 'USD', 'ILS', 'EUR', 'xyz', undefined].map(c => currencyDigits(c)), [0, 0, 3, 3, 3, 2, 2, 2, 2, 2]);
  assert.deepEqual(['JPY', 'KWD', 'USD'].map(amountStep), ['1', '0.001', '0.01']);
  assert.deepEqual([minorToMajor(1_000, 'JPY'), minorToMajor(12_345, 'KWD'), minorToMajor(1_230, 'USD')], [1_000, 12.345, 12.3]);
});

test('a typed amount is read in the currency\'s own decimals', () => {
  assert.equal(TruthEngine.parseAmountToCents('1,000', 'JPY'), 1_000);
  assert.equal(TruthEngine.parseAmountToCents('12.345', 'KWD'), 12_345);
  assert.equal(TruthEngine.parseAmountToCents('0.5', 'BHD'), 500);
  assert.equal(TruthEngine.parseAmountToCents('12.30', 'USD'), 1_230);
  assert.equal(TruthEngine.parseAmountToCents('12.30'), 1_230, 'no currency: cents, as before');
  assert.equal(TruthEngine.parseAmountToCents('1000+250', 'JPY'), 1_250, 'a sum typed in yen');
  assert.equal(TruthEngine.parseAmountToCents('1.5*2', 'KWD'), 3_000);
});

test('converting minor units uses the difference in decimals', () => {
  assert.equal(convertMinorUnits(10_000, 0.0067, 'JPY', 'USD'), 6_700, '¥10,000 = $67.00');
  assert.equal(convertMinorUnits(1_250, 3.25, 'KWD', 'USD'), 406, 'KWD 1.250 = $4.06');
  assert.equal(convertMinorUnits(1_234, 150, 'USD', 'JPY'), 1_851, '$12.34 = ¥1,851');
  assert.equal(convertMinorUnits(2_000, 0.82, 'BHD', 'KWD'), 1_640, 'BHD 2.000 = KWD 1.640');
  assert.equal(convertMinorUnits(6_700, 1 / 0.0067, 'USD', 'JPY'), 10_000, 'and back');
  assert.equal(minorUnitRate(1.1, 'EUR', 'USD'), 1.1, 'the same decimals: the rate itself');
  assert.equal(minorUnitRate(1.1, 'USD', 'USD'), 1.1);
});

const WS = 'ws_bm04';
const accounts = [
  { id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
  { id: 'ap', name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' },
  { id: 'bank', name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
  { id: 'sales', name: 'Sales', type: 'income', code: '4000' },
  { id: 'supplies', name: 'Supplies', type: 'expense', code: '6000' },
].map(a => ({ ...a, workspaceId: WS })) as unknown as ChartAccount[];
const context = (): LedgerPostContext => ({
  accounts, workspaces: [{ id: WS, uid: 'u1', name: 'US books', currency: 'USD', defaultAccountMappings: { ar: 'ar', ap: 'ap', revenue: 'sales' } } as unknown as Workspace],
  transactions: [], inventory: [], lockDate: null, uid: 'u1', today: '2026-10-22', capture: [],
});
const lines = (c: LedgerPostContext) => c.capture!.flatMap(x => x.txs).flatMap(t => t.lines.map(l => [l.accountId, l.amountCents]));

test('an invoice of ¥100,000 at 0.0067 in USD books: A/R +$670.00, the document\'s rate kept', async () => {
  const c = context();
  const invoice = { id: 'inv-jpy', workspaceId: WS, number: 'INV-JP1', customerName: 'Tokyo KK', customerId: 'c1', date: '2026-10-22', dueDate: '2026-11-21', status: 'sent', currency: 'JPY', exchangeRate: 0.0067, amountCents: 100_000, items: [{ id: 'l1', description: 'Licence', quantity: 1, rateCents: 100_000, amountCents: 100_000 }] } as unknown as Invoice;
  await postInvoiceLedger(invoice.id!, invoice, WS, 'u1', { collection: 'invoices', docId: invoice.id!, action: 'create' }, c);
  assert.deepEqual(lines(c), [['ar', 67_000], ['sales', -67_000]]);
  const [entry] = c.capture![0].txs;
  assert.deepEqual([entry.currency, entry.metadata?.documentCurrency, entry.metadata?.documentExchangeRate], ['USD', 'JPY', 0.0067]);
});

test('a bill of KWD 1.250 at 3.25 in USD books: A/P −$4.06', async () => {
  const c = context();
  const bill = { id: 'bill-kwd', workspaceId: WS, number: 'B-KW1', vendorName: 'Gulf Supplies', vendorId: 'v1', date: '2026-10-22', dueDate: '2026-11-21', status: 'pending', currency: 'KWD', exchangeRate: 3.25, amountCents: 1_250, splits: [{ accountId: 'supplies', amountCents: 1_250, description: 'Paper' }] } as unknown as Bill;
  await postBillLedger(bill.id!, bill, WS, 'u1', { collection: 'bills', docId: bill.id!, action: 'create' }, c);
  assert.deepEqual(lines(c), [['supplies', 406], ['ap', -406]]);
});
