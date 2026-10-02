/**
 * AF-03: a deposit on an invoice is a payment in advance. Tax is charged on the full invoice;
 * the deposit only lowers the amount still due. In the ledger the invoice moves the deposit
 * from the Customer Deposits liability (where the money was booked when it came in) against
 * the receivable.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAmountDue,
  calculateDocumentNet,
  calculateDocumentTax,
  cashPostedWithDocumentCents,
  depositAppliedCents,
  settledStatus,
} from '../lib/documentMath';
import { lineAmount } from '../lib/txFilters';
import { findPostingMismatches } from '../lib/postingCheck';
import { makeChartAccount, makeInvoice } from './fixtures';
import type { Transaction, Workspace } from '../types';

// 100.00 of lines + 20% tax = 120.00 owed; a 30.00 deposit was paid in advance
const invoice = { amountCents: 12000, taxAmountCents: 2000, taxVersion: 2, depositCents: 3000 };

describe('Deposit rule', () => {
  test('tax is on the full invoice: the deposit changes neither the tax nor the net', () => {
    const withoutDeposit = { ...invoice, depositCents: 0 };
    assert.equal(calculateDocumentTax(invoice), 2000);
    assert.equal(calculateDocumentTax(invoice), calculateDocumentTax(withoutDeposit));
    assert.equal(calculateDocumentNet(invoice), 10000);
    assert.equal(calculateDocumentNet(invoice), calculateDocumentNet(withoutDeposit));
    // older rate-based invoices too: 10% on 100.00, deposit or not
    const rateBased = { amountCents: 10000, taxRate: 10, depositCents: 5000 };
    assert.equal(calculateDocumentTax(rateBased), 1000);
  });

  test('the deposit lowers the amount due, together with payments', () => {
    assert.equal(calculateAmountDue(invoice), 9000);
    assert.equal(calculateAmountDue({ ...invoice, amountPaidCents: 4000 }), 5000);
    assert.equal(calculateAmountDue({ ...invoice, amountPaidCents: 9000 }), 0);
  });

  test('a deposit is never more than the total, and never negative', () => {
    assert.equal(depositAppliedCents({ amountCents: 12000, depositCents: 50000 }), 12000);
    assert.equal(calculateAmountDue({ amountCents: 12000, depositCents: 50000 }), 0);
    assert.equal(depositAppliedCents({ amountCents: 12000, depositCents: -500 }), 0);
    assert.equal(depositAppliedCents({ amountCents: 12000 }), 0);
  });

  test('paying what the deposit left marks the invoice paid', () => {
    assert.equal(settledStatus(invoice, 9000), 'paid');
    assert.equal(settledStatus(invoice, 4000), 'partially_paid');
    assert.equal(settledStatus({ amountCents: 12000 }, 9000), 'partially_paid', 'no deposit: the full total is due');
  });

  test('"mark as paid" posts as cash only what the deposit left', () => {
    assert.equal(cashPostedWithDocumentCents({ ...invoice, status: 'paid' }), 9000);
    assert.equal(cashPostedWithDocumentCents({ amountCents: 12000, status: 'paid' }), 12000);
  });
});

type Posted = Transaction & { metadata?: Record<string, unknown> };

describe('Deposit in the ledger', () => {
  const sent: Posted[][] = [];
  const realFetch = globalThis.fetch;
  let LedgerPostService: typeof import('../services/LedgerPostService').LedgerPostService;

  before(async () => {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      sent.push(JSON.parse(String(init?.body || '{}')).transactions || []);
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    ({ LedgerPostService } = await import('../services/LedgerPostService'));
  });
  after(() => { globalThis.fetch = realFetch; });

  const accounts = [
    makeChartAccount({ id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables' }),
    makeChartAccount({ id: 'cash', name: 'Checking', type: 'asset', category: 'Cash' }),
    makeChartAccount({ id: 'rev', name: 'Sales', type: 'income', category: 'Revenue' }),
    makeChartAccount({ id: 'tax', name: 'Sales Tax Payable', type: 'liability', category: 'Taxes' }),
    makeChartAccount({ id: 'dep', name: 'Customer Deposits', type: 'liability', category: 'Current Liabilities' }),
  ];
  const context = (list = accounts) => ({
    lockDate: null,
    transactions: [],
    inventory: [],
    workspaces: [{ id: 'w1', uid: 'u1', name: 'W', currency: 'USD' } as Workspace],
    accounts: list,
  });
  const byAccount = (tx: Posted) => Object.fromEntries(tx.lines.map(l => [l.accountId, lineAmount(l, tx)]));
  const doc = {
    number: 'INV-7', customerId: 'c1', customerName: 'Acme', date: '2026-05-04', dueDate: '2026-06-04',
    ...invoice, status: 'pending' as const,
  };

  test('the invoice posts tax on the full total and applies the deposit against the receivable', async () => {
    sent.length = 0;
    await LedgerPostService.postInvoiceLedger('inv7', doc, 'w1', 'u1', undefined, context());
    const [accrual, deposit] = sent[0];
    assert.equal(byAccount(accrual).ar, 12000);
    assert.equal(byAccount(accrual).tax, -2000, 'tax on the full 120.00');
    assert.equal(byAccount(accrual).rev, -10000);
    assert.equal(deposit.metadata?.type, 'invoice-deposit');
    assert.equal(byAccount(deposit).dep, 3000, 'DR Customer Deposits');
    assert.equal(byAccount(deposit).ar, -3000, 'CR Accounts Receivable');
    for (const tx of sent[0]) assert.equal(tx.lines.reduce((s, l) => s + lineAmount(l, tx), 0), 0, 'balanced');
    // what is left in receivables equals what the customer still owes
    const receivable = sent[0].reduce((s, tx) => s + (byAccount(tx).ar || 0), 0);
    assert.equal(receivable, calculateAmountDue(doc));
    // the repost check still sees one matching accrual (the deposit entry is separate)
    const issues = findPostingMismatches({ invoices: [makeInvoice({ id: 'inv7', ...doc })], bills: [], transactions: sent[0].map((t, i) => ({ ...t, id: `t${i}` })) });
    assert.deepEqual(issues, []);
  });

  test('paid in full: cash is only what the deposit left', async () => {
    sent.length = 0;
    await LedgerPostService.postInvoiceLedger('inv7', { ...doc, status: 'paid' }, 'w1', 'u1', undefined, context());
    const payment = sent[0].find(t => t.metadata?.type === 'invoice-payment');
    assert.ok(payment);
    assert.equal(byAccount(payment).cash, 9000);
    const receivable = sent[0].reduce((s, tx) => s + (byAccount(tx).ar || 0), 0);
    assert.equal(receivable, 0, 'nothing left owed');
  });

  test('without a Customer Deposits account the invoice is refused with the account to add', async () => {
    await assert.rejects(
      LedgerPostService.postInvoiceLedger('inv8', doc, 'w1', 'u1', undefined, context(accounts.filter(a => a.id !== 'dep'))),
      /Customer Deposits/,
    );
  });
});
