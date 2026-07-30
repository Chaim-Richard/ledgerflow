import { Transaction, ChartAccount, JournalEntry } from '../types';
import { MerkleTree, MinHash, sha256Sync } from '../lib/algorithms';
import { PerformanceTelemetry } from '../lib/telemetry';
import { parseLocalDate } from '../lib/utils';

export interface AuditResult {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  imbalances: Array<{ id: string; type: 'transaction' | 'journal'; diff: number }>;
  orphans: Array<{ id: string; type: 'transaction' | 'journal'; message: string }>;
  duplicateCandidates: Array<{ id: string; reason: string }>;
  missingAccounts: Array<{ id: string; accountName: string; lineIdx: number }>;
  hashChainValid: boolean;
  brokenChainIndex: number | null;
  merkleRoot: string;
}

export const DoubleEntryAuditor = {
  /**
   * Deterministic audit of the entire ledger.
   * Zero AI. Pure mathematical verification.
   */
  auditLedger: (
    transactions: Transaction[], 
    accounts: ChartAccount[], 
    journalEntries: JournalEntry[]
  ): AuditResult => {
    PerformanceTelemetry.start("DoubleEntryAuditor:auditLedger");
    let totalDebits = 0;
    let totalCredits = 0;
    const imbalances: AuditResult['imbalances'] = [];
    const orphans: AuditResult['orphans'] = [];
    const missingAccounts: AuditResult['missingAccounts'] = [];
    const duplicateCandidates: AuditResult['duplicateCandidates'] = [];
    
    // Google-Scale Similarity Engine (MinHash)
    const minHash = new MinHash(64);
    const signatures: { id: string; sig: number[] }[] = [];
    
    // Rule Hash Chain Verification
    let hashChainValid = true;
    let brokenChainIndex: number | null = null;
    
    const accountIds = new Set(accounts.map(a => a.id));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // Sort transactions by chronological creation to verify the causal chain
    // O(N log N) mapped sort (Schwartzian transform) to prevent millions of native Date parses on 50,000+ inputs
    const chronosTxs = transactions
      .map(t => ({ t, time: t.createdAt ? new Date(t.createdAt).getTime() : (t.date ? parseLocalDate(t.date).getTime() : 0) }))
      .sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return (a.t && b.t && a.t.id && b.t.id) ? a.t.id.localeCompare(b.t.id) : 0; })
      .map(item => item.t);

    // Optimized Duplicate Detection using Bucketing
    // Instead of O(N^2), we group by amount to drastically reduce search space
    const signatureBuckets = new Map<number, { id: string; sig: number[] }[]>();
    
    // Performance Guard: Skip expensive duplicate check if Ledger is excessive
    const skipDuplicateCheck = transactions.length > 2000;

    // 1. Audit Transactions & Hash Chain
    chronosTxs.forEach((t, i) => {
      if (t.deletedAt) return;
      
      // Verify Cryptographic Link
      if (i > 0 && t.verification?.previousHash) {
        const prevTx = chronosTxs[i-1];
        if (t.verification.previousHash !== prevTx.verification?.hash) {
          hashChainValid = false;
          if (brokenChainIndex === null) brokenChainIndex = i;
        }
      }

      let txDebit = 0;
      let txCredit = 0;
      
      const lines = t.lines || [];
      if (lines.length === 0) {
        orphans.push({ id: t.id, type: 'transaction', message: 'No allocation lines found' });
      }

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const line = lines[lIdx];
        if (!accountIds.has(line.accountId)) {
          missingAccounts.push({ id: t.id, accountName: line.accountName, lineIdx: lIdx });
        }
        
        if (line.amountCents > 0) txDebit += line.amountCents;
        else txCredit += Math.abs(line.amountCents);
      }

      const diff = txDebit - txCredit;
      if (Math.abs(diff) > 0.01) {
        imbalances.push({ id: t.id, type: 'transaction', diff });
      }

      totalDebits += txDebit;
      totalCredits += txCredit;

      // 1.1 Causal Integrity Check
      if (t.verification?.status === 'verified' && t.verification.hash !== DoubleEntryAuditor.computeHash(t, t.verification.previousHash)) {
        orphans.push({ id: t.id, type: 'transaction', message: 'Signature Mismatch: Potential manual tampering detected' });
      }

      // 1.2 Optimized Duplicate Check (LSH MinHash with Bucketing)
      if (!skipDuplicateCheck) {
        const currentSig = minHash.createSignature(`${t.description} ${t.totalAmountCents} ${t.date}`);
        const amountKey = t.totalAmountCents;
        
        const bucket = signatureBuckets.get(amountKey) || [];
        // Only compare with last 10 entries in bucket for performance
        const startIndex = Math.max(0, bucket.length - 10);
        for (let bIdx = startIndex; bIdx < bucket.length; bIdx++) {
          const prev = bucket[bIdx];
          const similarity = minHash.compare(currentSig, prev.sig);
          if (similarity > 0.95) { // Tightened threshold to reduce false positives and speed up logic
            duplicateCandidates.push({ id: t.id, reason: `Pattern similarity (${Math.round(similarity * 100)}%) with ${prev.id}` });
            break; 
          }
        }
        
        if (!signatureBuckets.has(amountKey)) signatureBuckets.set(amountKey, []);
        signatureBuckets.get(amountKey)!.push({ id: t.id, sig: currentSig });
      }
    });

    // 2. Audit Journal Entries
    journalEntries.forEach(entry => {
      let entryDebit = 0;
      let entryCredit = 0;

      entry.lines?.forEach((line, idx) => {
        if (!accountIds.has(line.accountId)) {
          missingAccounts.push({ id: entry.id, accountName: line.accountName, lineIdx: idx });
        }
        entryDebit += line.debit;
        entryCredit += line.credit;
      });

      const diff = entryDebit - entryCredit;
      if (Math.abs(diff) > 0.01) {
        imbalances.push({ id: entry.id, type: 'journal', diff });
      }

      totalDebits += Math.round(entryDebit * 100);
      totalCredits += Math.round(entryCredit * 100);
    });

    // 3. Construct Merkle Root of Trust
    const tree = new MerkleTree(chronosTxs.map(t => t.verification?.hash || t.id));

    PerformanceTelemetry.end("DoubleEntryAuditor:auditLedger");
    return {
      isBalanced: Math.abs(totalDebits - totalCredits) < 1,
      totalDebits,
      totalCredits,
      imbalances,
      orphans,
      duplicateCandidates,
      missingAccounts,
      hashChainValid,
      brokenChainIndex,
      merkleRoot: tree.root
    };
  },

  /**
   * Generates a deterministic signature for a transaction.
   * Leverages cryptographically secure SHA-256 string-hash of all fields.
   */
  computeHash: (tx: Transaction, previousHash?: string): string => {
    const payload = JSON.stringify({
      date: tx.date,
      desc: tx.description,
      amount: tx.totalAmountCents,
      lines: (tx.lines || []).map(l => [l.accountId, l.amountCents]),
      prev: previousHash || 'genesis'
    });
    
    return sha256Sync(payload);
  },

  /**
   * Causal Chain Repair: Re-hashes the entire sequence of transactions
   * to restore cryptographic integrity. This is used when a chain break
   * is detected and the user wants to certify the current state as the 
   * new 'Genesis' state.
   */
  repairChain: (transactions: Transaction[]): Transaction[] => {
    const sorted = transactions
      .map(tx => ({ tx, time: tx.createdAt ? new Date(tx.createdAt).getTime() : (tx.date ? parseLocalDate(tx.date).getTime() : 0) }))
      .sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return (a.tx && b.tx && a.tx.id && b.tx.id) ? a.tx.id.localeCompare(b.tx.id) : 0; })
      .map(item => item.tx);
    let lastHash = 'genesis';
    
    return sorted.map(tx => {
      const newHash = DoubleEntryAuditor.computeHash(tx, lastHash);
      const updatedTx = {
        ...tx,
        verification: {
          ...(tx.verification || {}),
          status: 'verified' as const,
          hash: newHash,
          previousHash: lastHash,
          verifiedAt: new Date().toISOString(),
          timestamp: tx.verification?.timestamp || new Date().toISOString()
        }
      };
      lastHash = newHash;
      return updatedTx;
    });
  }
};
