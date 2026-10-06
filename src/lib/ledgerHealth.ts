/**
 * Ledger health monitor (CA-32): every night the server runs the Data Health checks
 * (src/lib/dataChecks.ts) on each workspace whose books changed, keeps what it found on the workspace
 * (`ledgerHealth`, written by the server only), and tells the owner and accountants about serious
 * problems that were not there the night before, so nobody has to remember to open Data Health.
 * Shared here: what is kept, and which findings are new.
 */
import { DATA_CHECKS, type CheckFinding, type CheckSeverity } from './dataChecks';

export interface LedgerHealth {
  checkedAt: string;
  counts: Record<CheckSeverity, number>;
  /** The serious findings seen (ids), to tell new ones from old ones next time. */
  highIds: string[];
  /** The books when checked (row count and newest change), to skip an unchanged workspace. */
  fingerprint?: string;
}

/** At most this many ids are kept; past it, a few old ones may be told again (harmless). */
export const MAX_KEPT_IDS = 500;

export function healthSummary(findings: CheckFinding[], checkedAt: string, fingerprint?: string): LedgerHealth {
  const counts: Record<CheckSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;
  return {
    checkedAt,
    counts,
    highIds: findings.filter(f => f.severity === 'high').map(f => f.id).slice(0, MAX_KEPT_IDS),
    ...(fingerprint ? { fingerprint } : {}),
  };
}

/** Serious findings that were not there at the last check. The first check tells everything serious. */
export function newSeriousProblems(findings: CheckFinding[], previous: Pick<LedgerHealth, 'highIds'> | null | undefined): CheckFinding[] {
  const seen = new Set(previous?.highIds || []);
  return findings.filter(f => f.severity === 'high' && !seen.has(f.id));
}

/** The notification for new serious problems: how many of each kind, by the check's name. */
export function problemNotice(found: CheckFinding[]): { title: string; message: string } {
  const n = found.length;
  const byCheck = new Map<string, number>();
  for (const f of found) byCheck.set(f.checkId, (byCheck.get(f.checkId) || 0) + 1);
  const kinds = [...byCheck].map(([checkId, count]) => `${DATA_CHECKS.find(c => c.id === checkId)?.label || checkId} (${count})`);
  return {
    title: n === 1 ? 'A new problem in the books' : `${n} new problems in the books`,
    message: `${kinds.slice(0, 3).join('; ')}${kinds.length > 3 ? `; and ${kinds.length - 3} more kinds` : ''}. Open Data Health to see and fix ${n === 1 ? 'it' : 'them'}.`,
  };
}
