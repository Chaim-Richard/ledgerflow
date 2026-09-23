import { calculateNetIncome, isPostable, isRevenueAccount, isExpenseAccount, lineAmount, isTransactionInDateRange } from "../../lib/txFilters";
import { resolveAccountRole } from "../../lib/accountUtils";
import { calculateDocumentTax, calculateDocumentNet } from "../../lib/documentMath";
import type { Invoice, Bill } from "../../types";

export const INVOICE_IS_ISSUED = new Set<Invoice['status']>([
  'sent', 'approved', 'invoiced', 'pending', 'overdue', 'partially_paid', 'paid'
]);

export const BILL_IS_ISSUED = new Set<Bill['status']>([
  'pending', 'approved', 'unpaid', 'overdue', 'partially_paid', 'paid'
]);

export const INVOICE_COUNTS_FOR_TAX = INVOICE_IS_ISSUED;
export const BILL_COUNTS_FOR_TAX = BILL_IS_ISSUED;

export function computeProfitAndLoss(accounts: any[], transactions: any[], startDate?: string, endDate?: string) {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";
  const pl: any = {
    income: { total: 0, accounts: {} },
    cogs: { total: 0, accounts: {} },
    expense: { total: 0, accounts: {} },
    grossProfit: 0,
    netIncome: 0
  };
  accounts.forEach((acc: any) => {
    const isCogs = acc.type === 'cost_of_goods' || acc.category === 'COGS' || acc.category === 'Direct Costs' || resolveAccountRole(acc) === 'cogs';
    if (isRevenueAccount(acc)) {
      pl.income.accounts[acc.id] = { name: acc.name, code: acc.code, balance: 0, parentId: acc.parentId };
    } else if (isCogs) {
      pl.cogs.accounts[acc.id] = { name: acc.name, code: acc.code, balance: 0, parentId: acc.parentId };
    } else if (isExpenseAccount(acc)) {
      pl.expense.accounts[acc.id] = { name: acc.name, code: acc.code, balance: 0, parentId: acc.parentId };
    }
  });
  for (const tx of transactions) {
    if (!isPostable(tx)) continue;
    if (!isTransactionInDateRange(tx, start, end)) continue;
    tx.lines?.forEach((line: any) => {
      const amount = lineAmount(line, tx);
      if (pl.income.accounts[line.accountId]) {
        const val = -amount; 
        pl.income.accounts[line.accountId].balance += val;
        pl.income.total += val;
      } else if (pl.cogs.accounts[line.accountId]) {
        const val = amount;
        pl.cogs.accounts[line.accountId].balance += val;
        pl.cogs.total += val;
      } else if (pl.expense.accounts[line.accountId]) {
        const val = amount;
        pl.expense.accounts[line.accountId].balance += val;
        pl.expense.total += val;
      }
    });
  }
  const totals = calculateNetIncome(transactions, accounts, start, end);
  pl.grossProfit = totals.grossProfit;
  pl.netIncome = totals.netIncome;
  pl.income.total = totals.income;
  pl.cogs.total = totals.cogs;
  pl.expense.total = totals.expense;
  return pl;
}

export function computeBalanceSheet(accounts: any[], transactions: any[], endDate?: string) {
  const end = endDate || "2099-12-31";

  const balances: Record<string, number> = {};
  accounts.forEach((acc: any) => {
    balances[acc.id] = acc.openingBalanceCents || 0;
  });

  const orphanedLines: Array<{ accountId: string; transactionId?: string; date?: string; amountCents: number }> = [];

  for (const tx of transactions) {
    if (!isPostable(tx)) continue;
    if (!isTransactionInDateRange(tx, undefined, end)) continue;
    tx.lines?.forEach((line: any) => {
      if (balances[line.accountId] !== undefined) {
        balances[line.accountId] += lineAmount(line, tx);
      } else {
        orphanedLines.push({
          accountId: line.accountId,
          transactionId: tx.id,
          date: tx.date,
          amountCents: lineAmount(line, tx)
        });
      }
    });
  }

  const { netIncome } = calculateNetIncome(transactions, accounts, "1970-01-01", end);

  const assets: Record<string, number> = {};
  const liabilities: Record<string, number> = {};
  const equity: Record<string, number> = {};

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  accounts.forEach((acc: any) => {
    const bal = balances[acc.id] || 0;
    if (acc.type === 'asset') {
      assets[acc.id] = bal;
      totalAssets += bal;
    } else if (acc.type === 'liability') {
      const val = -bal;
      liabilities[acc.id] = val;
      totalLiabilities += val;
    } else if (acc.type === 'equity') {
      const val = -bal;
      equity[acc.id] = val;
      totalEquity += val;
    }
  });

  // totalEquity stays equity-accounts-only, matching BalanceSheetView.tsx:182
  const totalClaims = totalLiabilities + totalEquity + netIncome;
  const isBalanced = totalAssets === totalClaims;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome,
    totalClaims,
    isBalanced,
    orphanedLines
  };
}

export function computeTrialBalance(accounts: any[], transactions: any[], asOfDate?: string) {
  const trialBalance: Record<string, { name: string, code?: string, type: string, debit: number, credit: number, netSigned: number }> = {};
  accounts.forEach((acc: any) => {
    const opening = acc.openingBalanceCents || 0;
    const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(acc.type);
    trialBalance[acc.id] = {
      name: acc.name,
      code: acc.code,
      type: acc.type,
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? Math.abs(opening) : 0,
      netSigned: opening
    };
  });
  for (const tx of transactions) {
    if (!isPostable(tx)) continue;
    if (asOfDate && !isTransactionInDateRange(tx, undefined, asOfDate)) continue;
    tx.lines?.forEach((line: any) => {
      const amount = lineAmount(line, tx);
      if (trialBalance[line.accountId]) {
        const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(trialBalance[line.accountId].type);
        if (amount > 0) {
          trialBalance[line.accountId].debit += amount;
        } else {
          trialBalance[line.accountId].credit += Math.abs(amount);
        }
        trialBalance[line.accountId].netSigned += (isDebitNature ? amount : -amount);
      }
    });
  }
  const totalDebit = Object.values(trialBalance).reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredit = Object.values(trialBalance).reduce((sum, acc) => sum + acc.credit, 0);
  const accountsArray = Object.entries(trialBalance).map(([id, acc]) => ({
    id,
    name: acc.name,
    code: acc.code,
    type: acc.type,
    debit: acc.debit,
    credit: acc.credit,
    netSigned: acc.netSigned
  }));
  return { accounts: accountsArray, totalDebit, totalCredit, isBalanced: totalDebit === totalCredit };
}

export function computeCashFlow(accounts: any[], transactions: any[], startDate?: string, endDate?: string) {
  let filteredTx = transactions;
  if (startDate || endDate) {
    const start = startDate ? String(startDate) : "1970-01-01";
    const end = endDate ? String(endDate) : "2099-12-31";
    filteredTx = transactions.filter((tx: any) => isTransactionInDateRange(tx, start, end));
  }

  const cashFlow = {
    operating: { total: 0, inflow: 0, outflow: 0, items: [] as any[] },
    investing: { total: 0, inflow: 0, outflow: 0, items: [] as any[] },
    financing: { total: 0, inflow: 0, outflow: 0, items: [] as any[] },
    netChange: 0
  };

  filteredTx.forEach((tx: any) => {
    if (!isPostable(tx)) return;
    tx.lines?.forEach((line: any) => {
      const acc = accounts.find((a: any) => a.id === line.accountId);
      if (!acc) return;
      const amount = lineAmount(line, tx);
      const delta = -amount;

      if (acc.type === 'income' || acc.type === 'revenue' || acc.type === 'expense' || acc.type === 'cost_of_goods' || acc.type === 'cogs' ||
          (acc.type === 'asset' && (acc.category === 'Receivables' || acc.category === 'Receivable' || acc.category === 'Accounts Receivable')) ||
          (acc.type === 'liability' && (acc.category === 'Payables' || acc.category === 'Payable' || acc.category === 'Accounts Payable'))) {
        cashFlow.operating.total += delta;
        if (delta > 0) cashFlow.operating.inflow += delta;
        else cashFlow.operating.outflow += Math.abs(delta);
      } else if (acc.type === 'asset' && (acc.category === 'Fixed Assets' || acc.category === 'Fixed Asset')) {
        cashFlow.investing.total += delta;
        if (delta > 0) cashFlow.investing.inflow += delta;
        else cashFlow.investing.outflow += Math.abs(delta);
        cashFlow.investing.items.push({ name: tx.description, amount: delta });
      } else if (acc.type === 'equity' || (acc.type === 'liability' && (acc.category === 'Long Term Liabilities' || acc.category === 'Long Term Liability'))) {
        cashFlow.financing.total += delta;
        if (delta > 0) cashFlow.financing.inflow += delta;
        else cashFlow.financing.outflow += Math.abs(delta);
        cashFlow.financing.items.push({ name: tx.description, amount: delta });
      }
    });
  });

  cashFlow.netChange = cashFlow.operating.total + cashFlow.investing.total + cashFlow.financing.total;

  return cashFlow;
}

export function computeGeneralLedger(accounts: any[], transactions: any[], startDate?: string, endDate?: string, targetAccountId?: string) {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";

  const targetAccounts = targetAccountId
    ? accounts.filter((a: any) => a.id === targetAccountId)
    : accounts;

  const resultAccounts = targetAccounts.map((acc: any) => {
    let openingBalanceCents = acc.openingBalanceCents || 0;
    const isDebitNature = ['asset', 'expense', 'cost_of_goods'].includes(acc.type);

    // Compute prior period postings
    transactions.forEach((tx: any) => {
      if (!isPostable(tx)) return;
      if (tx.date && tx.date < start) {
        tx.lines?.forEach((line: any) => {
          if (line.accountId === acc.id) {
            const amt = lineAmount(line, tx);
            openingBalanceCents += isDebitNature ? amt : -amt;
          }
        });
      }
    });

    const periodTxs = transactions.filter((tx: any) => {
      if (!isPostable(tx)) return false;
      return isTransactionInDateRange(tx, start, end);
    }).sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

    let runningBalanceCents = openingBalanceCents;
    let periodDebitsCents = 0;
    let periodCreditsCents = 0;
    const entries: any[] = [];

    periodTxs.forEach((tx: any) => {
      tx.lines?.forEach((line: any) => {
        if (line.accountId === acc.id) {
          const amt = lineAmount(line, tx);
          const debitCents = amt > 0 ? amt : 0;
          const creditCents = amt < 0 ? Math.abs(amt) : 0;

          periodDebitsCents += debitCents;
          periodCreditsCents += creditCents;

          const netEffect = isDebitNature ? amt : -amt;
          runningBalanceCents += netEffect;

          entries.push({
            transactionId: tx.id || '',
            date: tx.date || '',
            description: tx.description || '',
            reference: tx.reference || line.description || '',
            debitCents,
            creditCents,
            runningBalanceCents
          });
        }
      });
    });

    return {
      accountId: acc.id,
      accountCode: acc.code || '',
      accountName: acc.name,
      type: acc.type,
      category: acc.category || '',
      openingBalanceCents,
      periodDebitsCents,
      periodCreditsCents,
      endingBalanceCents: runningBalanceCents,
      entries
    };
  });

  return {
    startDate: start,
    endDate: end,
    accounts: resultAccounts
  };
}

export function computeStatement(
  contact: any,
  invoices: any[],
  bills: any[],
  payments: any[],
  startDate: string,
  endDate: string,
  type: 'customer' | 'vendor'
) {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";

  const contactId = contact?.id || '';
  const isCustomer = type === 'customer';

  // Build prior balance
  let openingBalanceCents = 0;

  if (isCustomer) {
    invoices.filter((inv: any) => inv.customerId === contactId && inv.date < start && INVOICE_IS_ISSUED.has(inv.status)).forEach((inv: any) => {
      openingBalanceCents += (inv.amountCents || 0);
    });
    payments.filter((p: any) => p.contactId === contactId && p.date < start && p.direction === 'received' && (p.status === 'posted' || p.status === 'completed' || (!p.status && p.status !== 'void' && p.status !== 'draft'))).forEach((p: any) => {
      openingBalanceCents -= (p.amountCents || 0);
    });
  } else {
    bills.filter((b: any) => b.vendorId === contactId && (b.date || b.issueDate || '') < start && BILL_IS_ISSUED.has(b.status)).forEach((b: any) => {
      openingBalanceCents += (b.amountCents || 0);
    });
    payments.filter((p: any) => p.contactId === contactId && p.date < start && p.direction === 'made' && (p.status === 'posted' || p.status === 'completed' || (!p.status && p.status !== 'void' && p.status !== 'draft'))).forEach((p: any) => {
      openingBalanceCents -= (p.amountCents || 0);
    });
  }

  // Activity stream in range
  const activityItems: any[] = [];

  if (isCustomer) {
    invoices.filter((inv: any) => inv.customerId === contactId && inv.date >= start && inv.date <= end && INVOICE_IS_ISSUED.has(inv.status)).forEach((inv: any) => {
      activityItems.push({
        id: inv.id,
        date: inv.date,
        type: 'Invoice',
        reference: inv.number || inv.id,
        amountCents: (inv.amountCents || 0),
        creditCents: 0,
        debitCents: (inv.amountCents || 0)
      });
    });
    payments.filter((p: any) => p.contactId === contactId && p.date >= start && p.date <= end && p.direction === 'received' && (p.status === 'posted' || p.status === 'completed' || (!p.status && p.status !== 'void' && p.status !== 'draft'))).forEach((p: any) => {
      activityItems.push({
        id: p.id,
        date: p.date,
        type: 'Payment',
        reference: p.reference || p.id,
        amountCents: -(p.amountCents || 0),
        creditCents: (p.amountCents || 0),
        debitCents: 0
      });
    });
  } else {
    bills.filter((b: any) => b.vendorId === contactId && (b.date || b.issueDate || '') >= start && (b.date || b.issueDate || '') <= end && BILL_IS_ISSUED.has(b.status)).forEach((b: any) => {
      activityItems.push({
        id: b.id,
        date: b.date || b.issueDate || '',
        type: 'Bill',
        reference: b.number || b.id,
        amountCents: (b.amountCents || 0),
        creditCents: 0,
        debitCents: (b.amountCents || 0)
      });
    });
    payments.filter((p: any) => p.contactId === contactId && p.date >= start && p.date <= end && p.direction === 'made' && (p.status === 'posted' || p.status === 'completed' || (!p.status && p.status !== 'void' && p.status !== 'draft'))).forEach((p: any) => {
      activityItems.push({
        id: p.id,
        date: p.date,
        type: 'Payment',
        reference: p.reference || p.id,
        amountCents: -(p.amountCents || 0),
        creditCents: (p.amountCents || 0),
        debitCents: 0
      });
    });
  }

  activityItems.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let runningBalanceCents = openingBalanceCents;
  const entries = activityItems.map(item => {
    runningBalanceCents += item.amountCents;
    return {
      ...item,
      runningBalanceCents
    };
  });

  return {
    contactId,
    contactName: contact?.name || 'Contact',
    type,
    startDate: start,
    endDate: end,
    openingBalanceCents,
    endingBalanceCents: runningBalanceCents,
    entries
  };
}

export function computeTaxLiability(invoices: any[], bills: any[], startDate?: string, endDate?: string) {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";

  let taxableSalesCents = 0;
  let taxCollectedCents = 0;
  let taxablePurchasesCents = 0;
  let taxPaidCents = 0;

  invoices.forEach((inv: any) => {
    if (inv.date >= start && inv.date <= end && INVOICE_COUNTS_FOR_TAX.has(inv.status)) {
      const tax = calculateDocumentTax(inv);
      const net = calculateDocumentNet(inv);
      taxableSalesCents += net;
      taxCollectedCents += tax;
    }
  });

  bills.forEach((b: any) => {
    const bDate = b.date || b.issueDate || '';
    if (bDate >= start && bDate <= end && BILL_COUNTS_FOR_TAX.has(b.status)) {
      const tax = calculateDocumentTax(b);
      const net = calculateDocumentNet(b);
      taxablePurchasesCents += net;
      taxPaidCents += tax;
    }
  });

  return {
    startDate: start,
    endDate: end,
    taxableSalesCents,
    taxCollectedCents,
    taxablePurchasesCents,
    taxPaidCents,
    netTaxLiabilityCents: taxCollectedCents - taxPaidCents
  };
}

function toBaseCents(amountCents: number = 0, exchangeRate?: number, baseAmountCents?: number): number {
  if (baseAmountCents !== undefined && baseAmountCents !== null && !isNaN(baseAmountCents)) {
    return baseAmountCents;
  }
  const rate = typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : 1;
  return Math.round(amountCents * rate);
}

export interface CustomerBalanceSummaryRow {
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  openInvoicesCount: number;
  totalInvoicedCents: number;
  totalCreditNotesCents: number;
  totalPaidCents: number;
  balanceCents: number;
}

export function computeCustomerBalanceSummary(
  customers: any[] = [],
  invoices: any[] = [],
  payments: any[] = [],
  creditNotes: any[] = [],
  startDate?: string,
  endDate?: string
): CustomerBalanceSummaryRow[] {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";

  return customers.map(cust => {
    const custId = cust.id;
    const custInvoices = invoices.filter(inv => {
      if (inv.customerId !== custId) return false;
      if (!INVOICE_IS_ISSUED.has(inv.status)) return false;
      const docDate = inv.date || inv.issueDate || (inv.createdAt ? inv.createdAt.split('T')[0] : '');
      if (docDate && (docDate < start || docDate > end)) return false;
      return true;
    });

    const totalInvoicedCents = custInvoices.reduce((sum, inv) => {
      return sum + toBaseCents(inv.amountCents || 0, inv.exchangeRate, inv.baseAmountCents);
    }, 0);

    const custCreditNotes = creditNotes.filter(cn => {
      if (cn.customerId !== custId) return false;
      if (cn.status === 'void' || cn.status === 'draft') return false;
      const docDate = cn.date || cn.issueDate || (cn.createdAt ? cn.createdAt.split('T')[0] : '');
      if (docDate && (docDate < start || docDate > end)) return false;
      return true;
    });

    const totalCreditNotesCents = custCreditNotes.reduce((sum, cn) => {
      return sum + toBaseCents(cn.amountCents || 0, cn.exchangeRate, cn.baseAmountCents);
    }, 0);

    const custPayments = payments.filter(p => {
      const matchesContact = p.contactId === custId || p.allocations?.some((a: any) => custInvoices.some(inv => inv.id === a.documentId));
      if (!matchesContact) return false;
      if (p.direction === 'made') return false;
      if (p.status === 'void' || p.status === 'draft') return false;
      const docDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
      if (docDate && (docDate < start || docDate > end)) return false;
      return true;
    });

    const totalPaidCents = custPayments.reduce((sum, p) => {
      return sum + toBaseCents(p.amountCents || 0, p.exchangeRate, p.baseAmountCents);
    }, 0);

    const openInvoicesCount = custInvoices.filter(inv => inv.status !== 'paid').length;
    // Allow negative balance (credit balances for customers)
    const balanceCents = totalInvoicedCents - totalCreditNotesCents - totalPaidCents;

    return {
      customerId: custId,
      name: cust.name || 'Unnamed Customer',
      email: cust.email,
      phone: cust.phone,
      openInvoicesCount,
      totalInvoicedCents,
      totalCreditNotesCents,
      totalPaidCents,
      balanceCents
    };
  }).sort((a, b) => b.balanceCents - a.balanceCents);
}

export interface VendorBalanceSummaryRow {
  vendorId: string;
  name: string;
  email?: string;
  phone?: string;
  openBillsCount: number;
  totalBilledCents: number;
  totalVendorCreditsCents: number;
  totalPaidCents: number;
  balanceCents: number;
}

export function computeVendorBalanceSummary(
  vendors: any[] = [],
  bills: any[] = [],
  payments: any[] = [],
  vendorCredits: any[] = [],
  startDate?: string,
  endDate?: string
): VendorBalanceSummaryRow[] {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";

  return vendors.map(vendor => {
    const vendorId = vendor.id;
    const vendorBills = bills.filter(b => {
      if (b.vendorId !== vendorId) return false;
      if (!BILL_IS_ISSUED.has(b.status)) return false;
      const docDate = b.date || b.issueDate || (b.createdAt ? b.createdAt.split('T')[0] : '');
      if (docDate && (docDate < start || docDate > end)) return false;
      return true;
    });

    const totalBilledCents = vendorBills.reduce((sum, b) => {
      return sum + toBaseCents(b.amountCents || 0, b.exchangeRate, b.baseAmountCents);
    }, 0);

    const custVendorCredits = vendorCredits.filter(vc => {
      if (vc.vendorId !== vendorId) return false;
      if (vc.status === 'void' || vc.status === 'draft') return false;
      const docDate = vc.date || vc.issueDate || (vc.createdAt ? vc.createdAt.split('T')[0] : '');
      if (docDate && (docDate < start || docDate > end)) return false;
      return true;
    });

    const totalVendorCreditsCents = custVendorCredits.reduce((sum, vc) => {
      return sum + toBaseCents(vc.amountCents || 0, vc.exchangeRate, vc.baseAmountCents);
    }, 0);

    const vendorPayments = payments.filter(p => {
      if (p.contactId !== vendorId) return false;
      if (p.direction === 'received') return false;
      if (p.status === 'void' || p.status === 'draft') return false;
      const docDate = p.date || (p.createdAt ? p.createdAt.split('T')[0] : '');
      if (docDate && (docDate < start || docDate > end)) return false;
      return true;
    });

    const totalPaidCents = vendorPayments.reduce((sum, p) => {
      return sum + toBaseCents(p.amountCents || 0, p.exchangeRate, p.baseAmountCents);
    }, 0);

    const openBillsCount = vendorBills.filter(b => b.status !== 'paid').length;
    const balanceCents = totalBilledCents - totalVendorCreditsCents - totalPaidCents;

    return {
      vendorId,
      name: vendor.name || 'Unnamed Vendor',
      email: vendor.email,
      phone: vendor.phone,
      openBillsCount,
      totalBilledCents,
      totalVendorCreditsCents,
      totalPaidCents,
      balanceCents
    };
  }).sort((a, b) => b.balanceCents - a.balanceCents);
}

export interface PartyTransactionRow {
  id: string;
  date: string;
  partyName: string;
  type: string;
  reference: string;
  status: string;
  amountCents: number;
}

export function computeTransactionsByCustomer(
  customers: any[] = [],
  invoices: any[] = [],
  payments: any[] = [],
  creditNotes: any[] = [],
  startDate?: string,
  endDate?: string
): PartyTransactionRow[] {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";
  const customerMap = new Map(customers.map(c => [c.id, c.name]));
  const list: PartyTransactionRow[] = [];

  // 1. Invoices (issued only, non-draft, non-void)
  for (const inv of invoices) {
    if (!INVOICE_IS_ISSUED.has(inv.status)) continue;
    const docDate = inv.date || inv.issueDate || (inv.createdAt ? inv.createdAt.split('T')[0] : '') || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const customerName = inv.customerName || customerMap.get(inv.customerId) || 'Unknown Customer';
    list.push({
      id: inv.id,
      date: docDate,
      partyName: customerName,
      type: 'Invoice',
      reference: inv.number || inv.id,
      status: inv.status || 'pending',
      amountCents: toBaseCents(inv.amountCents || 0, inv.exchangeRate, inv.baseAmountCents)
    });
  }

  // 2. Credit Notes
  for (const cn of creditNotes) {
    if (cn.status === 'void' || cn.status === 'draft') continue;
    const docDate = cn.date || cn.issueDate || (cn.createdAt ? cn.createdAt.split('T')[0] : '') || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const customerName = cn.customerName || customerMap.get(cn.customerId) || 'Unknown Customer';
    list.push({
      id: cn.id,
      date: docDate,
      partyName: customerName,
      type: 'Credit Note',
      reference: cn.number || cn.id,
      status: cn.status || 'applied',
      amountCents: -toBaseCents(cn.amountCents || 0, cn.exchangeRate, cn.baseAmountCents)
    });
  }

  // 3. Payments (received)
  for (const pay of payments) {
    if (pay.status === 'void' || pay.status === 'draft' || pay.direction === 'made') continue;
    const docDate = pay.date || (pay.createdAt ? pay.createdAt.split('T')[0] : '') || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const customerName = pay.contactName || customerMap.get(pay.contactId) || 'Customer Payment';
    list.push({
      id: pay.id,
      date: docDate,
      partyName: customerName,
      type: 'Payment',
      reference: pay.reference || pay.number || pay.id,
      status: pay.status || 'posted',
      amountCents: -toBaseCents(pay.amountCents || 0, pay.exchangeRate, pay.baseAmountCents)
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export function computeTransactionsByVendor(
  vendors: any[] = [],
  bills: any[] = [],
  payments: any[] = [],
  vendorCredits: any[] = [],
  startDate?: string,
  endDate?: string
): PartyTransactionRow[] {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";
  const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
  const list: PartyTransactionRow[] = [];

  // 1. Bills (issued only, non-draft, non-void)
  for (const bill of bills) {
    if (!BILL_IS_ISSUED.has(bill.status)) continue;
    const docDate = bill.date || bill.issueDate || (bill.createdAt ? bill.createdAt.split('T')[0] : '') || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const vendorName = bill.vendorName || vendorMap.get(bill.vendorId) || 'Unknown Vendor';
    list.push({
      id: bill.id,
      date: docDate,
      partyName: vendorName,
      type: 'Bill',
      reference: bill.number || bill.id,
      status: bill.status || 'pending',
      amountCents: toBaseCents(bill.amountCents || 0, bill.exchangeRate, bill.baseAmountCents)
    });
  }

  // 2. Vendor Credits
  for (const vc of vendorCredits) {
    if (vc.status === 'void' || vc.status === 'draft') continue;
    const docDate = vc.date || vc.issueDate || (vc.createdAt ? vc.createdAt.split('T')[0] : '') || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const vendorName = vc.vendorName || vendorMap.get(vc.vendorId) || 'Unknown Vendor';
    list.push({
      id: vc.id,
      date: docDate,
      partyName: vendorName,
      type: 'Vendor Credit',
      reference: vc.number || vc.id,
      status: vc.status || 'applied',
      amountCents: -toBaseCents(vc.amountCents || 0, vc.exchangeRate, vc.baseAmountCents)
    });
  }

  // 3. Payments made
  for (const pay of payments) {
    if (pay.status === 'void' || pay.status === 'draft' || pay.direction === 'received') continue;
    const docDate = pay.date || (pay.createdAt ? pay.createdAt.split('T')[0] : '') || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const vendorName = pay.contactName || vendorMap.get(pay.contactId) || 'Supplier Payment';
    list.push({
      id: pay.id,
      date: docDate,
      partyName: vendorName,
      type: 'Vendor Payment',
      reference: pay.reference || pay.number || pay.id,
      status: pay.status || 'posted',
      amountCents: -toBaseCents(pay.amountCents || 0, pay.exchangeRate, pay.baseAmountCents)
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}
