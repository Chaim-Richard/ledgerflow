import React, { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { PartyReportLayout, ColumnDef } from './PartyReportLayout';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

interface PartyTxRow {
  id: string;
  date: string;
  partyName: string;
  type: string;
  reference: string;
  status: string;
  amountCents: number;
}

export const TransactionsByCustomerView: React.FC = () => {
  const customers = useLedgerStore(s => s.customers);
  const invoices = useLedgerStore(s => s.invoices);
  const payments = useLedgerStore(s => s.payments);
  const [searchTerm, setSearchTerm] = useState('');

  const customerMap = useMemo(() => {
    return new Map(customers.map(c => [c.id, c.name]));
  }, [customers]);

  const rows = useMemo<PartyTxRow[]>(() => {
    const list: PartyTxRow[] = [];

    // 1. Invoices
    for (const inv of invoices) {
      if (inv.status === 'void') continue;
      const customerName = inv.customerName || customerMap.get(inv.customerId) || 'Unknown Customer';
      list.push({
        id: inv.id,
        date: inv.date || inv.dueDate || '2026-01-01',
        partyName: customerName,
        type: 'Invoice',
        reference: inv.number || inv.id,
        status: inv.status || 'pending',
        amountCents: inv.amountCents || 0
      });
    }

    // 2. Payments (direction === 'received')
    for (const pay of payments) {
      if (pay.status === 'void' || pay.direction === 'made') continue;
      const customerName = pay.contactName || customerMap.get(pay.contactId) || 'Customer Payment';
      list.push({
        id: pay.id,
        date: pay.date || '2026-01-01',
        partyName: customerName,
        type: 'Payment',
        reference: pay.reference || pay.number || pay.id,
        status: pay.status || 'posted',
        amountCents: -(pay.amountCents || 0)
      });
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoices, payments, customerMap]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(r => 
      r.partyName.toLowerCase().includes(term) ||
      r.reference.toLowerCase().includes(term) ||
      r.type.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  const totalInvoicedCents = useMemo(() => {
    return filteredRows.filter(r => r.type === 'Invoice').reduce((sum, r) => sum + r.amountCents, 0);
  }, [filteredRows]);

  const totalPaymentsCents = useMemo(() => {
    return filteredRows.filter(r => r.type === 'Payment').reduce((sum, r) => sum + Math.abs(r.amountCents), 0);
  }, [filteredRows]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Customer Name', 'Type', 'Reference / Number', 'Status', 'Amount ($)'];
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
    link.download = `transactions_by_customer_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Transactions by Customer exported to CSV');
  };

  const columns: ColumnDef<PartyTxRow>[] = [
    {
      key: 'date',
      header: 'Date',
      className: 'whitespace-nowrap font-mono'
    },
    {
      key: 'partyName',
      header: 'Customer',
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
          item.type === 'Invoice'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
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
      title="Transactions by Customer"
      description="Itemized chronological ledger of invoices, receipts, and credits attributed to each customer."
      icon={FileText}
      totalLabel="Total Invoiced Volume"
      totalAmountCents={totalInvoicedCents}
      secondaryTotalLabel="Total Payments Volume"
      secondaryTotalCents={totalPaymentsCents}
      exportFilename="transactions_by_customer.csv"
      onExportCSV={handleExportCSV}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Filter by customer name, ref, or type..."
      columns={columns}
      data={filteredRows}
      emptyMessage="No customer transactions found matching search filter."
      getRowId={(item) => item.id}
    />
  );
};

export default TransactionsByCustomerView;
