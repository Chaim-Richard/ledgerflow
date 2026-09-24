import React, { useState, useMemo } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { PartyReportLayout, ColumnDef } from './PartyReportLayout';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { getFiscalYearBounds } from '../../lib/fiscalCalendar';
import { computeTransactionsByVendor, PartyTransactionRow } from '../../server/reports/computeReports';
import { toast } from 'sonner';

export const TransactionsByVendorView: React.FC = () => {
  const vendors = useLedgerStore(s => s.vendors);
  const bills = useLedgerStore(s => s.bills);
  const payments = useLedgerStore(s => s.payments);
  const vendorCredits = useLedgerStore(s => s.vendorCredits);
  const [searchTerm, setSearchTerm] = useState('');

  const [startDate, setStartDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('startDate') || getFiscalYearBounds().startDate;
  });
  const [endDate, setEndDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('endDate') || getFiscalYearBounds().endDate;
  });

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    const url = new URL(window.location.href);
    if (val) url.searchParams.set('startDate', val);
    else url.searchParams.delete('startDate');
    window.history.replaceState({}, '', url.toString());
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    const url = new URL(window.location.href);
    if (val) url.searchParams.set('endDate', val);
    else url.searchParams.delete('endDate');
    window.history.replaceState({}, '', url.toString());
  };

  const rows = useMemo<PartyTransactionRow[]>(() => {
    return computeTransactionsByVendor(
      vendors,
      bills,
      payments,
      vendorCredits,
      startDate || undefined,
      endDate || undefined
    );
  }, [vendors, bills, payments, vendorCredits, startDate, endDate]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r => 
      r.partyName.toLowerCase().includes(term) ||
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
      `"${r.partyName.replace(/"/g, '""')}"`,
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
    link.download = `transactions_by_vendor_${getLocalDateISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Transactions by Vendor exported to CSV');
  };

  const columns: ColumnDef<PartyTransactionRow>[] = [
    {
      key: 'date',
      header: 'Date',
      className: 'whitespace-nowrap font-mono'
    },
    {
      key: 'partyName',
      header: 'Vendor',
      render: (item) => (
        <span className="font-medium text-neutral-900 dark:text-white">
          {item.partyName}
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
            : item.type === 'Vendor Credit'
            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
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
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={handleStartDateChange}
      onEndDateChange={handleEndDateChange}
      columns={columns}
      data={filteredRows}
      emptyMessage="No vendor transactions found matching search filter."
      getRowId={(item) => item.id}
    />
  );
};

export default TransactionsByVendorView;

