/**
 * E-13: local Israeli identity/company-number format warnings only.
 * Read-only; does not query a registry, collect a taxpayer ID or block saving.
 * Claude owns the customer/vendor PartyModal wiring.
 */
export { checkIsraeliIdentifier, israeliIdentifierWarning } from './tax/israeliIdentifiers';
 * E-12: pure Israeli document-title classification for explicitly issued,
 * reviewed documents only. Not wired to issuance, numbering, VAT posting,
 * allocations or tax returns until Claude supplies the issuance evidence.
 */
export { classifyIsraeliDocument, israeliDocumentTitle } from './tax/israeliDocumentTypes';

/**
 * PLAN §10: the rule graph (facts from every dimension, dated rules that accumulate, override or exclude, evidence).
 * Reachable here until the tax resolution and the Facts screen use it.
 */
export { composeFacts } from './rules/facts';
export { evaluateRules } from './rules/rules';
export { factSources } from './rules/fromTaxProfiles';
/**
 * PLAN §6: tax code suggestions that learn from history, and unusual-code flags. Reachable here until AI #2's C-46 panel uses them.
 */
export { suggestTaxCode, unusualTaxCode } from './tax/taxSuggestions';
/**
 * PLAN IL-3: Israel's VAT report figures per registration. Reachable here until AI #2's C-40 screen uses them.
 */
export { israelVatReturn } from './tax/ilVatReturn';
/**
 * E-9: opt-in historical fixture formatter, deliberately NOT a filing workflow.
 * Re-export from an application-reachable, read-only exports module so the
 * repository's import/reachability guards can verify the draft stays connected.
 * No production download or tax submission action uses this formatter.
 */
export { buildPcn874FixtureDraft as buildHistoricalPcn874Draft } from './tax/pcn874Draft';
/**
 * E-10: historical/year-specific US 1099 review helpers, intentionally not IRIS,
 * printable IRS form output, or an automatic tax filing workflow.
 * The existing workspace export path reaches this pure preview utility, while
 * users must still obtain complete verified payment / W-9 data before filing.
 */
export { build1099Preview, threshold1099Cents, us1099ReviewCsvRows } from './tax/us1099Preview';
/**
 * E-11: read-only state/local rate table staging helpers, not a tax calculator.
 * Exposed from an application-reachable export module for preview/integration
 * review only. Each result explicitly carries readyForTaxCalculation: false.
 * No live tax lookup, posting, or database update uses these functions.
 */
export {
  parseStateLocalRateRows,
  parseTexasLocalRates,
  parseCaliforniaLocalRates,
  parseNewYorkLocalRates,
  parseWashingtonLocalRates,
  parseColoradoLocalRates,
} from './tax/stateLocalRateImporters';

import type {ChartAccount,Transaction} from '../types';
import {isPostable,lineAmount,isCashAccount} from './txFilters';
import {csvMoney,type CsvValue} from './csvExport';
import {parseCsv} from './csv';
import {validCustomReportPeriod,type CustomReportPeriod} from './reportCustomPeriod';
import {balancesAsOf} from './closingSnapshot';
export type ExportKind='ledger'|'accounts'|'customers'|'vendors'|'bank'|'trial-balance';
export type TrialBalanceLayout='debit-credit'|'balance';
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
/**
 * BD-05: the trial balance on a date, in the shape tax software imports (account number, name,
 * type, the tax line the account is mapped to, then debit/credit columns or one balance column with
 * debits positive). One row per account that is not at zero, by account number; no totals row
 * (importers read it as an account). Balances follow the closing-snapshot rule: opening balance
 * plus every counted line up to the date. Lines on a removed account are kept, named as such.
 */
export function trialBalanceExportTable(transactions:Transaction[],accounts:ChartAccount[],asOfDate:string,layout:TrialBalanceLayout):ExportTable&{debitCents:number;creditCents:number}{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate))throw new Error('Choose the date of the trial balance.');
 const {balances}=balancesAsOf(accounts,transactions,asOfDate);
 const byId=new Map(accounts.map(account=>[account.id,account]));
 const lines=Object.entries(balances).map(([id,cents])=>{
  const account=byId.get(id);
  return {code:account?.code||'',name:account?.name||`Unknown account (${id})`,type:account?.type||'',taxLine:account?.taxCategory||'',cents};
 }).sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})||a.name.localeCompare(b.name));
 const debitCents=lines.reduce((sum,line)=>sum+(line.cents>0?line.cents:0),0);
 const creditCents=lines.reduce((sum,line)=>sum+(line.cents<0?-line.cents:0),0);
 const head=['Account Number','Account Name','Account Type','Tax Line'];
 return layout==='balance'
  ?{headers:[...head,'Balance'],rows:lines.map(line=>[line.code,line.name,line.type,line.taxLine,csvMoney(line.cents)]),debitCents,creditCents}
  :{headers:[...head,'Debit','Credit'],rows:lines.map(line=>[line.code,line.name,line.type,line.taxLine,csvMoney(line.cents>0?line.cents:0),csvMoney(line.cents<0?-line.cents:0)]),debitCents,creditCents};
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
