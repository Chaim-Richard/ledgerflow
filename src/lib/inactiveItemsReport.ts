import type { InventoryItem, Invoice } from '../types';
import { INVOICE_IS_ISSUED } from '../server/reports/computeReports';
import { validCustomReportPeriod } from './reportCustomPeriod';
import { isOpeningBalanceDocument } from './partyOpeningBalance';
import { daysOverdue } from './aging';
export function inactiveItemsReport(items: InventoryItem[], invoices: Invoice[], asOfDate: string, days: number) {
  if (!validCustomReportPeriod({startDate:asOfDate,endDate:asOfDate})||!Number.isInteger(days)||days<1||days>36500) throw new Error('Choose a valid date and 1–36500 whole days.');
  const lastSale=new Map<string,string>(),unknown=new Set<string>();
  for(const invoice of invoices){
    if(!INVOICE_IS_ISSUED.has(invoice.status)||isOpeningBalanceDocument(invoice))continue;
    const date=(invoice.date||'').slice(0,10);
    const valid=validCustomReportPeriod({startDate:date,endDate:date});
    for(const line of invoice.items||[]){
      if(!line.itemId||!(line.quantity>0))continue;
      if(!valid){unknown.add(line.itemId);continue;}
      if(date>asOfDate)continue;
      if(date>(lastSale.get(line.itemId)||''))lastSale.set(line.itemId,date);
    }
  }
  return items.flatMap(item=>{
    const last=lastSale.get(item.id),elapsed=last?daysOverdue({dueDate:last},asOfDate):null;
    const uncertain=unknown.has(item.id);
    if(!uncertain&&elapsed!==null&&elapsed<days)return [];
    return [{id:item.id,name:item.name,sku:item.sku,lastSaleDate:last||null,daysSinceSale:elapsed,status:uncertain?'Unknown: issued invoice has no valid date':last?'Inactive':'No recorded sale'}];
  });
}
