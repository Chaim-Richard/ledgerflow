import type {ChartAccount,Transaction} from '../types';
import {isPostable,lineAmount,isCashAccount} from './txFilters';
import {csvMoney,type CsvValue} from './csvExport';
import {parseCsv} from './csv';
import {validCustomReportPeriod,type CustomReportPeriod} from './reportCustomPeriod';
export type ExportKind='ledger'|'accounts'|'customers'|'vendors'|'bank';
export interface ExportTable {headers:string[];rows:CsvValue[][]}
/** Read-only view of the existing posting/FX helper: one row per posted line, including unknown accounts. */
export function ledgerExportTable(transactions:Transaction[],accounts:ChartAccount[],period:CustomReportPeriod,currency:string):ExportTable{
 if(!validCustomReportPeriod(period))throw new Error('Choose a valid period.');
 const names=new Map(accounts.map(account=>[account.id,account]));
 return {headers:['Date','Transaction ID','Line','Description','Reference','Account ID','Account Code','Account Name','Debit','Credit','Base Currency','Status','Line Description'],rows:transactions.filter(tx=>isPostable(tx)&&tx.date>=period.startDate&&tx.date.slice(0,10)<=period.endDate).flatMap(tx=>tx.lines.map((line,index)=>{
  const amount=lineAmount(line,tx),account=names.get(line.accountId);
  return [tx.date,tx.id,index+1,tx.description,tx.reference||'',line.accountId,account?.code||'',account?.name||line.accountName||'Unknown account',csvMoney(amount>0?amount:0),csvMoney(amount<0?-amount:0),currency,tx.status,line.description||''];
 }))};
}
/** Display columns remain spreadsheet-safe; Record JSON preserves types, whitespace and nested fields exactly. */
export function recordExportTable(records:object[]):ExportTable{
 const keys=[...new Set(records.flatMap(record=>Object.keys(record)))].sort();
 return {headers:[...keys,'Record JSON'],rows:records.map(record=>{
  const data=record as Record<string,unknown>;
  return [...keys.map(key=>{const value=data[key];return value===undefined?null:typeof value==='object'?JSON.stringify(value):String(value);}),JSON.stringify(record)];
 })};
}
/** File-level round trip only: does not bypass Settings Import Data's field allowlist or write records. */
export function readExportedRecords(csv:string):Record<string,unknown>[] {
 const [headers,...rows]=parseCsv(csv,','),column=headers?.indexOf('Record JSON')??-1;
 if(column<0)throw new Error('Missing Record JSON column.');
 return rows.map(row=>{const value:unknown=JSON.parse(row[column]);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid exported record.');return value as Record<string,unknown>;});
}
/** One bank-account line per exported entry, retaining repeated lines and stable source identity. */
export function bankExportLines(transactions:Transaction[],account:ChartAccount,period:CustomReportPeriod,baseCurrency:string):Transaction[]{
 if(!validCustomReportPeriod(period))throw new Error('Choose a valid period.');
 if(account.type!=='asset'||!isCashAccount(account))throw new Error('Choose a cash or bank asset account.');
 if((account.currency||baseCurrency).toUpperCase()!==baseCurrency.toUpperCase())throw new Error('Bank exports currently require an account in the workspace base currency.');
 return transactions.filter(tx=>isPostable(tx)&&tx.date>=period.startDate&&tx.date.slice(0,10)<=period.endDate).flatMap(tx=>tx.lines.flatMap((line,index)=>line.accountId===account.id?[{...tx,id:JSON.stringify([tx.id,index]),date:tx.date.slice(0,10),lines:[line]}]:[]));
}
export function generateQIF(transactions:Transaction[]):string{
 const text=(value:string)=>Array.from(value,char=>char.charCodeAt(0)<32?' ':char).join('');
 return '!Type:Bank\n'+transactions.map(tx=>{
  const [year,month,day]=tx.date.split('-');
  return `D${month}/${day}/${year}\nT${csvMoney(lineAmount(tx.lines[0],tx))}\nP${text(tx.payee||tx.description||'Transaction')}\nM${text(tx.description||'')}\nN${text(tx.id)}\n^`;
 }).join('\n')+'\n';
}
