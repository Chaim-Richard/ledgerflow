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
      const isDebit = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
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
          const convertedLines = tx.lines.map(line => {
            if (!line || typeof line !== 'object') return { line, amount: 0, rawAmount: 0, rate: 1 };
            const rawAmount = typeof line.amountCents === 'number' && Number.isSafeInteger(line.amountCents) ? line.amountCents : 0;
            const rate = (typeof (line as any).exchangeRate === 'number' && (line as any).exchangeRate > 0)
              ? (line as any).exchangeRate
              : ((typeof tx.exchangeRate === 'number' && tx.exchangeRate > 0) ? tx.exchangeRate : 1);
            return { line, amount: Math.round(rawAmount * rate), rawAmount, rate };
          });

          // Fix rounding errors for balanced transactions
          const sumRaw = convertedLines.reduce((acc, curr) => acc + curr.rawAmount, 0);
          if (sumRaw === 0 && convertedLines.length > 0) {
            const sumConverted = convertedLines.reduce((acc, curr) => acc + curr.amount, 0);
            if (sumConverted !== 0) {
              // Find the leg with the largest absolute converted amount to absorb the difference
              let largestIdx = 0;
              let maxAbs = -1;
              convertedLines.forEach((item, idx) => {
                const absAmt = Math.abs(item.amount);
                if (absAmt > maxAbs) {
                  maxAbs = absAmt;
                  largestIdx = idx;
                }
              });
              convertedLines[largestIdx].amount -= sumConverted;
            }
          }

          convertedLines.forEach(({ line, amount }) => {
            if (!line || typeof line !== 'object') return;
            const accId = typeof line.accountId === 'string' ? line.accountId : '';
            const accData = balances.get(accId);
            if (accData) {
              accData.total += amount;
              
              if (line.splitAllocations && Array.isArray(line.splitAllocations) && line.splitAllocations.length > 0) {
                const allocs = line.splitAllocations;
                let allocatedSum = 0;
                const calculatedAmounts: number[] = [];

                allocs.forEach((alloc, idx) => {
                  let allocAmount = 0;
                  if (idx === allocs.length - 1) {
                    allocAmount = amount - allocatedSum;
                  } else {
                    allocAmount = Math.round(amount * (alloc.weight || 0));
                    allocatedSum += allocAmount;
                  }
                  calculatedAmounts.push(allocAmount);
                });

                allocs.forEach((alloc, idx) => {
                  const allocAmount = calculatedAmounts[idx];
                  const proj = alloc.dimensions?.project || alloc.dimensions?.projectId || alloc.dimensions?.property || alloc.dimensions?.world || alloc.dimensions?.classId;
                  if (proj) {
                    accData.projects.set(proj, (accData.projects.get(proj) || 0) + allocAmount);
                  }
                });
              } else {
                const proj = (typeof line.project === 'string' && line.project) || (typeof tx.projectId === 'string' && tx.projectId);
                if (proj) {
                  accData.projects.set(proj, (accData.projects.get(proj) || 0) + amount);
                }
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
        if ((je as any).transactionId || (je as any).parentEventId) return; // Skip journal entries originating from transactions to prevent double-counting
        if (Array.isArray(je.lines)) {
          je.lines.forEach(line => {
            if (!line || typeof line !== 'object') return;
            const accId = typeof line.accountId === 'string' ? line.accountId : '';
            const accData = balances.get(accId);
            if (accData) {
              const debit = typeof line.debit === 'number' ? line.debit : ((line as any).debitCents || 0);
              const credit = typeof line.credit === 'number' ? line.credit : ((line as any).creditCents || 0);
              accData.total += debit - credit;
            }
          });
        }
      });
    }

    return balances;
  }

  /**
   * Recomputes ChartAccount array with live calculated balanceCents
   */
  static recomputeAccountBalances(
    accounts: ChartAccount[],
    transactions: Transaction[],
    journalEntries: JournalEntry[] = []
  ): ChartAccount[] {
    const map = this.computeDimensionalBalances(accounts, transactions, journalEntries);
    return accounts.map(acc => {
      const data = map.get(acc.id);
      const isDebit = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
      const net = data ? data.total : (isDebit ? (acc.openingBalanceCents || 0) : -(acc.openingBalanceCents || 0));
      // Convert signed balance to natural account balance
      const balanceCents = isDebit ? net : -net;
      return {
        ...acc,
        balanceCents
      };
    });
  }

  /**
   * Verifies double-entry zero-sum across all computed accounts
   */
  static verifyZeroSum(accounts: ChartAccount[]): boolean {
    let totalNet = 0;
    accounts.forEach(acc => {
      const isDebit = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
      const signed = isDebit ? (acc.balanceCents || 0) : -(acc.balanceCents || 0);
      totalNet += signed;
    });
    return Math.abs(totalNet) === 0;
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
