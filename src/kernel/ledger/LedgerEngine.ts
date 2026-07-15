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
    
    transactions.forEach(tx => {
      // Pending txs should not affect physical balance? Or maybe they do in shadow.
      if (tx.status === 'void' || tx.status === 'failed') return;
      
      tx.lines?.forEach(line => {
        const accData = balances.get(line.accountId);
        if (accData) {
          accData.total += (line.amountCents || 0);
          
          const proj = line.project || tx.projectId;
          if (proj) {
            accData.projects.set(proj, (accData.projects.get(proj) || 0) + (line.amountCents || 0));
          }
        }
      });
    });

    journalEntries.forEach(je => {
      if (je.deletedAt) return; // Journal entries only have deletedAt, not status
      je.lines?.forEach(line => {
        const accData = balances.get(line.accountId);
        if (accData) {
          accData.total += (line.debit || 0) - (line.credit || 0);
        }
      });
    });

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
