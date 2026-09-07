import { AlgorithmDefinition, AlgoResult } from './types';
import { formatCurrency, parseLocalDate } from '../../lib/utils';

/**
 * Normalizes taxRate input into a canonical decimal fraction (e.g. 8.25% -> 0.0825).
 * Accepts percentage numbers (e.g. 5, 8.25, 10, 100) or decimal fractions (0.05, 0.0825, 1.0).
 */
export function normalizeTaxRate(rate: any): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return 0;
  if (rate > 1) {
    return rate / 100;
  }
  return rate;
}

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
      key: 'sourcingRule',
      label: 'Sourcing Rule',
      options: [
        { value: 'destination', label: 'Destination-Based (Buyer Ship-To / State)' },
        { value: 'origin', label: 'Origin-Based (Seller State)' }
      ],
      defaultValue: 'destination'
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
  compute: (ctx, inputs): AlgoResult => {
    const invoices = ctx.entities?.invoices || [];
    const customers = ctx.entities?.customers || [];
    
    const basis = inputs['accountingBasis'] || 'cash';
    const sourcingRule = inputs['sourcingRule'] || 'destination';
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
      const customer = customers.find((c: any) => c.id === inv.customerId);
      const jurisdiction = sourcingRule === 'origin'
        ? (inv.originState || (ctx as any).workspace?.state || 'Origin State')
        : (inv.shippingAddress?.state || 
           inv.taxJurisdiction || 
           customer?.shippingAddress?.state || 
           customer?.state || 
           inv.billingAddress?.state || 
           customer?.billingAddress?.state || 
           (inv.taxRate && inv.taxRate > 0 ? 'Taxable Region (Unknown)' : 'Exempt / Non-Taxable'));

      if (selectedJurisdiction && jurisdiction !== selectedJurisdiction && jurisdiction !== 'Unknown') {
        return;
      }

      const totalInvCents = inv.totalCents || inv.amountCents || 0;
      let salesCents = totalInvCents;
      if (basis === 'cash') {
        const paidCents = typeof inv.amountPaidCents === 'number' 
          ? inv.amountPaidCents 
          : (typeof inv.paidAmountCents === 'number' ? inv.paidAmountCents : (inv.status === 'paid' ? totalInvCents : 0));
        salesCents = paidCents;
      }

      if (salesCents <= 0) return;

      if (inv.id) sourceTransactionIds.add(inv.id);
      if (inv.transactionId) sourceTransactionIds.add(inv.transactionId);
      if (Array.isArray(inv.paymentTransactionIds)) {
        inv.paymentTransactionIds.forEach((ptId: string) => sourceTransactionIds.add(ptId));
      }

      const taxRate = normalizeTaxRate(inv.taxRate);
      let taxCents: number;
      let taxableSalesCents: number;

      // Prefer exact recorded taxAmountCents if present on invoice
      if (typeof inv.taxAmountCents === 'number' && inv.taxAmountCents > 0) {
        taxCents = basis === 'cash' && totalInvCents > 0 
          ? Math.round((salesCents / totalInvCents) * inv.taxAmountCents) 
          : inv.taxAmountCents;
        taxableSalesCents = inv.taxInclusive ? (salesCents - taxCents) : salesCents;
      } else if (taxRate > 0) {
        if (inv.taxInclusive) {
          taxCents = Math.round(salesCents - (salesCents / (1 + taxRate)));
          taxableSalesCents = salesCents - taxCents;
        } else {
          taxableSalesCents = salesCents;
          taxCents = Math.round(salesCents * taxRate);
        }
      } else {
        taxableSalesCents = salesCents;
        taxCents = 0;
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
