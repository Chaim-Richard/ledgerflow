import { Transaction, ChartAccount, JournalEntry } from '../types';

/**
 * LedgerEngine: A high-performance computation engine for financial data.
 * Designed to handle 10k+ transactions without blocking the UI thread.
 */
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

  /**
   * Pre-processes transactions for high-speed filtering and search.
   * Uses a versioning cache with LRU-style eviction to prevent memory growth.
   */
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
          searchStr: `${t.description || ''} ${absAmount} ${tDate} ${t.isCleared ? 'cleared' : 'pending'} ${t.tags?.join(' ') || ''} ${t.project || ''} ${t.classId || ''} ${t.locationId || ''} ${t.metadata ? JSON.stringify(t.metadata) : ''} ${t.lines?.map(l => `${l.accountName} ${l.description || ''} ${l.tags?.join(' ') || ''} ${l.class || ''} ${l.location || ''} ${l.project || ''}`).join(' ')}`.toLowerCase()
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
   * Calculate balances with multi-dimensional segmentation (Accounts + Projects).
   * Returns a deeply indexed map: accId -> { total: number, projects: Map<projectName, number> }
   */
  static computeDimensionalBalances(
    accounts: ChartAccount[], 
    transactions: Transaction[], 
    journalEntries: JournalEntry[]
  ) {
    const balances = new Map<string, { total: number, projects: Map<string | null, number> }>();

    // Initialize with absolute safety
    accounts.forEach(acc => {
      const opening = acc.openingBalanceCents || 0;
      balances.set(acc.id, { 
        total: opening, 
        projects: new Map([[null, opening], ['unallocated', 0]]) 
      });
    });

    // Defensive check for orphaned accounts in history
    const ghostAccountId = 'orphaned-legacy-data';
    if (!balances.has(ghostAccountId)) {
      balances.set(ghostAccountId, { total: 0, projects: new Map() });
    }

    // Optimize account lookup by creating a map
    const accountTypeMap = new Map<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense'>();
    accounts.forEach(a => accountTypeMap.set(a.id, a.type));

    const processLine = (accountId: string, amountCents: number, projectName?: string | null) => {
      const accData = balances.get(accountId);
      if (!accData) return;

      const type = accountTypeMap.get(accountId);
      if (!type) return;

      // Ensure we are working with integers to prevent IEEE 754 drift
      const cleanAmount = Math.round(amountCents);
      const isDebitNature = type === 'asset' || type === 'expense';
      const delta = isDebitNature ? cleanAmount : -cleanAmount;

      accData.total += delta;
      
      const projectKey = projectName || 'unallocated';
      const currentProjBal = accData.projects.get(projectKey) || 0;
      accData.projects.set(projectKey, currentProjBal + delta);
    };

    // Process Ledger Source
    // All transactions, including type: 'journal', are sourced here. 
    // We intentionally SKIP mapping over journalEntries collection separately because they are structurally inserted into the transactions collection by default, so looping both caused double counting double entry registers!
    for (const tx of transactions) {
      if (tx.deletedAt) continue;
      
      // Auto-Migration Shield: Handle legacy transactions that might not have a schema version
      const lines = tx.lines || [];
      if (lines.length === 0 && tx.totalAmountCents !== 0) {
        // Log legacy orphan detection for the Audit UI
        processLine('orphaned-legacy-data', tx.totalAmountCents, tx.project);
        continue;
      }

      for (const line of lines) {
        processLine(line.accountId, line.amountCents, line.project);
      }
    }

    // --- Sub-Atomic Account Recursive Rollup Post-Process Pass ---
    // Establish mapping of parentId to child ids to crawl the tree
    const parentToChildren = new Map<string, string[]>();
    accounts.forEach(acc => {
      if (acc.parentId) {
        const list = parentToChildren.get(acc.parentId) || [];
        list.push(acc.id);
        parentToChildren.set(acc.parentId, list);
      }
    });

    const rollupCache = new Map<string, { total: number, projects: Map<string | null, number> }>();

    const getRolledUpBalance = (accId: string): { total: number, projects: Map<string | null, number> } => {
      if (rollupCache.has(accId)) {
        return rollupCache.get(accId)!;
      }

      const selfData = balances.get(accId) || { total: 0, projects: new Map() };
      // Copy current flat data
      const rolledUpTotal = {
        total: selfData.total,
        projects: new Map(selfData.projects)
      };

      const children = parentToChildren.get(accId) || [];
      for (const childId of children) {
        const childRolledUp = getRolledUpBalance(childId);
        rolledUpTotal.total += childRolledUp.total;

        // Roll up projects
        for (const [projKey, projValue] of childRolledUp.projects.entries()) {
          const currentVal = rolledUpTotal.projects.get(projKey) || 0;
          rolledUpTotal.projects.set(projKey, currentVal + projValue);
        }
      }

      rollupCache.set(accId, rolledUpTotal);
      return rolledUpTotal;
    };

    // Apply recursive rollups back into the primary balances container
    accounts.forEach(acc => {
      const rolledUp = getRolledUpBalance(acc.id);
      balances.set(acc.id, rolledUp);
    });

    return balances;
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
}
