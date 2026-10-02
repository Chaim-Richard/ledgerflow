import type { Transaction } from '../types';
import { isPostable } from './txFilters';

export interface ComplianceStat { label: string; count: number; status: 'pass' | 'warn' | 'fail' }

/**
 * The checks in the Forensic Auditor's audit log (H-16): posted entries whose lines don't add up to
 * zero in the entry's own currency (L-164), entries without a project, and possible duplicates
 * (same amount, date and payee).
 */
export function ledgerComplianceStats(transactions: Transaction[]): ComplianceStat[] {
  let unbalancedCount = 0;
  let missingProjectCount = 0;
  const sameSigMap = new Map<string, number>();
  
  for (const t of transactions) {
    if (!isPostable(t)) continue;
    
    // balanced in the entry's own currency (each line converted and rounded on its own can be a
    // cent off: +5.5 rounds to 6, -5.5 to -5), the same rule as the server's validator (L-164)
    const lineSum = (t.lines || []).reduce((sum, l) => sum + (l.amountCents || 0), 0);
    if (lineSum !== 0) unbalancedCount++;
    if (!t.projectId && !t.project) missingProjectCount++;
    
    const sig = `${t.totalAmountCents}_${t.date}_${t.payee || 'general'}`;
    sameSigMap.set(sig, (sameSigMap.get(sig) || 0) + 1);
  }
  
  let duplicateCount = 0;
  sameSigMap.forEach(count => { if (count > 1) duplicateCount += (count - 1); });

  const stats: ComplianceStat[] = [
    { label: 'Unbalanced Journal Entries', count: unbalancedCount, status: unbalancedCount === 0 ? 'pass' : 'fail' },
    { label: 'Missing Project Classifications', count: missingProjectCount, status: missingProjectCount < 5 ? 'pass' : 'warn' },
    { label: 'Potential Redundant Entries', count: duplicateCount, status: duplicateCount === 0 ? 'pass' : 'warn' },
  ];
  return stats;
}
