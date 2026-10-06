import './helpers/dom';
import test,{afterEach,mock} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import FeedbackWidget from '../components/support/FeedbackWidget';
import {feedbackRecords,FEEDBACK_APP_VERSION} from '../lib/feedbackTicket';
import {setComponentWorkspace} from './helpers/componentFixtures';
import {useUIStore} from '../stores/useUIStore';
import {useAuthStore} from '../stores/useAuthStore';
import {getSupabase} from '../lib/db/client';
import {toast} from 'sonner';
afterEach(async()=>{cleanup();mock.restoreAll();await getSupabase().auth.dispose();});
function setup(){setComponentWorkspace();useUIStore.setState({activeTab:'reports',activeReportTab:'budget-actual'});mock.method(toast,'success',()=> 'saved');}
test('feedback keeps exact Hebrew body, screen and app version in allowed support records',()=>{
 const records=feedbackRecords({id:'f',uid:'u',workspaceId:'w',screen:'reports/budget-actual',body:'  שלום mixed data 12  ',date:'2026-10-06T12:00:00Z'});
 assert.equal(records.ticket.subject,'Feedback: reports/budget-actual');assert.equal(records.ticket.errorDiagnostics?.release,FEEDBACK_APP_VERSION);
 assert.match(records.message.body,/שלום mixed data 12$/);assert.equal(records.message.ticketId,records.ticket.id);
 assert.throws(()=>feedbackRecords({id:'f',uid:'u',workspaceId:'w',screen:'dashboard',body:' '.repeat(5),date:''}),/Describe/);
});
test('feedback from any screen is a single atomic ticket+message save, with named keyboard-cancellable dialog',async()=>{
 setup();const calls:Record<string,unknown>[]=[];
 globalThis.fetch=async(input,init)=>{if(String(input).includes('/rpc/lf_batch'))calls.push(JSON.parse(String(init?.body)));return new Response('null',{headers:{'Content-Type':'application/json'}});};
 render(<FeedbackWidget/>);const opener=screen.getByRole('button',{name:'Send feedback'});
 await act(async()=>fireEvent.click(opener));assert.ok(screen.getByRole('dialog',{name:'Send feedback'}));assert.match(screen.getByText(/Screen: Reports · Budget vs Actual \(reports\/budget-actual\)/).textContent || '',/App version/);
 fireEvent.change(screen.getByLabelText('What happened?'),{target:{value:'Mixed labels are confusing שלום'}});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Send'})));
 assert.equal(calls.length,1);const ops=calls[0].p_ops as {table:string;id:string;data:Record<string,unknown>}[];
 assert.deepEqual(ops.map(op=>op.table),['supportTickets','supportMessages']);assert.equal(ops[1].data.ticketId,ops[0].id);assert.match(String(ops[1].data.body),/Mixed labels are confusing שלום$/);assert.ok(screen.queryByRole('dialog') === null);
 await act(async()=>fireEvent.click(opener));assert.equal((screen.getByLabelText('What happened?') as HTMLTextAreaElement).value,'');
 await act(async()=>fireEvent.keyDown(screen.getByLabelText('What happened?'),{key:'Escape'}));assert.ok(screen.queryByRole('dialog') === null);
});
test('refused feedback keeps draft; duplicate submit is refused; workspace changes clear pending draft',async()=>{
 setup();let calls=0;let resolve:(r:Response)=>void=()=>{};
 globalThis.fetch=async()=>{calls++;return await new Promise<Response>(done=>{resolve=done;});};
 render(<FeedbackWidget/>);await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Send feedback'})));
 fireEvent.change(screen.getByLabelText('What happened?'),{target:{value:'Retain this draft'}});
 await act(async()=>{const form=screen.getByRole('button',{name:'Send'}).closest('form')!;fireEvent.submit(form);fireEvent.submit(form);});assert.equal(calls,1);
 await act(async()=>resolve(new Response(JSON.stringify({message:'Permission denied'}),{status:403,headers:{'Content-Type':'application/json'}})));
 assert.ok(screen.getByRole('alert'));assert.equal((screen.getByLabelText('What happened?') as HTMLTextAreaElement).value,'Retain this draft');
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Send'})));
 act(()=>useAuthStore.setState({currentWorkspaceId:'another'}));assert.ok(screen.queryByRole('dialog') === null);
 await act(async()=>resolve(new Response('null',{headers:{'Content-Type':'application/json'}})));
 assert.ok(screen.queryByRole('dialog') === null);
});
test('Help opens the shared form; guest feedback explains why sending is disabled',async()=>{
 useAuthStore.setState({user:null,currentWorkspaceId:null,isGuest:true});render(<FeedbackWidget/>);
 await act(async()=>window.dispatchEvent(new window.Event('ledgerflow:feedback')));
 assert.match(screen.getByRole('status').textContent || '',/Sign in/);assert.equal((screen.getByRole('button',{name:'Send'}) as HTMLButtonElement).disabled,true);
});
