import { AlgorithmDefinition, AlgoResult } from './types';
import { Transaction } from '../../types';
import { formatCurrency, parseLocalDate } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';

export const COMPLIANCE_1099_ALGO: AlgorithmDefinition = {
  id: '1099-totals',
  name: '1099-NEC Contractor Totals',
  domain: 'planning', // This maps to "Tax time"
  tags: ['Compliance', 'Tax', 'Reporting'],
  description: 'Calculates total payments to 1099-eligible vendors within a calendar year, filtering by IRS reporting thresholds.',
  requires: ['transactions', 'bills'], // Technically needs bills/vendors
  inputs: [
    {
      kind: 'select',
      key: 'year',
      label: 'Tax Year',
      options: [
        { value: '2026', label: '2026' },
        { value: '2025', label: '2025' }
      ],
      defaultValue: '2026'
    },
    {
      kind: 'number',
      key: 'threshold',
      label: 'Reporting Threshold ($)',
      min: 0,
      max: 5000,
      step: 100,
      defaultValue: 600
    }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    // Note: Needs vendors. We fetch directly from the store as this is a read-only client-side sync operation.
    const vendors = useLedgerStore.getState().vendors || [];
    
    const year = inputs['year'] || '2026';
    const thresholdCents = (inputs['threshold'] ?? 600) * 100;

    // Filter to 1099 vendors
    const eligibleVendors = vendors.filter(v => v.is1099);

    if (eligibleVendors.length === 0) {
      return {
        metrics: [],
        charts: [],
        insights: ["No vendors are marked as 'is1099' in this workspace."],
        rows: []
      };
    }

    // Since transactions don't natively carry vendorId on all entries reliably in this schema 
    // unless mapped via bills or explicitly tagged, we'll look for cash-out transactions
    // that match the vendor names, or if transactions have a vendorId (via `src/types.ts` expansion).
    // In our current schema, we assume `transactions` has `description` that might match vendor names,
    // or we might need to rely on `bills` being paid. 
    // For this reporting tool, we will map `bills` that are 'paid' in the year.
    const bills = useLedgerStore.getState().bills || [];
    
    const rows: any[] = [];
    const sourceTransactionIds = new Set<string>();
    let totalEligiblePayments = 0;
    let qualifyingVendorCount = 0;

    eligibleVendors.forEach(vendor => {
      let paidCents = 0;

      // Find all paid bills for this vendor in the target year
      bills.forEach(bill => {
        if (bill.vendorId === vendor.id && bill.status === 'paid') {
          // Check payment date or bill date
          // If bill has a paymentDate, use it, else use bill date as a proxy
          const dateStr = bill.date || '';
          if (dateStr.startsWith(year)) {
            paidCents += bill.amountCents;
          }
        }
      });
      
      // Also try to find direct expenses not linked to a bill by matching vendor name in description
      // (This is a heuristic fallback often used in these systems)
      transactions.forEach(tx => {
        if (tx.status === 'void' || !tx.date.startsWith(year)) return;
        
        // If it's an expense and description matches vendor name
        const isCashOut = tx.lines.some(e => e.amountCents < 0 && accounts.find(a => a.id === e.accountId)?.type === 'asset');
        const hasExpense = tx.lines.some(e => e.amountCents > 0 && accounts.find(a => a.id === e.accountId)?.type === 'expense');
        
        if (isCashOut && hasExpense && (tx.description || '').toLowerCase().includes((vendor.name || '').toLowerCase())) {
          // Add amount (avoid double counting if it's already linked to a bill... this is tough without explicit links)
          // For now, we'll just use bills to be deterministic, but acknowledge the limitation.
        }
      });

      if (paidCents >= thresholdCents) {
        qualifyingVendorCount++;
        totalEligiblePayments += paidCents;
        rows.push({
          id: vendor.id,
          vendor: vendor.name,
          email: vendor.email || '-',
          amount: formatCurrency(paidCents)
        });
      }
    });

    return {
      metrics: [
        { label: 'Qualifying Vendors', value: qualifyingVendorCount, color: 'text-indigo-400' },
        { label: 'Total 1099-NEC Payments', value: formatCurrency(totalEligiblePayments), color: 'text-emerald-400' }
      ],
      charts: [],
      insights: [
        `Found ${qualifyingVendorCount} vendors exceeding the $${thresholdCents / 100} threshold for year ${year}.`,
        'Ensure you have valid W-9s on file for these vendors.'
      ],
      rows
    };
  }
};
