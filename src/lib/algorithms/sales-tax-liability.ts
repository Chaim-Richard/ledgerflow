import { AlgorithmDefinition, AlgoResult } from './types';
import { formatCurrency, parseLocalDate } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';

export const SALES_TAX_LIABILITY_ALGO: AlgorithmDefinition = {
  id: 'sales-tax-liability',
  name: 'Sales Tax Liability',
  domain: 'treasury', // or operations
  tags: ['Tax', 'Compliance', 'Reporting'],
  description: 'Calculates taxable sales, tax collected, and estimated tax due across jurisdictions based on invoiced revenue.',
  requires: ['invoices'], 
  inputs: [
    {
      kind: 'dateRange',
      key: 'period',
      label: 'Reporting Period',
      defaultValue: { start: '', end: '' }
    },
    {
      kind: 'select',
      key: 'jurisdiction',
      label: 'Tax Jurisdiction (Optional)',
      options: [
        { value: '', label: 'All Jurisdictions' },
        { value: 'NY', label: 'New York (NY)' },
        { value: 'CA', label: 'California (CA)' },
        { value: 'TX', label: 'Texas (TX)' }
      ],
      defaultValue: ''
    }
  ],
  compute: (transactions, accounts, inputs): AlgoResult => {
    // Note: Needs invoices. We fetch directly from the store as this is a read-only client-side sync operation.
    const invoices = useLedgerStore.getState().invoices || [];
    
    const period = inputs['period'];
    const selectedJurisdiction = inputs['jurisdiction'];

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (period && period.start && period.end) {
      startDate = parseLocalDate(period.start);
      endDate = parseLocalDate(period.end);
      endDate.setHours(23, 59, 59, 999);
    }

    let relevantInvoices = invoices.filter(i => i.status === 'paid' || i.status === 'sent' || i.status === 'pending');

    if (startDate && endDate) {
      relevantInvoices = relevantInvoices.filter(i => {
        const d = parseLocalDate(i.date || i.dueDate);
        return d >= startDate! && d <= endDate!;
      });
    }

    const rows: any[] = [];
    const sourceTransactionIds = new Set<string>();

    let totalSales = 0;
    let totalTaxableSales = 0;
    let totalTaxCollected = 0;

    // Group by jurisdiction. Since invoices don't natively have jurisdiction, we'll infer it from customer state 
    // or metadata, or just group by tax rate if missing.
    const customers = useLedgerStore.getState().customers || [];
    
    const jurisdictionTotals: Record<string, { sales: number, taxable: number, tax: number }> = {};

    relevantInvoices.forEach(inv => {
      // Find customer to get jurisdiction
      const customer = customers.find(c => c.id === inv.customerId);
      // Rough heuristic: use customer metadata or fallback to a default if taxRate exists
      let jurisdiction = 'Unknown';
      if (customer && (customer as any).state) {
        jurisdiction = (customer as any).state;
      } else if (inv.taxRate && inv.taxRate > 0) {
        jurisdiction = 'Taxable Region (Unknown)';
      }

      if (selectedJurisdiction && jurisdiction !== selectedJurisdiction && jurisdiction !== 'Unknown') {
        return; // skip if filtering and it doesn't match
      }

      const salesCents = inv.amountCents || 0;
      const taxRate = inv.taxRate || 0;
      const isTaxable = taxRate > 0;
      
      let taxCents = 0;
      let taxableSalesCents = 0;

      if (isTaxable) {
        if (inv.taxInclusive) {
          taxCents = Math.round(salesCents - (salesCents / (1 + taxRate)));
          taxableSalesCents = salesCents - taxCents;
        } else {
          taxableSalesCents = salesCents;
          taxCents = Math.round(salesCents * taxRate);
        }
      }

      totalSales += salesCents;
      totalTaxableSales += taxableSalesCents;
      totalTaxCollected += taxCents;

      if (!jurisdictionTotals[jurisdiction]) {
        jurisdictionTotals[jurisdiction] = { sales: 0, taxable: 0, tax: 0 };
      }
      jurisdictionTotals[jurisdiction].sales += salesCents;
      jurisdictionTotals[jurisdiction].taxable += taxableSalesCents;
      jurisdictionTotals[jurisdiction].tax += taxCents;
      
      // We assume an invoice generates a transaction eventually. If we knew the tx ID, we'd add it.
    });

    Object.entries(jurisdictionTotals).forEach(([jur, totals]) => {
      if (totals.sales === 0) return;
      rows.push({
        id: jur,
        jurisdiction: jur,
        grossSales: formatCurrency(totals.sales),
        taxableSales: formatCurrency(totals.taxable),
        taxCollected: formatCurrency(totals.tax),
        taxDue: formatCurrency(totals.tax) // Assuming all collected is due for basic reporting
      });
    });

    return {
      metrics: [
        { label: 'Gross Sales', value: formatCurrency(totalSales), color: 'text-white' },
        { label: 'Taxable Sales', value: formatCurrency(totalTaxableSales), color: 'text-indigo-400' },
        { label: 'Tax Collected / Due', value: formatCurrency(totalTaxCollected), color: 'text-rose-400' }
      ],
      charts: [
        {
          config: {
            xKey: 'jurisdiction',
            yKeys: [
              { key: 'tax', name: 'Tax Due', color: '#f43f5e', type: 'bar' }
            ]
          },
          data: rows.map(r => ({
            jurisdiction: r.jurisdiction,
            tax: parseFloat(r.taxDue.replace(/[^0-9.-]+/g,""))
          }))
        }
      ],
      insights: [
        `Generated liability report across ${rows.length} jurisdictions.`,
        `Effective blended sales tax rate across taxable sales: ${totalTaxableSales > 0 ? ((totalTaxCollected / totalTaxableSales) * 100).toFixed(2) : 0}%.`
      ],
      rows,
      sourceTransactionIds: Array.from(sourceTransactionIds)
    };
  }
};
