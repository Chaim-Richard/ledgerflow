import { AlgorithmDefinition, AlgoResult, adaptLegacy } from './types';
import { Transaction } from '../../types';
import { formatCurrency, parseLocalDate } from '../../lib/utils';
import { isPostable } from '../../lib/txFilters';

export const COMPLIANCE_1099_ALGO: AlgorithmDefinition = {
  id: '1099-totals',
  name: '1099-NEC Contractor Totals',
  domain: 'planning', // This maps to "Tax time"
  tags: ['Compliance', 'Tax', 'Reporting'],
  description: 'Calculates total payments to 1099-eligible vendors within a calendar year, filtering by IRS reporting thresholds.',
  requires: ['transactions', 'bills'],
  inputs: [
    {
      kind: 'select',
      key: 'year',
      label: 'Tax Year',
      options: [
        { value: '2027', label: '2027' },
        { value: '2026', label: '2026' },
        { value: '2025', label: '2025' },
        { value: '2024', label: '2024' }
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
  compute: adaptLegacy((transactions, accounts, inputs, context): AlgoResult => {
    const vendors = context?.vendors || [];
    const bills = context?.bills || [];
    
    const year = inputs['year'] || '2026';
    const thresholdCents = (inputs['threshold'] ?? 600) * 100;

    // Filter to 1099 vendors
    const eligibleVendors = vendors.filter((v: any) => v.is1099);

    if (eligibleVendors.length === 0) {
      return {
        metrics: [],
        charts: [],
        insights: ["No vendors are marked as 'is1099' in this workspace."],
        rows: []
      };
    }

    const rows: any[] = [];
    const sourceTransactionIds = new Set<string>();
    let totalEligiblePayments = 0;
    let qualifyingVendorCount = 0;

    eligibleVendors.forEach((vendor: any) => {
      let paidCents = 0;

      // 1. Find all paid bills for this vendor paid in the target year (cash basis)
      bills.forEach((bill: any) => {
        if (bill.vendorId === vendor.id && (bill.status === 'paid' || bill.status === 'partially_paid')) {
          // Check actual payment date (cash basis)
          const paymentDateStr = bill.paidAt || bill.paymentDate || bill.paidDate || bill.date || '';
          if (paymentDateStr.startsWith(year)) {
            paidCents += bill.amountCents || 0;
          }
        }
      });
      
      // 2. Also find direct cash expense transactions paid to vendor (not mapped to a bill)
      transactions.forEach(tx => {
        if (!isPostable(tx) || !tx.date.startsWith(year)) return;
        
        const isVendorMatch = (tx as any).vendorId === vendor.id ||
          (tx.payee && tx.payee.toLowerCase().includes(vendor.name.toLowerCase())) ||
          (tx.description && tx.description.toLowerCase().includes(vendor.name.toLowerCase()));

        if (isVendorMatch) {
          // Check if tx is cash-out to expense without a bill
          const isCashOut = tx.lines?.some(e => e.amountCents < 0);
          const hasExpense = tx.lines?.some(e => {
            const acc = accounts.find(a => a.id === e.accountId);
            return acc && (acc.type === 'expense' || acc.type === 'cost_of_goods');
          });

          if (isCashOut && hasExpense) {
            // Avoid double counting if transaction was generated from a bill
            const isBillTx = (tx as any).billId || (tx as any).source === 'bill';
            if (!isBillTx) {
              const expCents = tx.lines
                .filter(l => l.amountCents > 0)
                .reduce((s, l) => s + l.amountCents, 0);
              paidCents += expCents;
              sourceTransactionIds.add(tx.id);
            }
          }
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
        `Found ${qualifyingVendorCount} vendors exceeding the $${thresholdCents / 100} threshold for tax year ${year}.`,
        'Ensure you have valid W-9s on file for these vendors prior to filing 1099-NEC forms.'
      ],
      rows,
      sourceTransactionIds: Array.from(sourceTransactionIds)
    };
  })
};
