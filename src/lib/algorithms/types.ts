import { Transaction, ChartAccount } from '../../types';

export interface AlgoInput {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface AlgoResult {
  metrics: { label: string; value: string | number; trend?: string; color?: string }[];
  charts: { data: any[]; config: { xKey: string; yKeys: { key: string; color: string; name: string; type?: 'bar' | 'line' }[] } }[];
  insights: string[];
}

// SOURCE OF INTEGRITY:
// All algorithms receive the raw `Transaction[]` and `ChartAccount[]` as the absolute source of integrity.
// Do NOT fetch data directly inside the algorithm. Only compute based on the provided arrays.
export type AlgoFn = (transactions: Transaction[], accounts: ChartAccount[], inputs: Record<string, number>) => AlgoResult;

export interface AlgorithmDefinition {
  domain?: 'finance' | 'operations' | 'forensics' | 'planning' | 'treasury' | 'system';
  tags?: string[];
  id: string;
  name: string;
  description: string;
  inputs: AlgoInput[];
  compute: AlgoFn;
}

export const buildHelper = (fn: AlgoFn) => fn;
