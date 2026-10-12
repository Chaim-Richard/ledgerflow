import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { accountIcicleTree, brushIndex, monthBrushPeriod } from '../lib/chartDrillShapes';
import AccountIcicle from '../components/charts/AccountIcicle';
import ChartFrame from '../components/charts/ChartFrame';
import AccountBalanceChart from '../components/charts/AccountBalanceChart';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { makeChartAccount } from './fixtures';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';

const originalFetch = globalThis.fetch;
afterEach(async () => { cleanup(); globalThis.fetch = originalFetch; await getSupabase().auth.dispose(); });
const members = [
  { id: 'root', name: 'קבוצה / Group', type: 'asset', netSigned: 400 },
  { id: 'a', name: 'חנות A', type: 'asset', parentId: 'root', netSigned: 1200 },
  { id: 'b', name: 'חנות B', type: 'asset', parentId: 'root', netSigned: -200 },
  { id: 'zero', name: 'Zero', type: 'asset', netSigned: 0 },
];
test('account layout keeps direct parent balances once, signed shares and zero accounts', () => {
  const tree = accountIcicleTree(members);
  const group = tree.children.find(node => node.label === members[0].name)!;
  assert.equal(tree.cents, 1400);
  assert.equal(group.cents, 1400);
  assert.equal(group.weight, 1800);
  assert.deepEqual(group.children.map(node => node.cents).sort((a,b) => a-b), [-200,400,1200]);
  assert.equal(tree.children.find(node => node.label === 'Zero')?.cents, 0);
  assert.equal(group.children.find(node => node.label === 'חנות A')!.cents / group.cents, 6/7);
});
test('missing parents and loops retain every balance with distinct identities', () => {
  const tree = accountIcicleTree([
    { id: 'x', name: 'Duplicate', type: 'asset', parentId: 'y', netSigned: 100 },
    { id: 'y', name: 'Duplicate', type: 'asset', parentId: 'x', netSigned: 200 },
    { id: 'z', name: 'Duplicate', type: 'asset', parentId: 'gone', netSigned: 300 },
  ]);
  assert.equal(tree.cents, 600);
  const ids = new Set<string>();
  const visit = (node: typeof tree) => { assert.ok(!ids.has(node.id)); ids.add(node.id); node.children.forEach(visit); };
  visit(tree);
  assert.ok(ids.has(JSON.stringify(['account','x'])));
  assert.ok(ids.has(JSON.stringify(['account','y'])));
  assert.ok(ids.has(JSON.stringify(['account','z'])));
  const mixed=accountIcicleTree([{id:'asset',name:'Asset',type:'asset',netSigned:100},{id:'income',name:'Income',type:'income',parentId:'asset',netSigned:200}]);
  assert.equal(mixed.children.length,2);
  assert.equal(mixed.cents,300);
});
test('month brush carries exact leap/month boundaries and rejects invalid selections', () => {
  assert.deepEqual(monthBrushPeriod(['2024-01','2024-02','2024-04'],1,1), {startDate:'2024-02-01',endDate:'2024-02-29'});
  assert.deepEqual(monthBrushPeriod(['2024-01','2024-02','2024-04'],1,2), {startDate:'2024-02-01',endDate:'2024-04-30'});
  assert.equal(monthBrushPeriod(['2024-13'],0,0),undefined);
  assert.equal(monthBrushPeriod(['2024-01'],1,0),undefined);
  assert.equal(monthBrushPeriod([],0,0),undefined);
  assert.equal(monthBrushPeriod(['2024-01'],0.5,0.5),undefined);
  assert.equal(brushIndex(150,100,100,5),2);
  assert.equal(brushIndex(-20,100,100,5),0);
  assert.equal(brushIndex(400,100,100,5),4);
  assert.equal(brushIndex(50,0,0,5),0);
});
test('icicle zoom, signed table and zero-total shares remain keyboard reachable', () => {
  render(<AccountIcicle members={members} currency="EUR" />);
  const blocks = within(screen.getByRole('region',{name:'Account icicle blocks'}));
  fireEvent.click(blocks.getByRole('button',{name:/קבוצה \/ Group:.*zoom in/}));
  assert.equal(within(screen.getByRole('navigation',{name:'Account chart zoom'})).getAllByRole('button').length,2);
  fireEvent.focus(blocks.getByRole('button',{name:/חנות B:/}));
  assert.match(screen.getByRole('tooltip').textContent || '', /2\.00/);
  fireEvent.click(screen.getByRole('button',{name:'All accounts'}));
  assert.equal(within(screen.getByRole('navigation',{name:'Account chart zoom'})).getAllByRole('button').length,1);
  fireEvent.click(screen.getByText('Account balances table'));
  assert.match(screen.getByRole('table').textContent || '', /85\.7%/);
  assert.match(screen.getByRole('table').textContent || '', /-14\.3%/);
  cleanup();
  render(<AccountIcicle members={[{id:'zero',name:'Zero',type:'asset',netSigned:0}]} />);
  assert.match(screen.getByRole('status').textContent || '', /No non-zero/);
  fireEvent.click(screen.getByText('Account balances table'));
  assert.match(screen.getByRole('table').textContent || '', /—/);
});
test('keyboard sliders notify the report range while legacy table and legend controls still work', () => {
  setComponentWorkspace();
  const ranges: [number,number][]=[];
  render(<ChartFrame title="Period chart" time rows={[{id:'a',label:'2024-01',cents:100},{id:'b',label:'2024-02',cents:-200}]} series={[{key:'cents',name:'Value'}]} onRangeChange={range=>ranges.push(range)}>{({rows})=><p>{rows.length} plotted</p>}</ChartFrame>);
  assert.ok(screen.getByRole('group',{name:'Period chart drag brush'}));
  fireEvent.change(screen.getByLabelText('Period chart brush start'),{target:{value:1}});
  assert.deepEqual(ranges,[[1,1]]);
  fireEvent.click(screen.getByRole('button',{name:'Table'}));
  assert.doesNotMatch(screen.getByRole('table').textContent || '',/2024-01/);
  fireEvent.click(screen.getByRole('button',{name:'Reset zoom'}));
  assert.deepEqual(ranges,[[1,1],[0,1]]);
  assert.match(screen.getByRole('table').textContent || '',/2024-01/);
});

test('resetting a controlled report range restores every month and retains the legend choice', () => {
  setComponentWorkspace();
  const rows=[{id:'a',label:'2024-01',cents:100,other:2},{id:'b',label:'2024-02',cents:-200,other:3}];
  const series=[{key:'cents',name:'Value'},{key:'other',name:'Other',unit:'number' as const}];
  const view=render(<ChartFrame title="Controlled" rows={rows} series={series} selectionRange={[1,1]} onRangeChange={()=>{}}>{()=>null}</ChartFrame>);
  fireEvent.click(screen.getByRole('button',{name:'Table'}));
  fireEvent.click(screen.getByRole('button',{name:'Other'}));
  assert.doesNotMatch(screen.getByRole('table').textContent || '',/2024-01/);
  view.rerender(<ChartFrame title="Controlled" rows={rows} series={series} selectionRange={null} onRangeChange={()=>{}}>{()=>null}</ChartFrame>);
  assert.match(screen.getByRole('table').textContent || '',/2024-01/);
  assert.match(screen.getByRole('table').textContent || '',/2024-02/);
  assert.equal(screen.getByRole('button',{name:'Other'}).getAttribute('aria-pressed'),'false');
});

test('legacy reset zoom continues to include later streamed rows', () => {
  setComponentWorkspace();
  const first=[{id:'a',label:'2024-01',cents:100},{id:'b',label:'2024-02',cents:200}];
  const series=[{key:'cents',name:'Value'}];
  const view=render(<ChartFrame title="Stream" time rows={first} series={series}>{()=>null}</ChartFrame>);
  fireEvent.click(screen.getByRole('button',{name:'Table'}));
  fireEvent.change(screen.getByLabelText('Stream brush start'),{target:{value:1}});
  fireEvent.click(screen.getByRole('button',{name:'Reset zoom'}));
  view.rerender(<ChartFrame title="Stream" time rows={[...first,{id:'c',label:'2024-03',cents:300}]} series={series}>{()=>null}</ChartFrame>);
  assert.match(screen.getByRole('table').textContent || '',/2024-03/);
});

test('live account balances withhold cached amounts on refusal and retry with full report figures', async () => {
  setComponentWorkspace();
  useLedgerStore.setState({accounts:[makeChartAccount({id:'private-cache',name:'PRIVATE_CACHED_AMOUNT',workspaceId:'component-workspace',openingBalanceCents:999999})],transactions:[]});
  let refused=true;
  const calls:string[]=[];
  const metadata=[makeChartAccount({id:'parent',name:'Parent',workspaceId:'component-workspace'}),makeChartAccount({id:'child',name:'Server child',workspaceId:'component-workspace',parentId:'parent'})];
  globalThis.fetch=async input => {
    const url=String(input);calls.push(url);
    if (url.includes('trial-balance')) return new Response(JSON.stringify(refused?{}:{accounts:[{id:'parent',name:'Parent',type:'asset',debit:0,credit:0,netSigned:0},{id:'child',name:'Server child',type:'asset',debit:12345,credit:0,netSigned:12345}],totalDebit:12345,totalCredit:0,isBalanced:false}),{status:refused?403:200});
    return new Response(JSON.stringify(metadata.map(account=>({id:account.id,data:account}))),{status:200});
  };
  render(<AccountBalanceChart endDate="2024-02-29" currency="EUR" />);
  await waitFor(()=>assert.ok(screen.getByText(/Account balances unavailable:/)));
  assert.equal(screen.queryByRole('button',{name:/Server child:/}),null);
  assert.doesNotMatch(document.body.textContent || '',/PRIVATE_CACHED_AMOUNT/);
  refused=false;
  fireEvent.click(screen.getByRole('button',{name:'Refresh account balances'}));
  await waitFor(()=>assert.ok(screen.getByRole('button',{name:/Server child:.*123\.45/})));
  assert.ok(calls.some(url=>url.includes('workspaceId=component-workspace')&&url.includes('asOfDate=2024-02-29')));
  assert.ok(calls.some(url=>url.includes('chartAccounts')&&decodeURIComponent(url).includes('component-workspace')));
  assert.equal(screen.queryByText(/Account balances unavailable:/),null);
});

test('an obsolete workspace report cannot populate the new account chart', async () => {
  const workspace=setComponentWorkspace();
  useLedgerStore.setState({accounts:[],transactions:[]});
  let finishOld: ((value:Response)=>void) | undefined;
  globalThis.fetch=async input => {
    const url=String(input);
    if (url.includes('trial-balance')&&url.includes('workspaceId=component-workspace')) return new Promise<Response>(resolve=>{finishOld=resolve;});
    if (url.includes('trial-balance')) return new Response(JSON.stringify({accounts:[],totalDebit:0,totalCredit:0,isBalanced:true}),{status:200});
    return new Response('[]',{status:200});
  };
  render(<AccountBalanceChart endDate="2024-02-29" />);
  await waitFor(()=>assert.ok(finishOld));
  await act(async()=>{ useAuthStore.setState({currentWorkspaceId:'new-workspace',workspaces:[{...workspace,id:'new-workspace'}]}); });
  await act(async()=>{ finishOld!(new Response(JSON.stringify({accounts:[{id:'old',name:'OLD_SCOPE_BALANCE',type:'asset',netSigned:999999}],totalDebit:999999,totalCredit:0,isBalanced:false}),{status:200})); });
  await waitFor(()=>assert.equal(screen.queryByText(/Loading full account balances/),null));
  assert.doesNotMatch(document.body.textContent || '',/OLD_SCOPE_BALANCE/);
});
