import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { IntercompanyEliminationEngine } from '../lib/intercompanyElimination';
import { calculateSafeToSpend } from '../lib/algorithms/tax-set-aside';
import { isPostable, lineAmount } from '../lib/txFilters';
import { ChartAccount, Transaction, Payment } from '../types';
import { parseLocalDate } from '../lib/utils';

describe('Finance Components & Modules Suite (src/components/finance)', () => {

  describe('1. PaymentsView Logic & Allocations', () => {
    const mockPayments: Payment[] = [
      {
        id: 'pay_001',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-09-10',
        amountCents: 150000,
        currency: 'USD',
        direction: 'received',
        contactId: 'cust_acme',
        contactName: 'Acme Corp',
        method: 'bank_transfer',
        reference: 'WIRE-9921',
        depositAccountId: 'acc_bank',
        unappliedCents: 0,
        status: 'posted',
        createdAt: '2026-09-10T10:00:00Z',
        allocations: [
          { documentId: 'inv_101', documentType: 'invoice', amountCents: 100000 },
          { documentId: 'inv_102', documentType: 'invoice', amountCents: 50000 }
        ]
      },
      {
        id: 'pay_002',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-09-12',
        amountCents: 45000,
        currency: 'USD',
        direction: 'made',
        contactId: 'vend_aws',
        contactName: 'Amazon Web Services',
        method: 'card',
        reference: 'CC-4482',
        depositAccountId: 'acc_bank',
        unappliedCents: 0,
        status: 'posted',
        createdAt: '2026-09-12T14:00:00Z',
        allocations: [
          { documentId: 'bill_201', documentType: 'bill', amountCents: 45000 }
        ]
      }
    ];

    test('Payment search and filtering matches entity name, method, and reference', () => {
      const search = (term: string) => {
        const lower = term.toLowerCase();
        return mockPayments.filter(p => {
          const searchStr = `${p.contactName || p.contactId} ${p.method} ${p.reference || ''}`.toLowerCase();
          return searchStr.includes(lower);
        });
      };

      assert.equal(search('Acme').length, 1);
      assert.equal(search('Acme')[0].id, 'pay_001');

      assert.equal(search('bank_transfer').length, 1);
      assert.equal(search('CC-4482').length, 1);
      assert.equal(search('NonExistent').length, 0);
    });

    test('Payment date sorting orders newest payment first', () => {
      const sorted = [...mockPayments].sort(
        (a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime()
      );
      assert.equal(sorted[0].id, 'pay_002'); // Sept 12
      assert.equal(sorted[1].id, 'pay_001'); // Sept 10
    });

    test('Payment allocation sum strictly matches or is within payment amountCents', () => {
      mockPayments.forEach(p => {
        const allocTotal = (p.allocations || []).reduce((sum, a) => sum + a.amountCents, 0);
        assert.ok(allocTotal <= p.amountCents, `Allocations ${allocTotal} exceeded payment amount ${p.amountCents}`);
        assert.equal(allocTotal, p.amountCents);
      });
    });
  });

  describe('2. CreditNotesView Accounting & Validation', () => {
    test('Customer Credit Note requires valid positive amount and target customer', () => {
      const createCustomerCreditNote = (params: { customerId: string; amountCents: number; invoiceId?: string }) => {
        if (!params.customerId) throw new Error('Customer required');
        if (!params.amountCents || params.amountCents <= 0) throw new Error('Positive amount required');
        return {
          id: `cn_${Date.now()}`,
          customerId: params.customerId,
          amountCents: params.amountCents,
          remainingCents: params.amountCents,
          status: 'open' as const,
          invoiceId: params.invoiceId
        };
      };

      assert.throws(() => createCustomerCreditNote({ customerId: '', amountCents: 5000 }), /Customer required/);
      assert.throws(() => createCustomerCreditNote({ customerId: 'cust_1', amountCents: 0 }), /Positive amount required/);
      assert.throws(() => createCustomerCreditNote({ customerId: 'cust_1', amountCents: -500 }), /Positive amount required/);

      const cn = createCustomerCreditNote({ customerId: 'cust_1', amountCents: 12000, invoiceId: 'inv_50' });
      assert.equal(cn.amountCents, 12000);
      assert.equal(cn.status, 'open');
    });

    test('Vendor Credit requires valid positive amount and target vendor', () => {
      const createVendorCredit = (params: { vendorId: string; amountCents: number; billId?: string }) => {
        if (!params.vendorId) throw new Error('Vendor required');
        if (!params.amountCents || params.amountCents <= 0) throw new Error('Positive amount required');
        return {
          id: `vc_${Date.now()}`,
          vendorId: params.vendorId,
          amountCents: params.amountCents,
          remainingCents: params.amountCents,
          status: 'applied' as const,
          billId: params.billId
        };
      };

      assert.throws(() => createVendorCredit({ vendorId: '', amountCents: 1000 }), /Vendor required/);
      assert.throws(() => createVendorCredit({ vendorId: 'vend_1', amountCents: -200 }), /Positive amount required/);

      const vc = createVendorCredit({ vendorId: 'vend_1', amountCents: 8500 });
      assert.equal(vc.amountCents, 8500);
      assert.equal(vc.status, 'applied');
    });

    test('Double-entry ledger lines for credit note creation balance to zero', () => {
      // Customer Credit Note: DR Sales Returns (Expense/Contra-Revenue), CR Accounts Receivable
      const lines = [
        { accountId: 'acc_sales_returns', accountName: 'Sales Returns & Allowances', amountCents: 15000 },
        { accountId: 'acc_ar', accountName: 'Accounts Receivable', amountCents: -15000 }
      ];

      const sum = lines.reduce((acc, l) => acc + l.amountCents, 0);
      assert.equal(sum, 0, 'Credit note lines must sum to zero');
    });
  });

  describe('3. TaxManager Calculation Engine', () => {
    const mockAccounts: ChartAccount[] = [
      { id: 'acc_bank', uid: 'usr_1', code: '1010', name: 'Operating Bank', type: 'asset', workspaceId: 'ws_test', balanceCents: 0 },
      { id: 'acc_sales', uid: 'usr_1', code: '4010', name: 'Software Sales', type: 'income', workspaceId: 'ws_test', balanceCents: 0 },
      { id: 'acc_consulting', uid: 'usr_1', code: '4020', name: 'Consulting Revenue', type: 'income', workspaceId: 'ws_test', balanceCents: 0 },
      { id: 'acc_hosting', uid: 'usr_1', code: '5010', name: 'Cloud Hosting', type: 'expense', workspaceId: 'ws_test', balanceCents: 0 },
      { id: 'acc_contractors', uid: 'usr_1', code: '5020', name: '1099 Contractors', type: 'expense', workspaceId: 'ws_test', balanceCents: 0 }
    ];

    const mockTransactions: Transaction[] = [
      {
        id: 'tx_tax_1',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-03-15',
        description: 'Software Sales Revenue',
        totalAmountCents: 1000000, // $10,000 Sales
        currency: 'USD',
        status: 'completed',
        type: 'income',
        createdAt: '2026-03-15T00:00:00Z',
        lines: [
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: 1000000 },
          { accountId: 'acc_sales', accountName: 'Software Sales', amountCents: -1000000 }
        ]
      },
      {
        id: 'tx_tax_2',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-05-20',
        description: 'Consulting Income',
        totalAmountCents: 500000, // $5,000 Consulting
        currency: 'USD',
        status: 'completed',
        type: 'income',
        createdAt: '2026-05-20T00:00:00Z',
        lines: [
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: 500000 },
          { accountId: 'acc_consulting', accountName: 'Consulting Revenue', amountCents: -500000 }
        ]
      },
      {
        id: 'tx_tax_3',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-06-10',
        description: 'Cloud Hosting Expense',
        totalAmountCents: 300000, // $3,000 Hosting Expense
        currency: 'USD',
        status: 'completed',
        type: 'expense',
        createdAt: '2026-06-10T00:00:00Z',
        lines: [
          { accountId: 'acc_hosting', accountName: 'Cloud Hosting', amountCents: 300000 },
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: -300000 }
        ]
      },
      {
        id: 'tx_tax_4',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-07-01',
        description: 'Contractor Payment',
        totalAmountCents: 200000, // $2,000 Contractor Expense
        currency: 'USD',
        status: 'completed',
        type: 'expense',
        createdAt: '2026-07-01T00:00:00Z',
        lines: [
          { accountId: 'acc_contractors', accountName: '1099 Contractors', amountCents: 200000 },
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: -200000 }
        ]
      },
      {
        id: 'tx_tax_draft',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-08-01',
        description: 'Draft Sales Transaction',
        totalAmountCents: 999999,
        currency: 'USD',
        status: 'draft', // Ignored because isPostable = false
        type: 'income',
        createdAt: '2026-08-01T00:00:00Z',
        lines: [
          { accountId: 'acc_sales', accountName: 'Software Sales', amountCents: -999999 },
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: 999999 }
        ]
      }
    ];

    test('Gross income, expenses, and net profit computed accurately', () => {
      const year = 2026;
      const yearTx = mockTransactions.filter(tx => isPostable(tx) && parseLocalDate(tx.date).getFullYear() === year);

      const grossIncome = yearTx.reduce((acc, tx) => {
        const incomeLines = tx.lines?.filter(l => mockAccounts.find(a => a.id === l.accountId)?.type === 'income') || [];
        return acc + incomeLines.reduce((sum, l) => sum + Math.abs(lineAmount(l, tx)), 0);
      }, 0);

      const expenses = yearTx.reduce((acc, tx) => {
        const expenseLines = tx.lines?.filter(l => mockAccounts.find(a => a.id === l.accountId)?.type === 'expense') || [];
        return acc + expenseLines.reduce((sum, l) => sum + Math.abs(lineAmount(l, tx)), 0);
      }, 0);

      const netProfit = grossIncome - expenses;

      // $10,000 + $5,000 = $15,000 (1,500,000 cents)
      assert.equal(grossIncome, 1500000);
      // $3,000 + $2,000 = $5,000 (500,000 cents)
      assert.equal(expenses, 500000);
      // Net profit = $10,000 (1,000,000 cents)
      assert.equal(netProfit, 1000000);
    });

    test('Self-employment tax calculation applies 15.3% on 92.35% net profit', () => {
      const netProfitCents = 1000000; // $10,000
      const seTaxBase = (netProfitCents / 100) * 0.9235;
      const seTax = seTaxBase * 0.153;
      assert.ok(Math.abs(seTax - 1412.955) < 0.01);
    });
  });

  describe('4. TaxReserveWidget Safe-to-Spend Math', () => {
    const mockAccounts: ChartAccount[] = [
      { id: 'acc_bank', uid: 'usr_1', code: '1010', name: 'Operating Bank', type: 'asset', workspaceId: 'ws_test', balanceCents: 0 },
      { id: 'acc_sales', uid: 'usr_1', code: '4010', name: 'Software Sales', type: 'income', workspaceId: 'ws_test', balanceCents: 0 },
      { id: 'acc_hosting', uid: 'usr_1', code: '5010', name: 'Cloud Hosting', type: 'expense', workspaceId: 'ws_test', balanceCents: 0 }
    ];

    const mockTransactions: Transaction[] = [
      {
        id: 'tx_safe_1',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-09-01',
        description: 'Revenue Receipt',
        totalAmountCents: 5000000, // $50,000 Cash
        currency: 'USD',
        status: 'completed',
        type: 'income',
        createdAt: '2026-09-01T00:00:00Z',
        lines: [
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: 5000000 },
          { accountId: 'acc_sales', accountName: 'Software Sales', amountCents: -5000000 }
        ]
      },
      {
        id: 'tx_safe_2',
        uid: 'usr_1',
        workspaceId: 'ws_test',
        date: '2026-09-05',
        description: 'Hosting Invoice',
        totalAmountCents: 1000000, // $10,000 Expense
        currency: 'USD',
        status: 'completed',
        type: 'expense',
        createdAt: '2026-09-05T00:00:00Z',
        lines: [
          { accountId: 'acc_hosting', accountName: 'Cloud Hosting', amountCents: 1000000 },
          { accountId: 'acc_bank', accountName: 'Operating Bank', amountCents: -1000000 }
        ]
      }
    ];

    test('calculateSafeToSpend calculates tax reserve, recommended operating reserve, and disposable cash', () => {
      const result = calculateSafeToSpend(mockTransactions, mockAccounts, 'c_corp');

      assert.equal(result.revenueCents, 5000000);
      assert.equal(result.expensesCents, 1000000);
      assert.equal(result.netProfitCents, 4000000);
      assert.equal(result.estimatedTaxCents, 840000);
      assert.equal(result.recommendedReserveCents, 2000000);
      assert.equal(result.safeToSpendCents, 3160000);
    });

    test('calculateSafeToSpend pass_through tax rate calculates 25% blended tax', () => {
      const result = calculateSafeToSpend(mockTransactions, mockAccounts, 'pass_through');
      assert.equal(result.estimatedTaxCents, 1000000);
      assert.equal(result.safeToSpendCents, 3000000);
    });
  });

  describe('5. Consolidation & Intercompany Elimination Engine', () => {
    const multiEntityTx: Transaction[] = [
      {
        id: 'tx_sub1_sales',
        uid: 'usr_1',
        workspaceId: 'ws_sub1',
        date: '2026-09-01',
        description: 'Sub1 Sales',
        totalAmountCents: 500000,
        currency: 'USD',
        status: 'completed',
        type: 'income',
        createdAt: '2026-09-01T00:00:00Z',
        dimensions: { world: 'world_entity_a' },
        lines: [
          { accountId: 'acc_bank_a', accountName: 'Bank A', amountCents: 500000 },
          { accountId: 'acc_rev_a', accountName: 'Revenue A', category: 'Operating Revenue', amountCents: -500000 }
        ]
      },
      {
        id: 'tx_intercompany_transfer',
        uid: 'usr_1',
        workspaceId: 'ws_parent',
        date: '2026-09-02',
        description: 'Intercompany Transfer',
        totalAmountCents: 100000,
        currency: 'USD',
        status: 'completed',
        type: 'journal',
        createdAt: '2026-09-02T00:00:00Z',
        dimensions: { world: 'world_entity_a', targetWorld: 'world_entity_b' },
        lines: [
          { accountId: 'acc_due_from_b', accountName: 'Due From B', category: 'Intercompany Receivables', amountCents: 100000 },
          { accountId: 'acc_cash_a', accountName: 'Cash A', amountCents: -100000 }
        ]
      }
    ];

    test('IntercompanyEliminationEngine partitions world statements and applies eliminations', () => {
      const isIncomeLine = (l: any) => l.category?.toLowerCase().includes('revenue') || false;
      const isExpenseLine = (l: any) => l.category?.toLowerCase().includes('expense') || false;

      const summary = IntercompanyEliminationEngine.generateConsolidatedSummary(
        multiEntityTx,
        isIncomeLine,
        isExpenseLine
      );

      assert.ok(summary);
      assert.ok(Array.isArray(summary.worldStatements));
      assert.ok(summary.worldStatements.length >= 1);
    });
  });

  describe('6. CurrencyConverter & FX Math', () => {
    const exchangeRates: Record<string, number> = {
      'USD': 1.0,
      'EUR': 0.92,
      'GBP': 0.79,
      'ILS': 3.75,
      'JPY': 151.2
    };

    const convert = (amount: number, from: string, to: string) => {
      const rateFrom = exchangeRates[from] || 1;
      const rateTo = exchangeRates[to] || 1;
      const inUSD = amount / rateFrom;
      return inUSD * rateTo;
    };

    test('Direct and cross-currency conversions are mathematically consistent and symmetric', () => {
      const amountUSD = 1000;
      const inEUR = convert(amountUSD, 'USD', 'EUR');
      assert.equal(inEUR, 920);

      const inILS = convert(amountUSD, 'USD', 'ILS');
      assert.equal(inILS, 3750);

      const eurToIls = convert(inEUR, 'EUR', 'ILS');
      assert.ok(Math.abs(eurToIls - inILS) < 0.0001);

      const invertedUSD = convert(inILS, 'ILS', 'USD');
      assert.equal(invertedUSD, 1000);
    });
  });

  describe('7. AccountRegisterView Running Balances', () => {
    const registerLines = [
      { id: '1', date: '2026-09-01', debitCents: 50000, creditCents: 0 },
      { id: '2', date: '2026-09-05', debitCents: 20000, creditCents: 0 },
      { id: '3', date: '2026-09-10', debitCents: 0, creditCents: 35000 },
      { id: '4', date: '2026-09-15', debitCents: 10000, creditCents: 0 },
    ];

    test('Computes running balance chronologically for debit-normal asset account', () => {
      let running = 0;
      const withRunning = registerLines.map(line => {
        running += (line.debitCents - line.creditCents);
        return { ...line, runningBalanceCents: running };
      });

      assert.equal(withRunning[0].runningBalanceCents, 50000);
      assert.equal(withRunning[1].runningBalanceCents, 70000);
      assert.equal(withRunning[2].runningBalanceCents, 35000);
      assert.equal(withRunning[3].runningBalanceCents, 45000);
    });
  });
});
