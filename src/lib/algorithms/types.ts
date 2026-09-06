import { Transaction, ChartAccount } from '../../types';
import { isPostable } from '../txFilters';

declare const postable: unique symbol;
export type PostableTransaction = Transaction & { readonly [postable]: true };

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
  charts: { data: any[]; config: { xKey: string; yKeys: { key: string; color: string; name: string; type?: 'bar' | 'line' | string }[] } }[];
  insights: string[];
  rows?: AlgoResultRow[];
  sourceTransactionIds?: string[];
}

// SOURCE OF INTEGRITY:
// All algorithms receive the raw `Transaction[]` and `ChartAccount[]` within AlgorithmContext as the absolute source of integrity.
// Do NOT fetch data directly inside the algorithm. Only compute based on the provided context.

export interface AlgorithmContext {
  readonly transactions: readonly PostableTransaction[];
  readonly accounts: readonly ChartAccount[];
  readonly period: { start: string; end: string; days: number };
  readonly asOfDate: string;
  readonly reportingCurrency: string;
  readonly entities?: {
    invoices?: any[];
    bills?: any[];
    vendors?: any[];
    employees?: any[];
    budgets?: any[];
    customers?: any[];
  };
}

export type AlgoFn = (ctx: AlgorithmContext, inputs: Record<string, any>) => AlgoResult;

export type LegacyAlgoFn = (
  transactions: Transaction[],
  accounts: ChartAccount[],
  inputs: Record<string, any>,
  context?: { invoices?: any[]; bills?: any[]; vendors?: any[]; employees?: any[]; budgets?: any[]; customers?: any[] }
) => AlgoResult;

/**
 * Adapter enabling legacy algorithms to receive the unified AlgorithmContext.
 */
export function adaptLegacy(fn: LegacyAlgoFn): AlgoFn {
  return (ctx, inputs) => {
    return fn(
      [...(ctx.transactions || [])] as Transaction[],
      [...(ctx.accounts || [])] as ChartAccount[],
      inputs,
      ctx.entities
    );
  };
}

export function buildAlgorithmContext(
  transactions: Transaction[] = [],
  accounts: ChartAccount[] = [],
  asOfDate?: string,
  period?: { start: string; end: string; days?: number },
  reportingCurrency: string = 'USD',
  entities?: AlgorithmContext['entities']
): AlgorithmContext {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveAsOf = asOfDate || today;
  const postableTxs = (transactions || []).filter(isPostable) as PostableTransaction[];
  
  const startDate = period?.start || '1970-01-01';
  const endDate = period?.end || effectiveAsOf;
  let days = period?.days;
  if (!days) {
    const sTime = new Date(startDate).getTime();
    const eTime = new Date(endDate).getTime();
    const diff = Math.max(1, Math.round((eTime - sTime) / (1000 * 60 * 60 * 24)));
    days = isNaN(diff) ? 365 : diff;
  }

  return {
    transactions: postableTxs,
    accounts: accounts || [],
    asOfDate: effectiveAsOf,
    period: {
      start: startDate,
      end: endDate,
      days
    },
    reportingCurrency,
    entities: entities || {}
  };
}

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

export const buildLegacyHelper = (fn: LegacyAlgoFn): AlgoFn => adaptLegacy(fn);
export const buildHelper = (fn: AlgoFn): AlgoFn => fn;
