import type { ChartAccount, Transaction, Invoice } from '../types';
import { computeGeneralLedger } from '../server/reports/computeReports';
import { invoicePaymentPoints } from './chartExploration';
import { validCustomReportPeriod, type CustomReportPeriod } from './reportCustomPeriod';
export function accountBalancesAsOf(accounts: ChartAccount[], transactions: Transaction[], asOfDate: string) {
  if (!validCustomReportPeriod({startDate:asOfDate,endDate:asOfDate})) throw new Error('Choose a valid as-of date.');
  return computeGeneralLedger(accounts,transactions,'1900-01-01',asOfDate).accounts.map(row=>({id:row.accountId,code:row.accountCode,name:row.accountName,type:row.type,cents:row.endingBalanceCents}));
}
export function paymentPeriodByInvoiceDate(invoices: Invoice[], period: CustomReportPeriod) {
  if (!validCustomReportPeriod(period)) throw new Error('Choose a valid report period.');
  return invoicePaymentPoints(invoices.filter(invoice=>(invoice.date||'')>=period.startDate&&(invoice.date||'').slice(0,10)<=period.endDate));
}
