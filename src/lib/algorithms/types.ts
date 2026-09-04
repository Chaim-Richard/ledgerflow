import { Transaction, ChartAccount } from '../../types';

export type AlgoInput =
  | { kind?: 'number'; key: string; label: string; min: number; max: number; step: number; defaultValue: number }
  | { kind: 'dateRange'; key: string; label: string; defaultValue: { start: string; end: string } }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[]; defaultValue: string }
  | { kind: 'boolean'; key: string; label: string; defaultValue: boolean }
  | { kind: 'account'; key: string; label: string; defaultValue?: string; multiple?: boolean };

export interface AlgoResultRow {
  [key: string]: any;
}

export interface AlgoResult {
  metrics: { label: string; value: string | number; trend?: string; color?: string }[];
  charts: { data: any[]; config: { xKey: string; yKeys: { key: string; color: string; name: string; type?: 'bar' | 'line' }[] } }[];
  insights: string[];
  rows?: AlgoResultRow[];
  sourceTransactionIds?: string[];
}

// SOURCE OF INTEGRITY:
// All algorithms receive the raw `Transaction[]` and `ChartAccount[]` as the absolute source of integrity.
// Do NOT fetch data directly inside the algorithm. Only compute based on the provided arrays.
export type AlgoFn = (transactions: Transaction[], accounts: ChartAccount[], inputs: Record<string, any>, context?: { invoices?: any[], bills?: any[] }) => AlgoResult;

export interface AlgorithmDefinition {
  domain?: 'finance' | 'operations' | 'forensics' | 'planning' | 'treasury' | 'system' | 'valuation';
  requires?: ('transactions' | 'invoices' | 'bills' | 'accounts' | 'budgets')[];
  tags?: string[];
  id: string;
  name: string;
  description: string;
  inputs: AlgoInput[];
  compute: AlgoFn;
}

export const buildHelper = (fn: AlgoFn) => fn;
