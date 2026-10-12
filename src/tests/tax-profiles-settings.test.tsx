import './helpers/dom';
import test, { afterEach, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaxProfilesSettings from '../components/platform/settings/TaxProfilesSettings';
import { auth, db } from '../firebase';
import { getSupabase } from '../lib/db/client';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { setComponentWorkspace } from './helpers/componentFixtures';
import type { Workspace } from '../types';
import type { TaxProfiles } from '../lib/tax/profile';

const realFetch = globalThis.fetch;
let workspace: Workspace;
let latest: Workspace;
function api(body: unknown, status = 200) { return new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json'}}); }
beforeEach(() => {
  workspace = setComponentWorkspace();
  latest = structuredClone(workspace);
  auth.currentUser = useAuthStore.getState().user;
  useLedgerStore.setState({dimensionNodes:[{id:'entity/branch',dimensionId:'world',description:'סניף Branch'}],truncatedCollections:{}});
  const query = { select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{id:workspace.id,data:latest},error:null}) };
  mock.method(db,'client',()=>({from:()=>query}) as unknown as ReturnType<typeof db.client>);
  globalThis.fetch = async()=>api({message:'Unexpected request'},500);
});
afterEach(async()=>{
  cleanup();mock.restoreAll();globalThis.fetch=realFetch;auth.currentUser=null;
  getSupabase().realtime.disconnect();await getSupabase().auth.dispose();
});
function profiles(value: TaxProfiles) {
  workspace = {...workspace,taxProfiles:value};latest=structuredClone(workspace);
  useAuthStore.getState().setWorkspaces([workspace]);
}
function select(key:string) { fireEvent.change(screen.getByLabelText('Profile'),{target:{value:key}}); }
function edit() { fireEvent.click(screen.getByRole('button',{name:'Edit this profile'})); }
function save() { auth.currentUser=useAuthStore.getState().user;fireEvent.click(screen.getByRole('button',{name:'Save profile'})); }

test('mixed-language nested profiles show inherited fields and their exact source separately',()=>{
  profiles({books:{name:'ספרים Books',place:{country:'IL',city:'ירושלים'},basis:'accrual'},labels:{'world:entity':{place:{country:'US',state:'NY'}},'world:entity/branch':{name:'סניף Branch'}}});
  render(<TaxProfilesSettings/>);select('world:entity/branch');
  const country=screen.getByText('Country').nextElementSibling!;
  assert.match(country.textContent||'',/US/);assert.match(country.textContent||'',/world:entity/);
  assert.match(country.className,/muted/);
  const city=screen.getByText('City').nextElementSibling!;
  assert.match(city.textContent||'',/ירושלים/);assert.match(city.textContent||'',/the books/);
  const name=screen.getByText('Name').nextElementSibling!;
  assert.equal(name.textContent,'סניף Branch');assert.doesNotMatch(name.className,/muted/);
  assert.match(screen.getByText(/saving a profile does not verify/).textContent||'',/declarations/);
});

test('save preserves fresh unrelated profiles, rejects duplicate activation and retains a refused draft',async()=>{
  profiles({books:{name:'Before'},labels:{'world:entity':{name:'Before parent'}}});
  render(<TaxProfilesSettings/>);edit();
  fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'ספרים Edited'}});
  latest.taxProfiles={...latest.taxProfiles,labels:{'world:entity':{name:'New parent'},'world:new':{name:'Other editor'}}};
  let writes=0;let finish:(response:Response)=>void=()=>{};let sent:TaxProfiles|undefined;
  globalThis.fetch=async(input,init)=>{assert.match(String(input),/\/workspaces\/component-workspace\/tax-profiles$/);assert.equal(init?.method,'PUT');writes++;sent=JSON.parse(String(init?.body)).profiles;return new Promise<Response>(resolve=>{finish=resolve;});};
  save();await waitFor(()=>assert.equal(writes,1));
  fireEvent.submit(screen.getByRole('form',{name:'Edit tax profile'}));assert.equal(writes,1);
  assert.equal(sent?.books?.name,'ספרים Edited');assert.equal(sent?.labels?.['world:entity'].name,'New parent');assert.equal(sent?.labels?.['world:new'].name,'Other editor');
  await act(async()=>finish(api({message:'Server refused'},403)));
  assert.match(screen.getByRole('alert').textContent||'',/Server refused/);
  assert.equal((screen.getByLabelText('Profile name') as HTMLInputElement).value,'ספרים Edited');
  assert.equal(useAuthStore.getState().getCurrentWorkspace()?.taxProfiles?.books?.name,'Before');
  globalThis.fetch=async()=>api({status:'success',profiles:sent});save();
  await screen.findByText('Tax profile saved.');assert.equal(screen.queryByRole('form',{name:'Edit tax profile'}),null);
  assert.equal(useAuthStore.getState().getCurrentWorkspace()?.taxProfiles?.books?.name,'ספרים Edited');
});

test('observed same-profile changes refuse overwrite and preserve the typed draft',async()=>{
  profiles({books:{name:'Before'}});render(<TaxProfilesSettings/>);edit();
  fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'My draft'}});
  latest.taxProfiles={books:{name:'Changed elsewhere'}};let writes=0;
  globalThis.fetch=async()=>{writes++;return api({});};save();
  await screen.findByRole('alert');assert.match(screen.getByRole('alert').textContent||'',/changed while you were editing/);
  assert.equal(writes,0);assert.equal((screen.getByLabelText('Profile name') as HTMLInputElement).value,'My draft');
});

test('registration rows keep focus on removal and impossible calendar dates never reach the server',async()=>{
  profiles({books:{registrations:[{kind:'vat',number:'123',place:{country:'IL'}},{kind:'employer',number:'456',place:{country:'IL'},validFrom:'2026-02-30'}]}});
  render(<TaxProfilesSettings/>);edit();
  const numbers=screen.getAllByLabelText('Registration number');numbers[1].focus();
  fireEvent.click(screen.getByRole('button',{name:'Remove registration 1'}));
  assert.equal(screen.getByLabelText('Registration number'),numbers[1]);assert.equal(document.activeElement,numbers[1]);
  // Native date inputs reject impossible keystrokes. An old stored invalid day must also be refused.
  assert.equal((screen.getByLabelText('Registration valid from') as HTMLInputElement).value,'');
  let writes=0;globalThis.fetch=async()=>{writes++;return api({});};save();
  await screen.findByRole('alert');assert.match(screen.getByRole('alert').textContent||'',/real calendar days/);assert.equal(writes,0);
});

test('workspace changes clear drafts immediately and discard an old successful response',async()=>{
  profiles({books:{name:'Before'}});render(<TaxProfilesSettings/>);edit();
  fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Old workspace draft'}});
  let finish:(response:Response)=>void=()=>{};let started=false;
  globalThis.fetch=async()=>{started=true;return new Promise<Response>(resolve=>{finish=resolve;});};save();await waitFor(()=>assert.equal(started,true));
  const other={...workspace,id:'other-workspace',name:'Other',taxProfiles:{books:{name:'New workspace'}}};
  act(()=>useAuthStore.setState({workspaces:[workspace,other],currentWorkspaceId:other.id}));
  assert.equal(screen.queryByLabelText('Profile name'),null);assert.ok(screen.getByText('New workspace'));
  await act(async()=>finish(api({status:'success',profiles:{books:{name:'Old response'}}})));
  assert.equal(useAuthStore.getState().getCurrentWorkspace()?.taxProfiles?.books?.name,'New workspace');assert.equal(screen.queryByText('Tax profile saved.'),null);
});

test('viewers and guests can read profiles but cannot open an editor',()=>{
  workspace=setComponentWorkspace('viewer');profiles({books:{name:'Read only'}});const view=render(<TaxProfilesSettings/>);
  assert.ok(screen.getByText('Read only'));assert.equal(screen.queryByRole('button',{name:'Edit this profile'}),null);
  view.unmount();setComponentWorkspace('owner');useAuthStore.setState({isGuest:true});render(<TaxProfilesSettings/>);
  assert.equal(screen.queryByRole('button',{name:'Edit this profile'}),null);
});

test('malformed profile data is an explicit refusal, never an empty-looking editable record',()=>{
  profiles({books:{name:{unexpected:'object'}}} as unknown as TaxProfiles);
  render(<TaxProfilesSettings/>);
  assert.match(screen.getByRole('alert').textContent||'',/cannot be displayed safely/);
  assert.equal(screen.queryByRole('button',{name:'Edit this profile'}),null);
});

test('a role loss during token retrieval prevents the write and preserves the draft',async()=>{
  profiles({books:{name:'Before'}});render(<TaxProfilesSettings/>);edit();
  fireEvent.change(screen.getByLabelText('Profile name'),{target:{value:'Retained draft'}});
  let tokenRequested=false;let finish:(token:string)=>void=()=>{};let writes=0;
  mock.method(useAuthStore.getState().user!,'getIdToken',()=>{tokenRequested=true;return new Promise<string>(resolve=>{finish=resolve;});});
  globalThis.fetch=async()=>{writes++;return api({});};save();await waitFor(()=>assert.equal(tokenRequested,true));
  act(()=>useAuthStore.getState().setWorkspaces([{...workspace,uid:'another-owner',roles:{'test-user':'viewer'}}]));
  await act(async()=>finish('delayed-token'));
  assert.match(screen.getByRole('alert').textContent||'',/permissions changed/);assert.equal(writes,0);
  assert.equal((screen.getByLabelText('Profile name') as HTMLInputElement).value,'Retained draft');
});
