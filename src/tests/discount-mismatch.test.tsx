import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { discountMismatches } from '../lib/discountMismatch';
import DiscountMismatchView from '../components/reporting/DiscountMismatchView';
import { makeInvoice } from './fixtures';
import type { InventoryItem } from '../types';
import { getSupabase } from '../lib/db/client';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { setComponentWorkspace, markComponentCollectionsLoaded } from './helpers/componentFixtures';
const item: InventoryItem = { id:'כיסא',uid:'test-user',workspaceId:'ws-1',name:'כיסא Chair',sku:'C1',unitPriceCents:2250,unitCostCents:1000,quantityAtHand:5,reorderPoint:0,createdAt:'2024-01-01' };
const invoice=makeInvoice({date:'2024-02-29',customerName:'לקוח Customer',items:[{id:'line-1',itemId:item.id,description:item.name,quantity:2,rateCents:1950,amountCents:3900,accountId:'sales'}]});
const input={invoices:[invoice],items:[item],lists:[{id:'pl_wholesale',name:'Wholesale',discountPercent:10,customerIds:['cust-1']}],workspaceId:'ws-1',currency:'USD',startDate:'2024-02-01',endDate:'2024-02-29'};
const realFetch=globalThis.fetch;
afterEach(async()=>{cleanup();globalThis.fetch=realFetch;getSupabase().realtime.disconnect();await getSupabase().auth.dispose();});
test('current list discount and explicit item price use the existing helper, with exact per-unit differences',()=>{
  const result=discountMismatches(input);
  assert.equal(result.rows[0].expectedCents,2025); assert.equal(result.rows[0].differenceCents,-75); assert.equal(result.rows[0].item,'כיסא Chair');
  const overridden=discountMismatches({...input,lists:[{...input.lists[0],prices:{[item.id]:1250}}]});
  assert.equal(overridden.rows[0].expectedCents,1250); assert.equal(overridden.rows[0].differenceCents,700);
  const catalog=discountMismatches({...input,lists:[]}); assert.equal(catalog.rows[0].differenceCents,-300); assert.equal(catalog.rows[0].source,'Current item price');
  assert.deepEqual(discountMismatches({...input,invoices:[{...invoice,items:invoice.items!.map(line=>({...line,rateCents:2025}))}]}).rows,[]);
});
test('workspace, inclusive date, issued state, currency and missing item boundaries do not manufacture comparisons',()=>{
  const result=discountMismatches({...input,invoices:[invoice,{...invoice,id:'draft',status:'draft'},{...invoice,id:'void',status:'void'},{...invoice,id:'outside',date:'2024-03-01'},{...invoice,id:'foreign',currency:'EUR'},{...invoice,id:'wrong-workspace',workspaceId:'other'},{...invoice,id:'missing',items:invoice.items!.map(line=>({...line,itemId:'unknown'}))}]});
  assert.equal(result.rows.length,1); assert.equal(result.uncomparableLines,2);
  assert.throws(()=>discountMismatches({...input,endDate:'2024-02-30'}),/valid report period/);
  assert.throws(()=>discountMismatches({...input,lists:[{...input.lists[0],discountPercent:120}]}),/discount/);
});
function setup(){const workspace=setComponentWorkspace();markComponentCollectionsLoaded('invoices','inventory');const savedInvoice={...invoice,workspaceId:workspace.id},savedItem={...item,workspaceId:workspace.id};useLedgerStore.setState({invoices:[savedInvoice],inventory:[savedItem]});useAuthStore.setState({workspaces:[{...workspace,priceLists:input.lists}]});return{savedInvoice,savedItem,workspace};}
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('preview is provisional; refused full reads disable export, retry uses scoped authoritative rows',async()=>{
  const {savedInvoice,savedItem}=setup();let refuse=true;const requested:string[]=[];
  globalThis.fetch=(async url=>{requested.push(String(url));return refuse?response({message:'Refused'},403):response(String(url).includes('/invoices?')?[{id:savedInvoice.id,data:savedInvoice}]:[{id:savedItem.id,data:savedItem}]);}) as typeof fetch;
  const view=render(<DiscountMismatchView startDate="2024-02-01" endDate="2024-02-29" />);
  assert.match(view.getByRole('status').textContent!,/provisional/); assert.equal((view.getByRole('button',{name:'Export CSV'}) as HTMLButtonElement).disabled,true);
  await act(async()=>{fireEvent.click(view.getByRole('button',{name:'Refresh complete history'}));});
  await waitFor(()=>assert.match(view.getByRole('alert').textContent!,/Could not refresh/));
  assert.equal((view.getByRole('button',{name:'Export CSV'}) as HTMLButtonElement).disabled,true);
  refuse=false;await act(async()=>{fireEvent.click(view.getByRole('button',{name:'Refresh complete history'}));});
  assert.equal(view.queryByRole('alert'),null); assert.equal((view.getByRole('button',{name:'Export CSV'}) as HTMLButtonElement).disabled,false);
  assert.match(view.getByRole('table').textContent!,/כיסא Chair/);assert.ok(requested.every(url=>url.includes('component-workspace')));
});
test('switching workspace removes old preview and prevents an obsolete refresh result',async()=>{
  const {savedInvoice,savedItem,workspace}=setup();const releases:Array<(value:Response)=>void>=[];
  globalThis.fetch=(async()=>new Promise<Response>(resolve=>releases.push(resolve))) as typeof fetch;
  const view=render(<DiscountMismatchView startDate="2024-02-01" endDate="2024-02-29" />);
  fireEvent.click(view.getByRole('button',{name:'Refresh complete history'}));await waitFor(()=>assert.equal(releases.length,2));
  await act(async()=>useAuthStore.setState({currentWorkspaceId:'new',workspaces:[{...workspace,id:'new'}]}));
  await act(async()=>{releases[0](response([{id:savedInvoice.id,data:savedInvoice}]));releases[1](response([{id:savedItem.id,data:savedItem}]));});
  assert.doesNotMatch(view.getByRole('table').textContent!,/כיסא Chair/);
  assert.equal((view.getByRole('button',{name:'Export CSV'}) as HTMLButtonElement).disabled,true);
});
