import { calculateNetIncome, isPostable, isRevenueAccount, isExpenseAccount, lineAmount, isTransactionInDateRange } from "../../lib/txFilters";
import { resolveAccountRole } from "../../lib/accountUtils";

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

  for (const tx of transactions) {
    if (!isPostable(tx)) continue;
    if (!isTransactionInDateRange(tx, undefined, end)) continue;
    tx.lines?.forEach((line: any) => {
      if (balances[line.accountId] !== undefined) {
        balances[line.accountId] += lineAmount(line, tx);
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
  const isBalanced = Math.abs(totalAssets - totalClaims) <= 1;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netIncome,
    totalClaims,
    isBalanced
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
      debit: isDebitNature && opening > 0 ? opening : (!isDebitNature && opening < 0 ? Math.abs(opening) : 0),
      credit: !isDebitNature && opening > 0 ? opening : (isDebitNature && opening < 0 ? Math.abs(opening) : 0),
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
  return { accounts: accountsArray, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) <= 1 };
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
