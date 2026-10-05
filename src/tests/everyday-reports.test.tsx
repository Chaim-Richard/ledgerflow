import './helpers/dom';
import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {render,cleanup,screen,fireEvent} from '@testing-library/react';
import {partyPeriodSummary,type PartyPeriodInput} from '../lib/partyPeriodSummary';
import {salesTrends,purchaseTrendsByVendor} from '../lib/documentTrends';
import {partyLinkedTrialBalance} from '../lib/partyLinkedTrialBalance';
import {financialRatiosReport,defaultRatioGroups} from '../lib/financialRatiosReport';
import {paymentMethodSummary} from '../lib/paymentMethodSummary';
import {customerGrossProfit} from '../lib/customerGrossProfit';
import {inactiveItemsReport} from '../lib/inactiveItemsReport';
import type {InventoryItem} from '../types';
import {accountBalancesAsOf,paymentPeriodByInvoiceDate} from '../lib/everydayReports';
import {CustomerPeriodSummaryView} from '../components/reporting/PartyPeriodSummaryView';
import {useLedgerStore} from '../stores/useLedgerStore';
import {useAuthStore} from '../stores/useAuthStore';
import {useDataNeedsStore} from '../stores/useDataNeedsStore';
import {makeCustomer,makeVendor,makeInvoice,makeBill,makePayment,makeCreditNote,makeVendorCredit,makeChartAccount,makeTransaction} from './fixtures';
const ledger=useLedgerStore.getState(),auth=useAuthStore.getState(),needs=useDataNeedsStore.getState();
afterEach(()=>{cleanup();useLedgerStore.setState(ledger,true);useAuthStore.setState(auth,true);useDataNeedsStore.setState(needs,true);});
const empty:PartyPeriodInput={customers:[],vendors:[],invoices:[],bills:[],payments:[],creditNotes:[],vendorCredits:[]};
const period={startDate:'2024-02-29',endDate:'2024-03-31'};
test('customer period summary uses prior-day opening, FX, net refunds and inclusive boundaries',()=>{
 const input={...empty,customers:[makeCustomer({name:'לקוח A'})],invoices:[makeInvoice({id:'before',date:'2024-02-28',amountCents:10000}),makeInvoice({id:'in',date:'2024-02-29',amountCents:5000,exchangeRate:2}),makeInvoice({id:'draft',date:'2024-03-01',amountCents:999999,status:'draft'}),makeInvoice({id:'after',date:'2024-04-01',amountCents:777})],payments:[makePayment({date:'2024-03-31',amountCents:2000})],creditNotes:[makeCreditNote({date:'2024-03-31',amountCents:500,refundedCents:100})]};
 const [row]=partyPeriodSummary('customer',input,period);
 assert.deepEqual(row,{id:'cust-1',name:'לקוח A',openingCents:10000,invoicedCents:10000,paidCents:2000,creditedCents:400,closingCents:17600});
 assert.equal(row.openingCents+row.invoicedCents-row.paidCents-row.creditedCents,row.closingCents);
});
test('supplier period summary preserves overpayment credit balances and prior activity',()=>{
 const [row]=partyPeriodSummary('vendor',{...empty,vendors:[makeVendor()],bills:[makeBill({date:'2024-02-28',amountCents:1000}),makeBill({id:'current',date:'2024-02-29',amountCents:500})],payments:[makePayment({direction:'made',contactId:'vend-1',date:'2024-03-01',amountCents:2000})],vendorCredits:[makeVendorCredit({date:'2024-03-01',amountCents:100,refundedCents:20})]},period);
 assert.equal(row.openingCents,1000);assert.equal(row.invoicedCents,500);assert.equal(row.creditedCents,80);assert.equal(row.closingCents,-580);
});
test('invalid/reversed report dates refuse computation',()=>{
 assert.throws(()=>partyPeriodSummary('customer',empty,{startDate:'2024-02-30',endDate:'2024-03-01'}));
 assert.throws(()=>accountBalancesAsOf([],[],'2024-02-30'));
 assert.throws(()=>paymentPeriodByInvoiceDate([],{startDate:'2024-03-01',endDate:'2024-02-29'}));
});
test('as-of balances include opening and posted history but exclude drafts and later dates',()=>{
 const accounts=[makeChartAccount({openingBalanceCents:1000})];
 const transactions=[makeTransaction({date:'2024-02-28',lines:[{accountId:'acc-1',amountCents:200}]}),makeTransaction({date:'2024-02-29',lines:[{accountId:'acc-1',amountCents:-50}]}),makeTransaction({date:'2024-03-01',lines:[{accountId:'acc-1',amountCents:999}]}),makeTransaction({date:'2024-02-29',status:'draft',lines:[{accountId:'acc-1',amountCents:9000}]})];
 assert.equal(accountBalancesAsOf(accounts,transactions,'2024-02-29')[0].cents,1150);
});
test('payment periods select by invoice issue date and retain later settlements and exact civil days',()=>{
 const rows=paymentPeriodByInvoiceDate([makeInvoice({id:'paid',number:'חשבונית A',date:'2024-02-29',paymentDate:'2024-04-01',status:'paid',amountCents:1000}),makeInvoice({id:'older',date:'2024-02-28',paymentDate:'2024-03-01',status:'paid'}),makeInvoice({id:'partial',date:'2024-03-01',paymentDate:'2024-03-02',status:'partially_paid'}),makeInvoice({id:'missing',date:'2024-03-01',status:'paid'})],period);
 assert.equal(rows.length,1);assert.equal(rows[0].days,32);assert.equal(rows[0].cents,1000);assert.match(rows[0].label,/חשבונית A/);
});
test('summary screen scopes workspace, searches Hebrew without changing labels and blocks incomplete exports',()=>{
 useAuthStore.setState({isGuest:true,user:null,currentWorkspaceId:'ws-1'});
 useDataNeedsStore.setState({failed:{}});
 useLedgerStore.setState({...empty,customers:[makeCustomer({name:'לָקוֹח A'}),makeCustomer({id:'foreign',workspaceId:'ws-2',name:'Foreign'})],invoices:[makeInvoice({date:'2024-03-01',amountCents:1000})],truncatedCollections:{invoices:true}});
 render(<CustomerPeriodSummaryView {...period} compareStartDate="2024-01-01" compareEndDate="2024-01-31" />);
 assert.equal(screen.queryByText('Foreign'),null);
 fireEvent.change(screen.getByLabelText('Search party'),{target:{value:'לקוח'}});
 assert.ok(screen.getByRole('rowheader',{name:'לָקוֹח A'}));
 assert.equal((screen.getByRole('button',{name:'Export CSV'}) as HTMLButtonElement).disabled,true);
 assert.match(screen.getByRole('alert').textContent || '',/incomplete/);
 assert.ok(screen.getByRole('columnheader',{name:'Previous closing / change'}));
});

test('inactive items distinguish exact day boundary, no recorded sale, drafts, future and unknown dates',()=>{
 const items:InventoryItem[]=Array.from({length:4},(_,index)=>({id:`i${index}`,uid:'u',workspaceId:'ws-1',name:`פריט ${index}`,sku:`SKU${index}`,unitPriceCents:100,unitCostCents:50,quantityAtHand:1,reorderPoint:0,createdAt:'2024-01-01'}));
 const line=(itemId:string)=>({id:itemId,itemId,description:'Item',quantity:1,rateCents:100,amountCents:100,accountId:'income'});
 const invoices=[makeInvoice({date:'2024-02-28',items:[line('i0')]}),makeInvoice({date:'2024-02-29',items:[line('i1')]}),makeInvoice({status:'draft',date:'2024-03-01',items:[line('i2')]}),makeInvoice({date:'2024-04-01',items:[line('i2')]}),makeInvoice({date:undefined,items:[line('i3')]})];
 const rows=inactiveItemsReport(items,invoices,'2024-03-01',2);
 assert.equal(rows.find(row=>row.id==='i0')?.daysSinceSale,2);
 assert.equal(rows.some(row=>row.id==='i1'),false);
 assert.equal(rows.find(row=>row.id==='i2')?.status,'No recorded sale');
 assert.match(rows.find(row=>row.id==='i3')?.status||'',/Unknown/);
 assert.throws(()=>inactiveItemsReport(items,invoices,'2024-03-01',0));
});

test('customer gross profit delegates exact item amounts and preserves estimated costs and unknown parties',()=>{
 const line={id:'l1',itemId:'item',description:'Item',quantity:2,rateCents:500,amountCents:1000,unitCostCents:100,accountId:'revenue'};
 const rows=customerGrossProfit({customers:[makeCustomer({name:'לקוח A'})],invoices:[makeInvoice({id:'a',date:'2024-03-01',items:[line]}),makeInvoice({id:'draft',date:'2024-03-01',status:'draft',items:[line]}),makeInvoice({id:'other',customerId:'deleted',date:'2024-03-01',items:[{...line,id:'l2',amountCents:0,quantity:1}]})],items:[],transactions:[],accounts:[],startDate:'2024-03-01',endDate:'2024-03-31'});
 const row=rows.find(row=>row.id==='cust-1');assert.equal(row?.salesCents,1000);assert.equal(row?.costCents,200);assert.equal(row?.marginCents,800);assert.equal(row?.marginPct,80);assert.equal(row?.costIsEstimate,true);
 assert.equal(rows.find(row=>row.id==='deleted')?.marginPct,null);
 assert.match(rows.find(row=>row.id==='deleted')?.name||'',/Unknown customer/);
});

test('ratios reuse posted statements, show inclusive leap-month turnover and preserve explicit group selection',()=>{
 const accounts=[makeChartAccount({id:'cash',openingBalanceCents:1000}),makeChartAccount({id:'ar',category:'Receivables',openingBalanceCents:1000}),makeChartAccount({id:'inventory',category:'Inventory',openingBalanceCents:1000}),makeChartAccount({id:'ap',type:'liability',category:'Payables',openingBalanceCents:-1000}),makeChartAccount({id:'equity',type:'equity',category:'Equity',openingBalanceCents:-2000}),makeChartAccount({id:'rev',type:'income',category:'Revenue'}),makeChartAccount({id:'cogs',type:'cost_of_goods',category:'COGS'}),makeChartAccount({id:'exp',type:'expense',category:'Operations'})];
 const transactions=[makeTransaction({date:'2024-02-29',lines:[{accountId:'cash',amountCents:1000},{accountId:'rev',amountCents:-1000},{accountId:'cogs',amountCents:500},{accountId:'inventory',amountCents:-500},{accountId:'exp',amountCents:100},{accountId:'cash',amountCents:-100}]})];
 const rows=financialRatiosReport(accounts,transactions,{startDate:'2024-02-01',endDate:'2024-02-29'});const value=(id:string)=>rows.find(row=>row.id===id)?.value;
 assert.equal(value('current'),3.4);assert.equal(value('quick'),2.9);assert.equal(value('gross'),50);assert.equal(value('net'),40);assert.equal(value('dso'),29);assert.equal(value('dpo'),58);assert.ok(Math.abs((value('debt-equity')||0)-(1000/2400))<1e-12);
 const groups=defaultRatioGroups(accounts);groups.currentLiabilityIds=[];assert.equal(financialRatiosReport(accounts,transactions,{startDate:'2024-02-01',endDate:'2024-02-29'},groups)[0].value,null);
 assert.ok(financialRatiosReport([],[],period).every(row=>row.value===null));
});
test('payment-method summary preserves enum methods, FX, existing status rules and separately counts undated receipts',()=>{
 const payments=[makePayment({id:'a',method:'bank_transfer',contactName:'לקוח עברית',date:'2024-03-01',amountCents:1000,exchangeRate:2}),makePayment({id:'b',method:'bank_transfer',contactName:'לקוח עברית',date:undefined,amountCents:500}),makePayment({id:'draft',method:'bank_transfer',contactName:'לקוח עברית',date:'2024-03-01',amountCents:9000,status:'draft'}),makePayment({id:'out',direction:'made',method:'cash',date:'2024-03-01'}),makePayment({id:'late',method:'cash',date:'2024-04-01'})];
 assert.deepEqual(paymentMethodSummary([makeCustomer()],payments,period),[{id:'bank_transfer',name:'bank_transfer',count:2,cents:2500,undated:1}]);
});

test('sales and vendor trends keep twelve-month boundaries, partial end months, FX and unknown parties',()=>{
 const item={id:'l',itemId:'i',description:'Item',quantity:1,rateCents:100,amountCents:100,accountId:'revenue'};
 const input={customers:[makeCustomer({name:'לקוח A'})],invoices:[makeInvoice({id:'outside',date:'2023-03-31',items:[item]}),makeInvoice({id:'first',date:'2023-04-01',items:[item]}),makeInvoice({id:'current',date:'2024-03-15',items:[item],exchangeRate:2}),makeInvoice({id:'later',date:'2024-03-16',items:[item]})],items:[],transactions:[],accounts:[]};
 const rows=salesTrends(input,'2024-03-15','customer');assert.deepEqual(rows.map(row=>[row.month,row.cents]),[['2023-04',100],['2024-03',200]]);
 assert.equal(salesTrends(input,'2024-03-15','item')[1].cents,200);
 const purchases=purchaseTrendsByVendor([makeVendor()], [makeBill({id:'a',date:'2023-04-01',amountCents:500}),makeBill({id:'b',date:'2024-03-15',vendorId:'missing',amountCents:500,exchangeRate:2}),makeBill({id:'c',date:'2024-03-16',amountCents:500}),makeBill({id:'open',date:'2024-03-01',amountCents:8000,metadata:{type:'opening-balance'}})],'2024-03-15');
 assert.deepEqual(purchases.map(row=>row.cents),[500,1000]);assert.match(purchases[1].name,/Unknown vendor/);
});
test('party trial balance uses linked posted entries, excludes other parties, future/drafts and global opening balances',()=>{
 const accounts=[makeChartAccount({id:'ar',category:'Receivables',openingBalanceCents:999999}),makeChartAccount({id:'rev',type:'income',category:'Revenue'})];
 const sale=[{accountId:'ar',amountCents:1000},{accountId:'rev',amountCents:-1000}];
 const transactions=[makeTransaction({id:'direct',date:'2024-03-01',metadata:{customerId:'cust-1'},lines:sale}),makeTransaction({id:'doc',date:'2024-03-01',metadata:{invoiceId:'inv-1'},lines:sale}),makeTransaction({id:'foreign',date:'2024-03-01',metadata:{customerId:'other'},lines:sale}),makeTransaction({id:'later',date:'2024-04-01',metadata:{customerId:'cust-1'},lines:sale}),makeTransaction({id:'draft',date:'2024-03-01',status:'draft',metadata:{customerId:'cust-1'},lines:sale})];
 const report=partyLinkedTrialBalance('customer','cust-1',accounts,transactions,{...empty,customers:[makeCustomer()],invoices:[makeInvoice()]},'2024-03-31');
 assert.equal(report.totalDebit,2000);assert.equal(report.totalCredit,2000);assert.equal(report.isBalanced,true);assert.equal(report.accounts.find(row=>row.id==='ar')?.netSigned,2000);
 assert.throws(()=>partyLinkedTrialBalance('customer','missing',accounts,transactions,empty,'2024-03-31'));
});
