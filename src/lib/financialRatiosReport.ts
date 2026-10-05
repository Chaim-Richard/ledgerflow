import type {ChartAccount,Transaction} from '../types';
import {computeBalanceSheet,computeProfitAndLoss} from '../server/reports/computeReports';
import {TruthEngine} from '../modules/integrity/TruthEngine';
import {resolveAccountRole} from './accountUtils';
import {validCustomReportPeriod,type CustomReportPeriod} from './reportCustomPeriod';
import {addDaysYMD} from './fiscalCalendar';
import {daysOverdue} from './aging';
export interface RatioGroups {currentAssetIds:string[];currentLiabilityIds:string[]}
export function defaultRatioGroups(accounts:ChartAccount[]):RatioGroups {
 return {currentAssetIds:accounts.filter(account=>account.type==='asset'&&['Cash','Receivables','Inventory'].includes(account.category||'')).map(account=>account.id),currentLiabilityIds:accounts.filter(account=>account.type==='liability'&&['Payables','Tax'].includes(account.category||'')).map(account=>account.id)};
}
export function financialRatiosReport(accounts:ChartAccount[],transactions:Transaction[],period:CustomReportPeriod,groups:RatioGroups=defaultRatioGroups(accounts)){
 if(!validCustomReportPeriod(period))throw new Error('Choose a valid report period.');
 const closing=computeBalanceSheet(accounts,transactions,period.endDate),opening=computeBalanceSheet(accounts,transactions,addDaysYMD(period.startDate,-1));
 const pl=computeProfitAndLoss(accounts,transactions,period.startDate,period.endDate);
 const sum=(values:Record<string,number>,ids:string[])=>[...new Set(ids)].reduce((total,id)=>total+(values[id]??0),0);
 const assetIds=groups.currentAssetIds.filter(id=>accounts.some(account=>account.id===id&&account.type==='asset'));
 const liabilityIds=groups.currentLiabilityIds.filter(id=>accounts.some(account=>account.id===id&&account.type==='liability'));
 const currentAssets=sum(closing.assets,assetIds),currentLiabilities=sum(closing.liabilities,liabilityIds);
 const inventory=sum(closing.assets,assetIds.filter(id=>resolveAccountRole(accounts.find(account=>account.id===id))==='inventory'));
 const arIds=accounts.filter(account=>resolveAccountRole(account)==='ar').map(account=>account.id),apIds=accounts.filter(account=>resolveAccountRole(account)==='ap').map(account=>account.id);
 const averageAr=(sum(opening.assets,arIds)+sum(closing.assets,arIds))/2,averageAp=(sum(opening.liabilities,apIds)+sum(closing.liabilities,apIds))/2;
 const days=daysOverdue({dueDate:period.startDate},period.endDate)+1,equity=closing.totalEquity+closing.netIncome;
 return [
  {id:'current',name:'Current ratio',formula:'Selected current assets ÷ selected current liabilities',value:currentLiabilities===0?null:TruthEngine.calculateCurrentRatio(currentAssets,currentLiabilities),unit:'times'},
  {id:'quick',name:'Quick ratio',formula:'(Selected current assets − included inventory) ÷ selected current liabilities',value:currentLiabilities===0?null:TruthEngine.calculateQuickRatio(currentAssets,inventory,currentLiabilities),unit:'times'},
  {id:'debt-equity',name:'Debt-to-equity',formula:'Total liabilities ÷ (equity accounts + cumulative net income)',value:equity===0?null:TruthEngine.calculateDebtToEquityRatio(closing.totalLiabilities,equity),unit:'times'},
  {id:'gross',name:'Gross margin',formula:'(Revenue − COGS) ÷ revenue × 100',value:pl.income.total===0?null:TruthEngine.calculateGrossProfitMargin(pl.income.total,pl.cogs.total),unit:'%'},
  {id:'net',name:'Net margin',formula:'(Revenue − COGS − expenses) ÷ revenue × 100',value:pl.income.total===0?null:TruthEngine.calculateGrossProfitMargin(pl.income.total,pl.cogs.total+pl.expense.total),unit:'%'},
  {id:'dso',name:'Days sales outstanding (revenue proxy)',formula:`Average opening/closing receivables ÷ period revenue × ${days} inclusive days`,value:pl.income.total===0?null:TruthEngine.calculateDSO(averageAr,pl.income.total,days),unit:'days'},
  // The existing DSO primitive implements balance / turnover * days; AP/COGS uses the same arithmetic.
  {id:'dpo',name:'Days payables outstanding (COGS proxy)',formula:`Average opening/closing payables ÷ period COGS × ${days} inclusive days`,value:pl.cogs.total===0?null:TruthEngine.calculateDSO(averageAp,pl.cogs.total,days),unit:'days'},
 ];
}
