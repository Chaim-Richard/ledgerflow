import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetMonthAmount, computeBudgetActual, type SavedBudget } from '../lib/budgetActual';
import { splitReportPeriods } from '../lib/reportColumns';
import type { ChartAccount, Transaction } from '../types';
const account: ChartAccount = { id: 'expense', uid: 'u', workspaceId: 'w', code: '6000', name: 'שכירות Rent', type: 'expense', balanceCents: 0, openingBalanceCents: 9900 };
const budget: SavedBudget = { id: 'b', uid: 'u', targetType: 'account', targetId: account.id, amountCents: 10001, period: 'quarterly', startDate: '2026-01-01', createdAt: '2026-01-01' };
function tx(id: string, date: string, amounts: number[], status: Transaction['status'] = 'completed', exchangeRate = 1): Transaction {
 return { id, date, status, type: 'actual', uid: 'u', workspaceId: 'w', description: id, totalAmountCents: 99999, currency: 'USD', exchangeRate, lines: amounts.map(amountCents => ({ accountId: account.id, amountCents })) };
}
test('quarter caps conserve cents and repeat; annual and dated monthly budgets retain their scope', () => {
 assert.deepEqual(['2026-01','2026-02','2026-03','2026-04'].map(m => budgetMonthAmount(budget,m)), [3333,3333,3335,3333]);
 assert.equal(budgetMonthAmount(budget,'2025-12'),0);
 assert.equal(budgetMonthAmount({...budget, period:'2026-02'},'2026-02'),10001);
 assert.equal(budgetMonthAmount({...budget, period:'2026-02'},'2026-03'),0);
 assert.equal(budgetMonthAmount({...budget, period:'2026'},'2027-01'),0);
 assert.equal(budgetMonthAmount({...budget, period:'2026', amountCents:12000},'2026-02'),1000);
 assert.equal(budgetMonthAmount({...budget, period:'unsupported'},'2026-02'),0);
});
test('actuals exclude openings and prior, draft, void and ghost activity; signed multi-lines and FX drill-down sum exactly', () => {
 const rows = [tx('prior','2025-12-31',[9000]),tx('rent','2026-01-05',[3000,500]),tx('credit','2026-01-31T23:59:59Z',[-500]),tx('fx','2026-02-12',[1000],'completed',2),tx('draft','2026-01-03',[10000],'draft'),tx('void','2026-01-03',[10000],'void'),tx('ghost-x','2026-01-03',[10000]),tx('later','2026-04-01',[9000])];
 const report = computeBudgetActual(budget,[account],rows,splitReportPeriods('2026-01-01','2026-03-31','months'))!;
 assert.deepEqual(report.columns.map(c=>[c.budgetCents,c.actualCents,c.differenceCents]),[[3333,3000,333],[3333,2000,1333],[3335,0,3335]]);
 assert.deepEqual(report.columns[0].drillTransactions.map(t=>[t.id,t.lines[0].amountCents]),[['rent',3500],['credit',-500]]);
 for (const column of report.columns) assert.equal(column.drillTransactions.reduce((s,t)=>s+t.lines[0].amountCents,0),column.actualCents);
 const total = computeBudgetActual(budget,[account],rows,splitReportPeriods('2026-01-01','2026-03-31','total'))!.columns[0];
 assert.equal(total.budgetCents,10001); assert.equal(total.actualCents,5000); assert.equal(total.percentUsed,5000/10001*100);
 assert.equal(rows[1].lines.length,2); assert.equal(rows[1].totalAmountCents,99999);
});
test('credit-normal income and zero budget, ambiguous labels and unsupported targets', () => {
 const income = {...account,type:'revenue' as const};
 const row = computeBudgetActual({...budget, amountCents:0},[income],[tx('sale','2026-01-01',[-5000])],splitReportPeriods('2026-01-01','2026-01-31','total'))!.columns[0];
 assert.equal(row.actualCents,5000); assert.equal(row.percentUsed,null);
 assert.equal(computeBudgetActual({...budget,targetId:account.name},[account,{...account,id:'other'}],[],[]),null);
 assert.equal(computeBudgetActual({...budget,targetType:'project'},[account],[],[]),null);
});
