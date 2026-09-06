import { ChartAccount, Transaction, JournalEntry } from '../../types';

export class LedgerEngine {
  /**
   * Validates if a transaction satisfies the fundamental double-entry invariant.
   */
  static isBalanced(tx: Transaction): boolean {
    if (!tx.lines || tx.lines.length === 0) return false;
    // We use integer cents, so sum must be exactly zero
    const sum = tx.lines.reduce((acc, line) => acc + (line.amountCents || 0), 0);
    return sum === 0;
  }

  private static normalizationCache = new Map<string, any>();
  private static MAX_CACHE_SIZE = 150000;

  private static CACHED_SANITIZE_REGEX_CORP = /\b(inc|ltd|corp|co|llc|plc|gmbh|sa|bv|nv|ag|sas)\b/g;
  private static CACHED_SANITIZE_REGEX_CHARS = /[^a-z0-9]/g;

  private static sanitizeText(s: string) {
    return (s || '').toLowerCase()
        .replace(LedgerEngine.CACHED_SANITIZE_REGEX_CORP, '')
        .replace(LedgerEngine.CACHED_SANITIZE_REGEX_CHARS, ' ')
        .trim();
  }

  static normalize(transactions: Transaction[]) {
    // Basic high-speed eviction if cache grows too large
    if (this.normalizationCache.size > this.MAX_CACHE_SIZE) {
      this.normalizationCache.clear();
    }

    return transactions.map(t => {
      const cacheKey = `${t.id}-${t.description}-${t.totalAmountCents}-${t.date}`;
      
      if (this.normalizationCache.has(cacheKey)) {
        return this.normalizationCache.get(cacheKey);
      }

      const absAmount = Math.abs(t.totalAmountCents || 0) / 100;
      const tDate = t.date || '';
      
      const norm = {
        ...t,
        _normalized: {
          searchStr: `${t.description || ''} ${absAmount} ${tDate} ${t.isCleared ? 'cleared' : 'pending'} ${t.tags?.join(' ') || ''} ${t.project || ''} ${t.classId || ''} ${t.locationId || ''} ${t.dimensions ? Object.values(t.dimensions).join(' ') : ''} ${t.metadata ? JSON.stringify(t.metadata) : ''} ${t.lines?.map(l => `${l.accountName} ${l.description || ''} ${l.tags?.join(' ') || ''} ${l.class || ''} ${l.location || ''} ${l.project || ''} ${l.dimensions ? Object.values(l.dimensions).join(' ') : ''}`).join(' ')}`.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
          month: tDate.length >= 7 ? tDate.substring(0, 7) : '',
          absAmount,
          sanitizedDescription: this.sanitizeText(t.description || ''),
          year: tDate.length >= 4 ? tDate.substring(0, 4) : '',
          isLarge: absAmount > 5000,
          isTiny: absAmount < 1.00,
          isBalanced: (t.lines?.reduce((acc, line) => acc + (line.amountCents || 0), 0) || 0) === 0
        }
      };

      this.normalizationCache.set(cacheKey, norm);
      return norm;
    });
  }

  /**
   * Detects "Zombie" transactions - entries that passed balance check but contain 
   * orphaned accounts or zero-value non-offsetting lines.
   */
  static auditTransaction(tx: Transaction, accounts: ChartAccount[] | Set<string>): string[] {
    const errors: string[] = [];
    if (!this.isBalanced(tx)) errors.push('Mathematical imbalance');
    
    const isSet = accounts instanceof Set;

    if (tx.lines) {
      tx.lines.forEach((line, idx) => {
        const found = isSet ? (accounts as Set<string>).has(line.accountId) : (accounts as ChartAccount[]).some(a => a.id === line.accountId);
        if (!found) {
          errors.push(`Line ${idx + 1}: Account "${line.accountName}" not found in chart`);
        }
        if (line.amountCents === 0) {
          errors.push(`Line ${idx + 1}: Zero-value entries skew audit trails`);
        }
      });
    }

    return errors;
  }

  /**
   * Calculates multidimensional balances (by project, tag, etc).
   * Moved from lib/ledger-engine to kernel/ledger.
   */
  static computeDimensionalBalances(
    accounts: ChartAccount[],
    transactions: Transaction[],
    journalEntries: JournalEntry[] = []
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
            let accData = balances.get(accId);

            // Fallback lookup if accountId is not found directly by ID (match by code or exact name)
            if (!accData && balances.size > 0) {
              const matchedAcc = accounts.find(a => 
                a.id === accId || 
                a.code === accId || 
                (line.accountName && a.name.toLowerCase() === line.accountName.toLowerCase())
              );
              if (matchedAcc) {
                accData = balances.get(matchedAcc.id);
              }
            }

            if (accData) {
              accData.total += amount;
              
              if (line.splitAllocations && Array.isArray(line.splitAllocations) && line.splitAllocations.length > 0) {
                const allocs = line.splitAllocations;
                let allocatedSum = 0;
                const calculatedAmounts: number[] = [];

                allocs.forEach((alloc, idx) => {
                  let allocAmount: number;
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
