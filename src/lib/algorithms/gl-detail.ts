import type { AlgoResultRow } from './types';
import { AlgorithmDefinition, AlgoResult } from './types';
import { parseLocalDate, formatCurrency } from '../../lib/utils';
import { isPostable, lineAmount } from '../../lib/txFilters';
import { isWithinInterval } from 'date-fns';

export const GL_DETAIL_ALGO: AlgorithmDefinition = {
  id: 'gl-detail',
  name: 'General Ledger Detail',
  domain: 'operations',
  tags: ['Audit', 'Reconciliation', 'Reporting', 'Month-End'],
  description: 'Line-by-line detail of all transactions hitting a selected account, with debits, credits, and a running balance.',
  requires: ['transactions', 'accounts'],
  inputs: [
    {
      kind: 'dateRange',
      key: 'period',
      label: 'Reporting Period',
      defaultValue: { start: '', end: '' }
    },
    {
      kind: 'account',
      key: 'accountId',
      label: 'Filter by Account (Leave blank for all)',
      defaultValue: ''
    }
  ],
  compute: (ctx, inputs: { "period": { start: string; end: string }; "accountId": string; [key: string]: unknown }): AlgoResult => {
    const { transactions, accounts, accounting } = ctx;
    const period = inputs['period'];
    const accountId = inputs['accountId'];

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (period && period.start && period.end) {
      startDate = parseLocalDate(period.start);
      endDate = parseLocalDate(period.end);
      endDate.setHours(23, 59, 59, 999);
    }

    // 1. Filter by date and account
    let relevantTxs = transactions.filter(t => isPostable(t));

    if (startDate && endDate) {
      relevantTxs = relevantTxs.filter(t => {
        const txDate = parseLocalDate(t.date);
        return isWithinInterval(txDate, { start: startDate as Date, end: endDate as Date });
      });
    }

    if (accountId) {
      relevantTxs = relevantTxs.filter(t => t.lines.some(e => e.accountId === accountId));
    }

    // 2. Sort by date ascending
    relevantTxs.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

    // 3. Flatten into rows (one row per matching entry)
    let runningBalance = 0;
    
    // If filtered to a specific account and period has a start date, calculate starting balance
    if (accountId && startDate) {
      transactions.forEach(t => {
        if (!isPostable(t)) return;
        const txDate = parseLocalDate(t.date);
        if (txDate < (startDate as Date)) {
          t.lines.forEach(e => {
            if (e.accountId === accountId) {
              const account = accounts.find(a => a.id === e.accountId);
              const isDebitNormal = account ? (accounting.isAsset(account.id) || accounting.isExpense(account.id) || accounting.isCOGS(account.id)) : true;
              const amt = lineAmount(e, t);
              const debit = amt > 0 ? amt : 0;
              const credit = amt < 0 ? Math.abs(amt) : 0;
              const impact = isDebitNormal ? (debit - credit) : (credit - debit);
              runningBalance += impact;
            }
          });
        }
      });
    }

    const rows: AlgoResultRow[] = [];
    const sourceTransactionIds = new Set<string>();
    let totalDebits = 0;
    let totalCredits = 0;

    relevantTxs.forEach(t => {
      t.lines.forEach((e, idx) => {
        if (accountId && e.accountId !== accountId) return; // Skip entries not for this account if filtered
        
        const account = accounts.find(a => a.id === e.accountId);
        const isDebitNormal = account ? (accounting.isAsset(account.id) || accounting.isExpense(account.id) || accounting.isCOGS(account.id)) : true;
        
        const amt = lineAmount(e, t);
        const debit = amt > 0 ? amt : 0;
        const credit = amt < 0 ? Math.abs(amt) : 0;
        
        totalDebits += debit;
        totalCredits += credit;
        
        const impact = isDebitNormal ? (debit - credit) : (credit - debit);
        runningBalance += impact;

        rows.push({
          id: `${t.id}_${(e as typeof e & { id?: string }).id || idx}`,
          date: t.date,
          account: account ? `${account.code ? `${account.code} - ` : ''}${account.name}` : e.accountId,
          description: e.description || t.description || 'No description',
          debit: debit > 0 ? formatCurrency(debit) : '',
          credit: credit > 0 ? formatCurrency(credit) : '',
          balance: accountId ? formatCurrency(runningBalance) : '-',
          sourceIds: [t.id]
        });
        sourceTransactionIds.add(t.id);
      });
    });

    return {
      metrics: [
        { label: 'Transactions', value: sourceTransactionIds.size, color: 'text-indigo-400' },
        { label: 'Total Debits', value: formatCurrency(totalDebits), color: 'text-emerald-400' },
        { label: 'Total Credits', value: formatCurrency(totalCredits), color: 'text-emerald-400' },
        { label: 'Net Change', value: formatCurrency(totalDebits - totalCredits), color: 'text-white' }
      ],
      charts: [],
      insights: [
        `Generated ledger detail spanning ${rows.length} entries.`,
        accountId ? `Filtered specifically to account: ${accounts.find(a => a.id === accountId)?.name || accountId}` : 'Showing all accounts.'
      ],
      rows,
      sourceTransactionIds: Array.from(sourceTransactionIds)
    };
  }
};
