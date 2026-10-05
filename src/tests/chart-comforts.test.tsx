import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import AlgorithmChart from '../components/charts/AlgorithmChart';
import ChartFrame, { ChartTooltip } from '../components/charts/ChartFrame';
import { expenseChartLeaves, invoicePaymentPoints } from '../lib/chartExploration';
import { makeInvoice, makeChartAccount, makeTransaction } from './fixtures';
globalThis.ResizeObserver = window.ResizeObserver;
afterEach(cleanup);
test('shared chart table, legend and date brush retain exact values and Hebrew labels', () => {
 render(<ChartFrame title="Test chart" time rows={[{id:'a',label:'2024-01',cents:1200},{id:'b',label:'2024-02',cents:2500}]} series={[{key:'cents',name:'הוצאות Expenses'}]} currency="USD">{({rows}) => <p>{rows.length} plotted</p>}</ChartFrame>);
 fireEvent.click(screen.getByRole('button',{name:/^Table$/})); assert.match(screen.getByRole('table').textContent || '', /\$12.00/);
 fireEvent.change(screen.getByLabelText('Test chart brush start'),{target:{value:1}}); assert.doesNotMatch(screen.getByRole('table').textContent || '', /2024-01/);
 fireEvent.click(screen.getByRole('button',{name:'הוצאות Expenses'})); assert.ok(screen.getByRole('status'));
 fireEvent.click(screen.getByRole('button',{name:'הוצאות Expenses'})); fireEvent.click(screen.getByRole('button',{name:'Reset zoom'})); assert.match(screen.getByRole('table').textContent || '', /2024-01/);
});
test('payment scatter uses recorded paid dates, FX and civil-day differences, excluding incomplete payments', () => {
 const points=invoicePaymentPoints([makeInvoice({id:'yes',date:'2024-02-28',paymentDate:'2024-03-01',status:'paid',amountCents:500,exchangeRate:2}),makeInvoice({id:'partial',date:'2024-02-28',paymentDate:'2024-03-01',status:'partially_paid'}),makeInvoice({id:'missing',date:'2024-02-28',status:'paid'}),makeInvoice({id:'bad',date:'2024-03-01',paymentDate:'2024-02-28',status:'paid'})]);
 assert.equal(points.length,1); assert.equal(points[0].days,2); assert.equal(points[0].cents,1000);
});
test('expense hierarchy preserves signed posted amounts, account IDs and finite cycle paths', () => {
 const accounts=[makeChartAccount({id:'parent',name:'קבוצה',type:'expense',category:'Costs',parentId:'child'}),makeChartAccount({id:'child',name:'ספק',type:'expense',category:'Costs',parentId:'parent'})];
 const tx=[makeTransaction({lines:[{accountId:'child',amountCents:1200}]}),makeTransaction({status:'draft',lines:[{accountId:'child',amountCents:9000}]})];
 const leaves=expenseChartLeaves(accounts,tx,'2026-01-01','2026-01-31'); assert.equal(leaves.find(row=>row.id==='child')?.cents,1200); assert.deepEqual(leaves.find(row=>row.id==='child')?.path,['Costs','קבוצה [parent]']);
});
test('scatter tooltip distinguishes days from currency', () => {
 render(<ChartTooltip active currency="USD" payload={[{name:'Days',dataKey:'days',value:2},{name:'Invoice amount',dataKey:'cents',value:1000}]} />); assert.match(document.body.textContent || '', /Days: 2 days/); assert.match(document.body.textContent || '', /Invoice amount: \$10.00/);
});

test('algorithm tooltip preserves native numbers and missing values rather than converting to cents', () => {
 render(<ChartTooltip active series={[{key:'score',name:'Score',unit:'number'}]} payload={[{name:'Score',dataKey:'score',value:123.45}]} />);
 assert.match(document.body.textContent || '', /123.45/);
 assert.doesNotMatch(document.body.textContent || '', /\$/);
});

test('algorithm tables keep duplicate Hebrew categories and native values; legend hides a column', () => {
 render(<AlgorithmChart chart={{data:[{category:'ספק A', score:123.45},{category:'ספק A',score:99}],config:{xKey:'category',yKeys:[{key:'score',name:'Score',color:'#123456'}]}}} />);
 fireEvent.click(screen.getByRole('button',{name:'Table'}));
 assert.match(screen.getByRole('table').textContent || '', /123.45/);
 assert.equal(screen.getAllByRole('rowheader',{name:'ספק A'}).length,2);
 fireEvent.click(screen.getByRole('button',{name:'Score'}));
 assert.ok(screen.getByRole('status'));
});
