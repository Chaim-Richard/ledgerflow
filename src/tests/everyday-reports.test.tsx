import './helpers/dom';
import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {render,cleanup,screen,fireEvent} from '@testing-library/react';
import {partyPeriodSummary,type PartyPeriodInput} from '../lib/partyPeriodSummary';
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
