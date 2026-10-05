import type { Customer } from '../types';
import { computeSalesByItem, type SalesByItemInput } from '../server/reports/itemReports';
/** Group the existing item-margin calculation by invoice customer, retaining cost provenance. */
export function customerGrossProfit(input: SalesByItemInput & {customers:Customer[]}) {
  const ids=new Set(input.invoices.map(invoice=>invoice.customerId||''));
  const names=new Map(input.customers.map(customer=>[customer.id,customer.name]));
  return [...ids].map(id=>{
    const report=computeSalesByItem({...input,invoices:input.invoices.filter(invoice=>(invoice.customerId||'')===id)});
    return {id,name:names.get(id)||(id?`Unknown customer (${id})`:'No customer'),...report.totals};
  }).filter(row=>row.salesCents!==0||row.costCents!==0||row.quantity!==0);
}
