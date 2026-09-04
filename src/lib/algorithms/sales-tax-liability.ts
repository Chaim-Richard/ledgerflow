import { AlgorithmDefinition, AlgoResult } from './types';
import { formatCurrency, parseLocalDate } from '../../lib/utils';

export const SALES_TAX_LIABILITY_ALGO: AlgorithmDefinition = {
  id: 'sales-tax-liability',
  name: 'Sales Tax Liability',
  domain: 'treasury',
  tags: ['Tax', 'Compliance', 'Reporting'],
  description: 'Calculates taxable sales, tax collected, and estimated tax due across jurisdictions based on invoiced or collected revenue.',
  requires: ['invoices'], 
  inputs: [
    {
      kind: 'select',
      key: 'accountingBasis',
      label: 'Accounting Basis',
      options: [
        { value: 'cash', label: 'Cash Basis (Tax Collected on Payment)' },
        { value: 'accrual', label: 'Accrual Basis (Tax Invoiced)' }
      ],
      defaultValue: 'cash'
    },
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
        { value: 'TX', label: 'Texas (TX)' },
        { value: 'FL', label: 'Florida (FL)' }
      ],
      defaultValue: ''
    }
  ],
  compute: (transactions, accounts, inputs, context): AlgoResult => {
    const invoices = context?.invoices || [];
    const customers = context?.customers || [];
    
    const basis = inputs['accountingBasis'] || 'cash';
    const period = inputs['period'];
    const selectedJurisdiction = inputs['jurisdiction'];

    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (period && period.start && period.end) {
      startDate = parseLocalDate(period.start);
      endDate = parseLocalDate(period.end);
      endDate.setHours(23, 59, 59, 999);
    }

    let relevantInvoices = invoices.filter((i: any) => {
      if (i.deletedAt || i.status === 'void' || i.status === 'draft' || i.status === 'rejected' || i.status === 'cancelled') {
        return false;
      }
      if (basis === 'cash') {
        return i.status === 'paid' || i.status === 'partially_paid';
      }
      // accrual
      return true;
    });

    if (startDate && endDate) {
      relevantInvoices = relevantInvoices.filter((i: any) => {
        const dateStr = basis === 'cash' ? (i.paidAt || i.paymentDate || i.paidDate || i.date) : (i.date || i.dueDate);
        if (!dateStr) return false;
        const d = parseLocalDate(dateStr);
        return d >= startDate! && d <= endDate!;
      });
    }

    const rows: any[] = [];
    const sourceTransactionIds = new Set<string>();

    let totalSales = 0;
    let totalTaxableSales = 0;
    let totalTaxCollected = 0;

    const jurisdictionTotals: Record<string, { sales: number, taxable: number, tax: number }> = {};

    relevantInvoices.forEach((inv: any) => {
      // Find customer to get jurisdiction
      const customer = customers.find((c: any) => c.id === inv.customerId);
      let jurisdiction = 'Unknown';
      if (customer && customer.state) {
        jurisdiction = customer.state;
      } else if (inv.taxRate && inv.taxRate > 0) {
        jurisdiction = 'Taxable Region (Unknown)';
      }

      if (selectedJurisdiction && jurisdiction !== selectedJurisdiction && jurisdiction !== 'Unknown') {
        return;
      }

      const salesCents = inv.amountCents || inv.totalCents || 0;
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
    });

    Object.entries(jurisdictionTotals).forEach(([jur, totals]) => {
      if (totals.sales === 0) return;
      rows.push({
        id: jur,
        jurisdiction: jur,
        grossSales: formatCurrency(totals.sales),
        taxableSales: formatCurrency(totals.taxable),
        taxCollected: formatCurrency(totals.tax),
        taxDue: formatCurrency(totals.tax)
      });
    });

    return {
      metrics: [
        { label: `Gross Sales (${basis.toUpperCase()})`, value: formatCurrency(totalSales), color: 'text-white' },
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
        `Generated ${basis.toUpperCase()} sales tax liability report across ${rows.length} jurisdictions.`,
        `Effective blended sales tax rate across taxable sales: ${totalTaxableSales > 0 ? ((totalTaxCollected / totalTaxableSales) * 100).toFixed(2) : 0}%.`
      ],
      rows,
      sourceTransactionIds: Array.from(sourceTransactionIds)
    };
  }
};
