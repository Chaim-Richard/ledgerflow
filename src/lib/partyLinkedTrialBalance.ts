import type {ChartAccount,Transaction} from '../types';
import type {PartyPeriodInput} from './partyPeriodSummary';
import {computeTrialBalance} from '../server/reports/computeReports';
import {validCustomReportPeriod} from './reportCustomPeriod';
export function partyLinkedTrialBalance(kind:'customer'|'vendor',partyId:string,accounts:ChartAccount[],transactions:Transaction[],documents:PartyPeriodInput,asOfDate:string){
 if(!validCustomReportPeriod({startDate:asOfDate,endDate:asOfDate})||!(kind==='customer'?documents.customers:documents.vendors).some(party=>party.id===partyId))throw new Error('Choose an existing party and valid as-of date.');
 const invoiceIds=new Set(documents.invoices.filter(doc=>kind==='customer'&&doc.customerId===partyId).map(doc=>doc.id));
 const billIds=new Set(documents.bills.filter(doc=>kind==='vendor'&&doc.vendorId===partyId).map(doc=>doc.id));
 const paymentIds=new Set(documents.payments.filter(doc=>doc.contactId===partyId&&doc.direction===(kind==='customer'?'received':'made')).map(doc=>doc.id));
 const creditIds=new Set(documents.creditNotes.filter(doc=>kind==='customer'&&doc.customerId===partyId).map(doc=>doc.id));
 const vendorCreditIds=new Set(documents.vendorCredits.filter(doc=>kind==='vendor'&&doc.vendorId===partyId).map(doc=>doc.id));
 const linked=transactions.filter(tx=>{
  const m=tx.metadata||{};
  if((kind==='customer'?m.customerId:m.vendorId)===partyId)return true;
  if(m.contactId===partyId&&m.direction===(kind==='customer'?'received':'made'))return true;
  return (typeof m.invoiceId==='string'&&invoiceIds.has(m.invoiceId))||(typeof m.billId==='string'&&billIds.has(m.billId))||(typeof m.paymentId==='string'&&paymentIds.has(m.paymentId))||(typeof m.creditNoteId==='string'&&creditIds.has(m.creditNoteId))||(typeof m.vendorCreditId==='string'&&vendorCreditIds.has(m.vendorCreditId));
 });
 // Workspace account opening balances are not attributable to one party. Linked opening-document
 // postings remain in the sample. The existing trial-balance function supplies all money rules.
 return computeTrialBalance(accounts.map(account=>({...account,openingBalanceCents:0})),linked,asOfDate);
}
