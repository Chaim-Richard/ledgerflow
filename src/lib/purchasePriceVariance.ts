/**
 * A-141: vendor purchase-price variance, using the same dated bill lines and whole-cent unit-cost
 * calculation as Vendor Price History / Vendor Scorecard. The baseline is the median of the other
 * vendors' quantity-weighted average unit costs for that item and currency; no currency conversion,
 * catalogue price, tax recalculation or bill mutation is involved.
 */
import type { Bill, InventoryItem, Vendor } from '../types';
import { vendorPriceHistory } from './vendorPriceHistory';

export interface PurchasePriceVarianceInput {
  bills: Array<Pick<Bill, 'id' | 'vendorId' | 'number' | 'date' | 'currency' | 'status' | 'splits'>>;
  vendors: Array<Pick<Vendor, 'id' | 'name'>>;
  items?: Array<Pick<InventoryItem, 'id' | 'name' | 'sku'>>;
  /** Inclusive bill-date window; an omitted side is open. */
  from?: string;
  to?: string;
  homeCurrency?: string;
}

export interface PurchasePriceVarianceRow {
  vendorId: string;
  vendorName: string;
  itemId: string;
  itemName: string;
  sku?: string;
  currency: string;
  purchases: number;
  units: number;
  totalCents: number;
  /** Quantity-weighted mean of this vendor's bill-line unit costs, rounded to a whole minor unit. */
  averageUnitCents: number;
  peerVendors: number;
  /** Median of peer vendors' average unit costs; absent when there is no comparable vendor. */
  peerMedianUnitCents?: number;
  varianceUnitCents?: number;
  /** Difference from the peer median as a percent; undefined when there is no positive baseline. */
  variancePercent?: number;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Compare one vendor with other vendors for the same item in the same currency. */
export function purchasePriceVariance(input: PurchasePriceVarianceInput): PurchasePriceVarianceRow[] {
  const history = vendorPriceHistory(input);
  const peerRows = new Map<string, Array<{ vendorId: string; unitCents: number }>>();
  for (const row of history) {
    if (!(row.units > 0) || !Number.isFinite(row.totalCents)) continue;
    const key = `${row.itemId}\u0000${row.currency}`;
    const values = peerRows.get(key) || [];
    values.push({ vendorId: row.vendorId, unitCents: Math.round(row.totalCents / row.units) });
    peerRows.set(key, values);
  }

  return history.map(row => {
    const averageUnitCents = Math.round(row.totalCents / row.units);
    const comparable = (peerRows.get(`${row.itemId}\u0000${row.currency}`) || [])
      .filter(peer => peer.vendorId !== row.vendorId)
      .map(peer => peer.unitCents);
    const peerMedianUnitCents = median(comparable);
    const varianceUnitCents = peerMedianUnitCents === undefined ? undefined : averageUnitCents - peerMedianUnitCents;
    const variancePercent = peerMedianUnitCents !== undefined && peerMedianUnitCents > 0 && varianceUnitCents !== undefined
      ? Math.round((varianceUnitCents / peerMedianUnitCents) * 10000) / 100
      : undefined;
    const purchases = new Set(row.points.map(point => point.documentId)).size;

    return {
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      itemId: row.itemId,
      itemName: row.itemName,
      sku: row.sku,
      currency: row.currency,
      purchases,
      units: row.units,
      totalCents: row.totalCents,
      averageUnitCents,
      peerVendors: comparable.length,
      ...(peerMedianUnitCents === undefined ? {} : { peerMedianUnitCents }),
      ...(varianceUnitCents === undefined ? {} : { varianceUnitCents }),
      ...(variancePercent === undefined ? {} : { variancePercent }),
    };
  });
}

export const PURCHASE_PRICE_VARIANCE_CSV_HEADERS = [
  'Vendor', 'Item', 'SKU', 'Currency', 'Purchases', 'Units', 'Total line amount (minor units)',
  'Vendor average unit cost (minor units)', 'Comparable peer vendors', 'Peer median unit cost (minor units)',
  'Variance from peer median (minor units)', 'Variance from peer median (%)',
];

export function purchasePriceVarianceCsvRows(rows: readonly PurchasePriceVarianceRow[]): Array<Array<string | number>> {
  return rows.map(row => [
    row.vendorName, row.itemName, row.sku || '', row.currency, row.purchases, row.units, row.totalCents,
    row.averageUnitCents, row.peerVendors, row.peerMedianUnitCents ?? '', row.varianceUnitCents ?? '', row.variancePercent ?? '',
  ]);
}
