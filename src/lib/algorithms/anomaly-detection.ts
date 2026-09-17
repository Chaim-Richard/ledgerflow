import { parseLocalDate, formatCurrency } from '../../lib/utils';
import { Transaction } from '../../types';
import { AlgorithmDefinition } from './types';
import { isPostable, lineAmount } from '../txFilters';

const BENFORD_EXPECTED: Record<number, number> = {
  1: 0.301, 2: 0.176, 3: 0.125, 4: 0.097, 5: 0.079,
  6: 0.067, 7: 0.058, 8: 0.051, 9: 0.046,
};

function benfordsLawTest(amountsCents: readonly number[]) {
  const leadingDigits = amountsCents
    .map((c) => Math.abs(c))
    .filter((c) => c > 0)
    .map((c) => Number(String(c)[0]));

  const sampleSize = leadingDigits.length;
  if (sampleSize < 30) return null; // too small to mean anything

  const observedCounts: Record<number, number> = {};
  for (let d = 1; d <= 9; d++) observedCounts[d] = 0;
  for (const d of leadingDigits) observedCounts[d] = (observedCounts[d] ?? 0) + 1;

  let chiSquare = 0;
  const observed: Record<number, number> = {};
  for (let d = 1; d <= 9; d++) {
    const observedFraction = (observedCounts[d] ?? 0) / sampleSize;
    observed[d] = observedFraction;
    const expectedFraction = BENFORD_EXPECTED[d]!;
    const expectedCount = expectedFraction * sampleSize;
    const observedCount = observedCounts[d] ?? 0;
    chiSquare += (observedCount - expectedCount) ** 2 / expectedCount;
  }

  return { chiSquare, sampleSize, suspicious: chiSquare > 15.51, observed, expected: BENFORD_EXPECTED };
}

function normalizeDescription(description?: string): string {
  return (description || "").toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function daysBetween(a: string, b: string): number {
  return Math.abs(parseLocalDate(a).getTime() - parseLocalDate(b).getTime()) / 86_400_000;
}

function findDuplicates(transactions: readonly Transaction[], windowDays = 3) {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const amt = Math.round((tx.totalAmountCents || 0) * (tx.exchangeRate || 1));
    const key = `${amt}|${normalizeDescription(tx.description)}`;
    const group = groups.get(key) ?? [];
    group.push(tx);
    groups.set(key, group);
  }

  const candidates: any[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    let cluster: Transaction[] = [sorted[0]!];
    const flush = () => {
      if (cluster.length > 1) {
        const amt = Math.round((cluster[0]!.totalAmountCents || 0) * (cluster[0]!.exchangeRate || 1));
        candidates.push({
          transactionIds: cluster.map((c) => c.id),
          date: cluster[0]!.date,
          amountCents: amt,
          description: cluster[0]!.description,
          reason: `${cluster.length} transactions with the same amount and description within ${windowDays} day(s) of each other.`,
        });
      }
    };
    for (let i = 1; i < sorted.length; i++) {
      const prev = cluster[cluster.length - 1]!;
      const curr = sorted[i]!;
      if (daysBetween(prev.date, curr.date) <= windowDays) {
        cluster.push(curr);
      } else {
        flush();
        cluster = [curr];
      }
    }
    flush();
  }
  return candidates;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

interface AccountLineItem {
  transactionId: string;
  lineId: string;
  date: string;
  amountCents: number;
  description: string;
}

function findAccountLineOutliers(items: readonly AccountLineItem[], threshold = 3.5) {
  if (items.length < 5) return [];
  const amounts = items.map((i) => Math.abs(i.amountCents));
  const med = median(amounts);
  const mad = median(amounts.map((a) => Math.abs(a - med)));
  if (!mad || mad <= 0 || !Number.isFinite(mad)) return [];

  return items
    .map((item) => ({
      transactionId: item.transactionId,
      lineId: item.lineId,
      date: item.date,
      amountCents: Math.abs(item.amountCents),
      description: item.description,
      zScore: mad > 0 ? (0.6745 * (Math.abs(item.amountCents) - med)) / Math.max(mad, 1) : 0,
      medianCents: med,
    }))
    .filter((r) => Number.isFinite(r.zScore) && Math.abs(r.zScore) > threshold);
}

export const ANOMALY_DETECTION_ALGO: AlgorithmDefinition = {
  id: 'forensics_anomaly_detection',
  name: 'Forensic Anomaly Detection',
  domain: 'forensics',
  tags: ['audit', 'fraud', 'benford', 'outliers', 'duplicates'],
  description: 'Continuous anomaly surface: duplicate postings, statistical line-level outliers per expense account, and Benford\'s Law checks across all expense line items.',
  inputs: [
    { key: 'windowDays', label: 'Duplicate Window (Days)', min: 1, max: 14, step: 1, defaultValue: 3 },
    { key: 'zScoreThreshold', label: 'Outlier Z-Score Threshold', min: 2.0, max: 5.0, step: 0.1, defaultValue: 3.5 }
  ],
  compute: (ctx, inputs) => {
    const { transactions, accounts, accounting } = ctx;
    const windowDays = inputs['windowDays'] ?? 3;
    const zScoreThreshold = inputs['zScoreThreshold'] ?? 3.5;

    // Strict filter for postable transactions
    const validTxs = transactions.filter(t => isPostable(t));

    const duplicates = findDuplicates(validTxs, windowDays);
    
    // Group line-level debits by expense account for precise statistical isolation
    const byAccountLines = new Map<string, AccountLineItem[]>();
    const allExpenseLineAmounts: number[] = [];
    const sourceTransactionIds = new Set<string>();

    for (const tx of validTxs) {
      if (!Array.isArray(tx.lines)) continue;
      tx.lines.forEach((line, idx) => {
        const acc = accounts.find(a => a.id === line.accountId);
        const isExp = acc ? (accounting.isExpense(acc.id) || accounting.isCOGS(acc.id)) : false;
        if (isExp) {
          const amt = lineAmount(line, tx);
          if (amt > 0) { // Expense debit
            allExpenseLineAmounts.push(amt);
            const group = byAccountLines.get(line.accountId) ?? [];
            group.push({
              transactionId: tx.id,
              lineId: (line as any).id || `${tx.id}-${idx}`,
              date: tx.date,
              amountCents: amt,
              description: line.description || tx.description || 'Expense line'
            });
            byAccountLines.set(line.accountId, group);
          }
        }
      });
    }

    const allOutliers: any[] = [];
    const rows: any[] = [];

    for (const [accountId, items] of byAccountLines.entries()) {
      const accOutliers = findAccountLineOutliers(items, zScoreThreshold);
      if (accOutliers.length > 0) {
        const accountName = accounts.find(a => a.id === accountId)?.name ?? accountId;
        accOutliers.forEach(o => {
          allOutliers.push({ ...o, accountName });
          sourceTransactionIds.add(o.transactionId);
          rows.push({
            id: `${o.transactionId}_${o.lineId}`,
            type: 'Outlier',
            date: o.date,
            account: accountName,
            description: o.description,
            amount: formatCurrency(o.amountCents),
            anomalyScore: `Z: ${o.zScore.toFixed(2)}`,
            sourceIds: [o.transactionId]
          });
        });
      }
    }

    duplicates.forEach(d => {
      d.transactionIds.forEach((tId: string) => sourceTransactionIds.add(tId));
      rows.push({
        id: `dup_${d.transactionIds.join('_')}`,
        type: 'Potential Duplicate',
        date: d.date,
        account: 'Multiple',
        description: d.description,
        amount: formatCurrency(d.amountCents),
        anomalyScore: `${d.transactionIds.length}x Cluster`,
        sourceIds: d.transactionIds
      });
    });

    const benford = benfordsLawTest(allExpenseLineAmounts);

    const insights: string[] = [];
    if (duplicates.length > 0) {
      insights.push(`Detected ${duplicates.length} cluster(s) of potential duplicate transactions.`);
    }
    if (allOutliers.length > 0) {
      insights.push(`Identified ${allOutliers.length} line-level statistical outlier(s) across expense accounts based on modified Z-score.`);
    }
    if (benford) {
      insights.push(benford.suspicious 
        ? `Expense line amounts deviate significantly from Benford's Law (Chi-Square: ${benford.chiSquare.toFixed(2)}), suggesting potential un-natural distribution.`
        : `Expense line leading digits conform to Benford's Law distribution (Chi-Square: ${benford.chiSquare.toFixed(2)}).`);
    } else {
      insights.push(`Insufficient expense line items to run Benford's Law analysis (need at least 30, found ${allExpenseLineAmounts.length}).`);
    }

    const metrics = [
      { label: "Possible Duplicates", value: duplicates.length, color: duplicates.length > 0 ? "text-amber-500" : "text-emerald-500" },
      { label: "Statistical Outliers", value: allOutliers.length, color: allOutliers.length > 0 ? "text-amber-500" : "text-emerald-500" },
    ];

    if (benford) {
       metrics.push({
         label: "Benford Chi-Square",
         value: Number(benford.chiSquare.toFixed(2)),
         color: benford.suspicious ? "text-red-500" : "text-emerald-500"
       });
    }

    const charts = [];
    if (benford && benford.sampleSize >= 30) {
       const data = Object.keys(BENFORD_EXPECTED).map(digit => ({
          digit: digit,
          expected: Number((BENFORD_EXPECTED[Number(digit)]! * 100).toFixed(1)),
          observed: Number(((benford.observed[Number(digit)] ?? 0) * 100).toFixed(1))
       }));
       charts.push({
          data,
          config: {
            xKey: 'digit',
            yKeys: [
              { key: 'expected', color: '#94a3b8', name: 'Expected %', type: 'line' as const },
              { key: 'observed', color: '#6366f1', name: 'Observed %', type: 'bar' as const }
            ]
          }
       });
    }

    return {
      metrics,
      charts,
      insights,
      rows,
      sourceTransactionIds: Array.from(sourceTransactionIds)
    };
  }
};
