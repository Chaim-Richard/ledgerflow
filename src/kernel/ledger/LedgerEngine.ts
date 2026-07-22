import { ChartAccount, Transaction, JournalEntry } from '../../types';

export class LedgerEngine {
  /**
   * Calculates multidimensional balances (by project, tag, etc).
   * Moved from lib/ledger-engine to kernel/ledger.
   */
  static computeDimensionalBalances(
    accounts: ChartAccount[],
    transactions: Transaction[],
    journalEntries: JournalEntry[]
  ): Map<string, { total: number, projects: Map<string, number> }> {
    const balances = new Map<string, { total: number, projects: Map<string, number> }>();
    
    // Initialize map
    accounts.forEach(acc => {
      const isDebit = acc.type === 'asset' || acc.type === 'expense';
      const opening = acc.openingBalanceCents || 0;
      balances.set(acc.id, { total: isDebit ? opening : -opening, projects: new Map() });
    });

    // We no longer loop UI transactions manually without Fx rates, etc.
    // For now, doing a basic translation.
    
    if (Array.isArray(transactions)) {
      transactions.forEach(tx => {
        if (!tx || typeof tx !== 'object') return;
        if (tx.status === 'void' || tx.status === 'failed') return;
        
        if (Array.isArray(tx.lines)) {
          tx.lines.forEach(line => {
            if (!line || typeof line !== 'object') return;
            const accId = typeof line.accountId === 'string' ? line.accountId : '';
            const accData = balances.get(accId);
            if (accData) {
              const amount = typeof line.amountCents === 'number' && Number.isSafeInteger(line.amountCents) ? line.amountCents : 0;
              accData.total += amount;
              
              const proj = (typeof line.project === 'string' && line.project) || (typeof tx.projectId === 'string' && tx.projectId);
              if (proj) {
                accData.projects.set(proj, (accData.projects.get(proj) || 0) + amount);
              }
            }
          });
        }
      });
    }

    if (Array.isArray(journalEntries)) {
      journalEntries.forEach(je => {
        if (!je || typeof je !== 'object') return;
        if (je.deletedAt) return; // Journal entries only have deletedAt, not status
        if (Array.isArray(je.lines)) {
          je.lines.forEach(line => {
            if (!line || typeof line !== 'object') return;
            const accId = typeof line.accountId === 'string' ? line.accountId : '';
            const accData = balances.get(accId);
            if (accData) {
              const debit = typeof line.debit === 'number' && Number.isSafeInteger(line.debit) ? line.debit : 0;
              const credit = typeof line.credit === 'number' && Number.isSafeInteger(line.credit) ? line.credit : 0;
              accData.total += debit - credit;
            }
          });
        }
      });
    }

    return balances;
  }

  /**
   * Validates that the sum of all balances across all accounts is zero.
   * Useful for ensuring the ledger is balanced at a global level.
   */
  static calculateTrialBalance(balances: Map<string, { total: number }>): { debitTotal: number, creditTotal: number, isBalanced: boolean, difference: number } {
    let debitTotal = 0;
    let creditTotal = 0;

    balances.forEach((data) => {
      if (data.total > 0) {
        debitTotal += data.total;
      } else {
        creditTotal += Math.abs(data.total);
      }
    });

    const difference = Math.abs(debitTotal - creditTotal);

    return {
      debitTotal,
      creditTotal,
      isBalanced: difference === 0,
      difference
    };
  }
}
