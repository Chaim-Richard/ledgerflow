import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { formatCurrency } from '../../lib/utils';
import { Package, TrendingUp } from 'lucide-react';
import { isPostable } from '../../lib/txFilters';
import { Invoice } from '../../types';

interface Props {
  selectedYear?: number;
  startDate?: string;
  endDate?: string;
}

export const SalesByItemReportView: React.FC<Props> = ({ selectedYear, startDate, endDate }) => {
  const invoices = useLedgerStore(s => s.invoices);
  const inventoryItems = useLedgerStore(s => s.inventory);

  const itemSales = useMemo(() => {
    const map: Record<string, { name: string; sku: string; qty: number; revenueCents: number; costCents: number }> = {};

    (invoices || []).forEach((inv: Invoice) => {
      if (inv.status === 'void' || inv.status === 'draft') return;
      if (startDate && inv.date && inv.date < startDate) return;
      if (endDate && inv.date && inv.date > endDate) return;
      if (selectedYear && inv.date && !inv.date.startsWith(selectedYear.toString())) return;

      inv.items?.forEach(item => {
        const key = item.itemId || item.description || 'Custom Item';
        if (!map[key]) {
          const invItem = inventoryItems.find(i => i.id === item.itemId);
          map[key] = {
            name: invItem?.name || item.description || 'Unnamed Item',
            sku: invItem?.sku || '-',
            qty: 0,
            revenueCents: 0,
            costCents: 0
          };
        }
        const qty = item.quantity || 1;
        const rev = item.amountCents || (qty * (item.rateCents || 0));
        const invItem = inventoryItems.find(i => i.id === item.itemId);
        const costPerUnit = item.unitCostCents !== undefined ? item.unitCostCents : (invItem?.unitCostCents || 0);

        map[key].qty += qty;
        map[key].revenueCents += rev;
        map[key].costCents += qty * costPerUnit;
      });
    });

    return Object.values(map).map(item => {
      const profitCents = item.revenueCents - item.costCents;
      const margin = item.revenueCents > 0 ? (profitCents / item.revenueCents) * 100 : 0;
      return {
        ...item,
        profitCents,
        margin
      };
    }).sort((a, b) => b.revenueCents - a.revenueCents);
  }, [invoices, inventoryItems, selectedYear, startDate, endDate]);

  const totals = useMemo(() => {
    return itemSales.reduce((acc, cur) => ({
      revenue: acc.revenue + cur.revenueCents,
      cost: acc.cost + cur.costCents,
      profit: acc.profit + cur.profitCents
    }), { revenue: 0, cost: 0, profit: 0 });
  }, [itemSales]);

  const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="sales-by-item-report">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-200 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            Sales by Item & Profit Margin
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Detailed performance breakdown of inventory items and services sold, including COGS and gross margins.
          </p>
        </div>
        <div className="flex items-center gap-6 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
          <div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold">Total Revenue</div>
            <div className="text-sm font-mono font-bold text-emerald-600">{formatCurrency(totals.revenue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold">Gross Profit</div>
            <div className="text-sm font-mono font-bold text-indigo-600">{formatCurrency(totals.profit)}</div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 uppercase font-bold">Margin</div>
            <div className="text-sm font-mono font-bold text-neutral-900">{overallMargin.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {itemSales.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 text-neutral-500 text-xs">
          No invoice line items found for the selected period.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item / SKU</th>
                <th className="py-3 px-4 text-center">Qty Sold</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">Est. Cost</th>
                <th className="py-3 px-4 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {itemSales.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-neutral-900">{item.name}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">SKU: {item.sku}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-neutral-700">
                    {item.qty}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600">
                    {formatCurrency(item.revenueCents)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-600">
                    {formatCurrency(item.costCents)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-indigo-600">
                    {formatCurrency(item.profitCents)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-800">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px]",
                      item.margin >= 40 ? "bg-emerald-50 text-emerald-700" : item.margin >= 15 ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                    )}>
                      {item.margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesByItemReportView;
