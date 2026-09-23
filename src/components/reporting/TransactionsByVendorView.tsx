import React, { useState, useMemo } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { PartyReportLayout, ColumnDef } from './PartyReportLayout';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

interface VendorTxRow {
  id: string;
  date: string;
  vendorName: string;
  type: string;
  reference: string;
  status: string;
  amountCents: number;
}

export const TransactionsByVendorView: React.FC = () => {
  const vendors = useLedgerStore(s => s.vendors);
  const bills = useLedgerStore(s => s.bills);
  const payments = useLedgerStore(s => s.payments);
  const [searchTerm, setSearchTerm] = useState('');

  const vendorMap = useMemo(() => {
    return new Map(vendors.map(v => [v.id, v.name]));
  }, [vendors]);

  const rows = useMemo<VendorTxRow[]>(() => {
    const list: VendorTxRow[] = [];

    // 1. Bills
    for (const bill of bills) {
      if (bill.status === 'void') continue;
      const vendorName = bill.vendorName || vendorMap.get(bill.vendorId) || 'Unknown Vendor';
      list.push({
        id: bill.id,
        date: bill.date || bill.dueDate || '2026-01-01',
        vendorName,
        type: 'Bill',
        reference: bill.number || bill.id,
        status: bill.status || 'pending',
        amountCents: bill.amountCents || 0
      });
    }

    // 2. Vendor disbursements / payments made (direction === 'made')
    for (const pay of payments) {
      if (pay.status === 'void' || pay.direction === 'received') continue;
      const vendorName = pay.contactName || vendorMap.get(pay.contactId) || 'Supplier Payment';
      list.push({
        id: pay.id,
        date: pay.date || '2026-01-01',
        vendorName,
        type: 'Vendor Payment',
        reference: pay.reference || pay.number || pay.id,
        status: pay.status || 'posted',
        amountCents: -(pay.amountCents || 0)
      });
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [bills, payments, vendorMap]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r => 
      r.vendorName.toLowerCase().includes(term) ||
      r.reference.toLowerCase().includes(term) ||
      r.type.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  const totalBilledCents = useMemo(() => {
    return filteredRows.filter(r => r.type === 'Bill').reduce((sum, r) => sum + r.amountCents, 0);
  }, [filteredRows]);

  const totalPaidCents = useMemo(() => {
    return filteredRows.filter(r => r.type === 'Vendor Payment').reduce((sum, r) => sum + Math.abs(r.amountCents), 0);
  }, [filteredRows]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Vendor Name', 'Type', 'Reference / Number', 'Status', 'Amount ($)'];
    const csvRows = filteredRows.map(r => [
      r.date,
      `"${r.vendorName.replace(/"/g, '""')}"`,
      r.type,
      `"${r.reference.replace(/"/g, '""')}"`,
      r.status,
      (r.amountCents / 100).toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_by_vendor_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Transactions by Vendor exported to CSV');
  };

  const columns: ColumnDef<VendorTxRow>[] = [
    {
      key: 'date',
      header: 'Date',
      className: 'whitespace-nowrap font-mono'
    },
    {
      key: 'vendorName',
      header: 'Vendor',
      render: (item) => (
        <span className="font-medium text-neutral-900 dark:text-white">
          {item.vendorName}
        </span>
      )
    },
    {
      key: 'type',
      header: 'Type',
      render: (item) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          item.type === 'Bill'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`}>
          {item.type}
        </span>
      )
    },
    {
      key: 'reference',
      header: 'Number / Ref',
      className: 'font-mono text-neutral-600 dark:text-neutral-400'
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <span className="capitalize text-[11px] text-neutral-500 dark:text-neutral-400">
          {item.status}
        </span>
      )
    },
    {
      key: 'amountCents',
      header: 'Amount',
      align: 'right',
      render: (item) => (
        <span className={`font-bold ${item.amountCents < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'}`}>
          {formatCurrency(item.amountCents)}
        </span>
      )
    }
  ];

  return (
    <PartyReportLayout
      title="Transactions by Vendor"
      description="Itemized chronological register of bills, vendor credits, and disbursement payments per supplier."
      icon={FileSpreadsheet}
      totalLabel="Total Billed Volume"
      totalAmountCents={totalBilledCents}
      secondaryTotalLabel="Total Disbursements"
      secondaryTotalCents={totalPaidCents}
      exportFilename="transactions_by_vendor.csv"
      onExportCSV={handleExportCSV}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Filter by vendor name, ref, or type..."
      columns={columns}
      data={filteredRows}
      emptyMessage="No vendor transactions found matching search filter."
      getRowId={(item) => item.id}
    />
  );
};

export default TransactionsByVendorView;
