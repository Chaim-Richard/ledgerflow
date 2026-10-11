/**
 * A-13 (CB-08) profitability by project. Revenue: issued invoice lines labelled with a Project
 * (their line labels, BF-09), in the base currency. Cost of those lines: the cost of goods sold
 * posted for each line (`postedCogsByInvoiceLine`), or quantity × unit cost while none is posted
 * (the same rule as Sales by Item). Plus the expenses and cost-of-sales entries in the period that
 * carry a Project label (a bill's expense lines, a journal line): debit minus credit on expense and
 * cost accounts, so a reversal nets out. Entries made from invoices (`cogsForInvoiceId`) are not
 * counted twice. Unlabelled amounts are one "Unassigned" row. Whole cents; read-only; posts nothing.
 * Customer and item profitability keep their own reports (customerGrossProfit, computeSalesByItem).
 */
import type { ChartAccount, Invoice, Transaction } from '../types';
import { isPostable, isTransactionInDateRange, lineAmount } from './txFilters';
import { resolveAccountRole } from './accountUtils';
import { getLineDimension } from './dimensionUtils';
import { INVOICE_IS_ISSUED } from '../server/reports/computeReports';
import { postedCogsByInvoiceLine } from '../server/reports/itemReports';
import { toBaseCents } from '../server/reports/partyReports';
import { isOpeningBalanceDocument } from './partyOpeningBalance';

export const UNASSIGNED_PROJECT = 'Unassigned';

export interface ProjectProfitabilityRow {
  project: string;
  revenueCents: number;
  /** cost of the invoiced lines (posted cost of goods sold, or the estimate) */
  invoiceCostCents: number;
  /** labelled expenses and cost entries in the period */
  expenseCents: number;
  costCents: number;
  marginCents: number;
  /** margin as a share of revenue; null when there is no revenue (undefined percentage) */
  marginPct: number | null;
  costIsEstimate: boolean;
}

export interface ProjectProfitabilityInput {
  invoices: Invoice[];
  transactions: Transaction[];
  accounts: ChartAccount[];
  items?: Array<{ id: string; unitCostCents: number }>;
  startDate?: string;
  endDate?: string;
}

function inRange(date: string | undefined, start?: string, end?: string): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  if (start && day < start.slice(0, 10)) return false;
  if (end && day > end.slice(0, 10)) return false;
  return true;
}

const pct = (revenue: number, margin: number): number | null => (revenue === 0 ? null : Math.round((margin / revenue) * 10000) / 100);

export function computeProjectProfitability(input: ProjectProfitabilityInput): ProjectProfitabilityRow[] {
  const { invoices, transactions, accounts, items = [], startDate, endDate } = input;
  const itemCost = new Map(items.map(i => [i.id, i.unitCostCents]));
  const posted = postedCogsByInvoiceLine(transactions, accounts);
  const rows = new Map<string, Omit<ProjectProfitabilityRow, 'marginCents' | 'marginPct' | 'costCents'>>();
  const rowFor = (project: string) => {
    let r = rows.get(project);
    if (!r) {
      r = { project, revenueCents: 0, invoiceCostCents: 0, expenseCents: 0, costIsEstimate: false };
      rows.set(project, r);
    }
    return r;
  };

  for (const inv of invoices) {
    if (!INVOICE_IS_ISSUED.has(inv.status) || isOpeningBalanceDocument(inv) || !inRange(inv.date, startDate, endDate)) continue;
    for (const line of inv.items || []) {
      const project = line.dimensions?.project?.trim() || UNASSIGNED_PROJECT;
      const r = rowFor(project);
      r.revenueCents += toBaseCents(line.amountCents || 0, inv.exchangeRate);
      const cost = posted.get(`${inv.id}/${line.id}`);
      if (cost !== undefined) {
        r.invoiceCostCents += cost;
      } else if (line.itemId) {
        const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
        const unitCost = line.unitCostCents ?? itemCost.get(line.itemId) ?? 0;
        r.invoiceCostCents += Math.round(quantity * unitCost);
        if (quantity !== 0 && unitCost !== 0) r.costIsEstimate = true;
      }
    }
  }

  const accountById = new Map(accounts.map(a => [a.id, a]));
  for (const tx of transactions) {
    if (!isPostable(tx) || !isTransactionInDateRange(tx, startDate, endDate)) continue;
    if (typeof tx.metadata?.cogsForInvoiceId === 'string') continue; // already in the invoice cost above
    for (const line of tx.lines || []) {
      const role = resolveAccountRole(accountById.get(line.accountId));
      if (role !== 'expense' && role !== 'cogs') continue;
      const project = getLineDimension(line, tx, 'project') || UNASSIGNED_PROJECT;
      // TransactionLine.amountCents is positive for a debit and negative for a credit: the cost is the net debit
      rowFor(project).expenseCents += lineAmount(line, tx);
    }
  }

  return Array.from(rows.values()).map(r => {
    const costCents = r.invoiceCostCents + r.expenseCents;
    const marginCents = r.revenueCents - costCents;
    return { ...r, costCents, marginCents, marginPct: pct(r.revenueCents, marginCents) };
  }).sort((a, b) => (a.project === UNASSIGNED_PROJECT ? 1 : 0) - (b.project === UNASSIGNED_PROJECT ? 1 : 0) || b.revenueCents - a.revenueCents || a.project.localeCompare(b.project));
}
