/**
 * Goods returned (BF-06), in the customer credit note form: for each stock line of the credited
 * invoice, how many came back. Shows what was sold and what earlier returns took back; more than is
 * left is refused before saving (src/lib/salesReturns.ts) and again by the server. Offers the credit
 * at the invoice's price for what came back; the amount stays the user's to change.
 */
import React from 'react';
import { formatCurrency } from '../../lib/utils';
import type { ReturnableLine } from '../../lib/salesReturns';

export default function ReturnedGoodsFields({ lines, value, onChange, currency, onUsePrice }: {
  lines: ReturnableLine[];
  /** quantity typed per invoice line id */
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  currency: string;
  /** fill the credit amount with the price of what came back (cents) */
  onUsePrice: (cents: number) => void;
}) {
  if (lines.length === 0) return null;
  const priceCents = lines.reduce((s, l) => s + Math.round((Number(value[l.invoiceLineId]) || 0) * l.unitPriceCents), 0);
  return (
    <fieldset className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Goods returned</legend>
      <p className="text-xs text-gray-500">What came back goes back into stock at the cost it left at. Leave 0 for a credit without goods (a discount or a price correction).</p>
      <table className="w-full text-xs">
        <caption className="sr-only">Stock lines of the credited invoice</caption>
        <thead>
          <tr className="text-gray-500">
            <th scope="col" className="text-left font-semibold py-1">Item</th>
            <th scope="col" className="text-right font-semibold py-1">Sold</th>
            <th scope="col" className="text-right font-semibold py-1">Already back</th>
            <th scope="col" className="text-right font-semibold py-1 w-24">Came back now</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(line => (
            <tr key={line.invoiceLineId}>
              <td className="py-1"><bdi>{line.description}</bdi></td>
              <td className="py-1 text-right font-mono">{line.sold}</td>
              <td className="py-1 text-right font-mono">{line.returned}</td>
              <td className="py-1 pl-2">
                <input aria-label={`How many of ${line.description} came back`} inputMode="decimal" value={value[line.invoiceLineId] ?? ''} placeholder="0"
                  disabled={line.returnable <= 0}
                  onChange={e => onChange({ ...value, [line.invoiceLineId]: e.target.value })}
                  className="w-full p-1.5 text-right font-mono bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {priceCents > 0 && (
        <button type="button" onClick={() => onUsePrice(priceCents)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          Credit their price: {formatCurrency(priceCents, currency)}
        </button>
      )}
    </fieldset>
  );
}
