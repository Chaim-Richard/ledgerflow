import React, { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { usePageSyncedState } from '../../hooks/usePageSyncedState';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { PartyReportLayout, ColumnDef } from './PartyReportLayout';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { csvMoney, downloadCsv } from '../../lib/csvExport';
import { computeInventoryValuation, InventoryValuationRow } from '../../server/reports/itemReports';

/**
 * Inventory Valuation (J-09): each item's stock at cost, and the total against the Inventory
 * account in the books (src/server/reports/itemReports.ts).
 */
export const InventoryValuationReportView: React.FC<{ asOfDate?: string }> = ({ asOfDate: pageAsOfDate }) => {
  const inventory = useLedgerStore(s => s.inventory);
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  useLedgerCollections('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [asOfDate, setAsOfDate] = usePageSyncedState(pageAsOfDate || '', pageAsOfDate || undefined, getLocalDateISO);

  const report = useMemo(() => computeInventoryValuation(inventory || [], accounts || [], transactions || [], asOfDate),
    [inventory, accounts, transactions, asOfDate]);

  const shown = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    return term ? report.rows.filter(r => `${r.name} ${r.sku} ${r.category}`.toLocaleLowerCase().includes(term)) : report.rows;
  }, [report.rows, searchTerm]);

  const exportCsv = () => {
    downloadCsv(`inventory_valuation_${asOfDate}.csv`,
      ['Item', 'SKU', 'Category', 'On hand', 'Unit cost', 'Value', 'Share %'],
      shown.map(r => [r.name, r.sku, r.category, r.quantity, csvMoney(r.unitCostCents), csvMoney(r.valueCents), r.sharePct]));
    toast.success('Inventory Valuation exported to CSV');
  };

  const columns: ColumnDef<InventoryValuationRow>[] = [
    {
      key: 'name',
      header: 'Item',
      render: (r) => (
        <div>
          <div className="font-semibold text-[var(--text)]">{r.name}</div>
          <div className="text-[10px] text-[var(--muted)]">{[r.sku, r.category].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'On hand',
      align: 'right',
      render: (r) => (
        <span className={r.quantity < 0 ? 'text-[var(--neg)] font-semibold' : r.belowReorder ? 'text-[var(--brass)] font-semibold' : ''}>
          {r.quantity}{r.quantity < 0 ? ' (negative)' : r.belowReorder ? ' (reorder)' : ''}
        </span>
      ),
    },
    { key: 'unitCostCents', header: 'Unit cost', align: 'right', render: (r) => formatCurrency(r.unitCostCents) },
    { key: 'valueCents', header: 'Value', align: 'right', render: (r) => <span className="font-semibold">{formatCurrency(r.valueCents)}</span> },
    { key: 'sharePct', header: 'Share', align: 'right', render: (r) => `${r.sharePct}%` },
  ];

  return (
    <div className="space-y-4">
      <PartyReportLayout
        title="Inventory Valuation"
        description="Stock on hand at cost. Quantities are today's; the books are as of the date."
        icon={Boxes}
        totalLabel="Stock value"
        totalAmountCents={report.totalValueCents}
        secondaryTotalLabel="Inventory account in the books"
        secondaryTotalCents={report.ledgerValueCents}
        exportFilename="inventory_valuation.csv"
        onExportCSV={exportCsv}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search item, SKU or category..."
        asOfDate={asOfDate}
        onAsOfDateChange={setAsOfDate}
        columns={columns}
        data={shown}
        emptyMessage="No items yet. Add them in Inventory."
        sumKeys={['valueCents']}
        getRowId={(r) => r.itemId}
      />
      {report.rows.length > 0 && (
        <p role="status" className={`text-xs p-3 rounded-lg border ${report.differenceCents === 0 ? 'border-[var(--line)] text-[var(--muted)]' : 'border-[var(--brass)] text-[var(--text)]'}`}>
          {report.differenceCents === 0
            ? 'The stock list and the Inventory account agree.'
            : `The stock list is ${formatCurrency(Math.abs(report.differenceCents))} ${report.differenceCents > 0 ? 'more' : 'less'} than the Inventory account. A purchase, stock count or sale is recorded on one side only (bills don't add stock to items yet).`}
          {report.negativeStockItems > 0 && ` ${report.negativeStockItems} item(s) have negative stock and are valued at 0.`}
        </p>
      )}
    </div>
  );
};

export default InventoryValuationReportView;
