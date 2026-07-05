import { Transaction, ChartAccount } from '../types';

export function sumTransactions(txs: Transaction[], filter: (tx: Transaction) => boolean): number {
  return txs.filter(filter).reduce((acc, tx) => acc + (tx.totalAmountCents || 0), 0);
}

export function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(data[i]);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < window; j++) {
      sum += data[i - j];
    }
    result.push(sum / window);
  }
  return result;
}

export function standardDeviation(data: number[]): number {
  if (data.length === 0) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / (data.length || 1);
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length || 1);
  return Math.sqrt(variance);
}

export function groupTransactionsByMonth(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  txs.forEach(tx => {
    const month = (tx.date || '').slice(0, 7);
    if (!month) return;
    map[month] = (map[month] || 0) + (tx.totalAmountCents || 0);
  });
  return map;
}

export function getRevenueTxs(txs: Transaction[], accounts: ChartAccount[]): Transaction[] {
  const revAccts = new Set(accounts.filter(a => a.type === 'income').map(a => a.id));
  return txs.filter(tx => tx.lines?.some(l => revAccts.has(l.accountId) && l.amountCents < 0));
}

export function getExpenseTxs(txs: Transaction[], accounts: ChartAccount[]): Transaction[] {
  const expAccts = new Set(accounts.filter(a => a.type === 'expense').map(a => a.id));
  return txs.filter(tx => tx.lines?.some(l => expAccts.has(l.accountId) && l.amountCents > 0));
}
