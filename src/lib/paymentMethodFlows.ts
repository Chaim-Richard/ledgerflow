/**
 * E-23 — recorded payment movement by method and document currency.
 *
 * Uses saved posted Payment records, NOT invoices/bills or a substitute for cash
 * reconciliation. One payment is counted once, regardless of allocations.
 * Never adds unlike currencies, infers an exchange rate, or changes a posting.
 */
import type { Payment } from '../types';
import { validCustomReportPeriod, type CustomReportPeriod } from './reportCustomPeriod';

export interface PaymentMethodFlowRow {
  method: string;
  currency: string;
  receivedCount: number;
  receivedCents: number;
  madeCount: number;
  madeCents: number;
}
export interface PaymentMethodFlowResult {
  rows: PaymentMethodFlowRow[];
  undatedCount: number;
  unverifiedCount: number;
  impliedCurrencyCount: number;
  readyForExport: boolean;
}

const allowedMethods = new Set(['cash', 'check', 'bank_transfer', 'card', 'other']);
const isoDay = (date: unknown): string | null => {
  if (typeof date !== 'string') return null;
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = new Date(day + 'T00:00:00.000Z');
  return !Number.isNaN(time.getTime()) && time.toISOString().slice(0, 10) === day ? day : null;
};

export function paymentMethodFlows(
  payments: readonly Payment[],
  period: CustomReportPeriod,
  workspaceId: string,
  homeCurrency: string,
): PaymentMethodFlowResult {
  if (!validCustomReportPeriod(period)) throw new Error('Choose a valid payment report period.');
  const map = new Map<string, PaymentMethodFlowRow>();
  let undatedCount = 0;
  let unverifiedCount = 0;
  let impliedCurrencyCount = 0;
  const currencyFallback = homeCurrency.trim().toUpperCase();
  for (const payment of payments) {
    if (!workspaceId || payment.workspaceId !== workspaceId || payment.status !== 'posted') continue;
    const day = isoDay(payment.date);
    if (!day) { undatedCount++; continue; }
    if (day < period.startDate || day > period.endDate) continue;
    if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) { unverifiedCount++; continue; }
    const currency = (payment.currency || currencyFallback).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) { unverifiedCount++; continue; }
    if (!payment.currency) impliedCurrencyCount++;
    if (payment.direction !== 'received' && payment.direction !== 'made') { unverifiedCount++; continue; }
    const method = allowedMethods.has(payment.method) ? payment.method : 'other';
    const key = method + ':' + currency;
    let row = map.get(key);
    if (!row) {
      row = { method, currency, receivedCount: 0, receivedCents: 0, madeCount: 0, madeCents: 0 };
      map.set(key, row);
    }
    const prior = payment.direction === 'received' ? row.receivedCents : row.madeCents;
    if (!Number.isSafeInteger(prior + payment.amountCents)) { unverifiedCount++; continue; }
    if (payment.direction === 'received') {
      row.receivedCents += payment.amountCents;
      row.receivedCount++;
    } else {
      row.madeCents += payment.amountCents;
      row.madeCount++;
    }
  }
  return {
    rows: [...map.values()].sort((a, b) => a.method.localeCompare(b.method) || a.currency.localeCompare(b.currency)),
    undatedCount,
    unverifiedCount,
    impliedCurrencyCount,
    readyForExport: unverifiedCount === 0 && undatedCount === 0 && Boolean(workspaceId) && map.size > 0,
  };
}
