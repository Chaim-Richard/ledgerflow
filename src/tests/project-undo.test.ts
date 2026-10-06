import './helpers/dom';
import test, {afterEach, mock} from 'node:test';
import assert from 'node:assert/strict';
import {deleteProjectWithUndo} from '../lib/projectUndo';
import {useAuthStore} from '../stores/useAuthStore';
import {setComponentWorkspace} from './helpers/componentFixtures';
import {getSupabase} from '../lib/db/client';
import {toast} from 'sonner';
afterEach(async()=>{mock.restoreAll(); await getSupabase().auth.dispose();});
function setup() {
 setComponentWorkspace();
 const original={uid:'test-user',workspaceId:'component-workspace',name:'פרויקט 12',status:'active',budgetCents:123456,createdAt:'2026-01-01',metadata:{nested:['א',7]}};
 let record:typeof original|null=structuredClone(original);
 const calls:Record<string,unknown>[]=[];
 globalThis.fetch=async(input,init)=>{
 const url=String(input);
 if(url.includes('/rpc/lf_delete')) {calls.push(JSON.parse(String(init?.body)));record=null;return new Response('null',{headers:{'Content-Type':'application/json'}});}
 if(url.includes('/rpc/lf_set')) {const body=JSON.parse(String(init?.body));calls.push(body);record=body.p_data;return new Response('null',{headers:{'Content-Type':'application/json'}});}
 return new Response(JSON.stringify(record?{id:'p',data:record}:null),{headers:{'Content-Type':'application/json'}});
 };
 mock.method(toast,'success',()=> 'undo-toast');mock.method(toast,'dismiss',()=>{});mock.method(toast,'error',()=>{});
 return {original,calls,setRecord:(value:typeof original|null)=>{record=value;}};
}
test('project Undo restores the exact durable snapshot with same ID, one time, within 10 seconds',async()=>{
 const {original,calls}=setup();const undo=await deleteProjectWithUndo('p');assert.ok(undo);await undo();await undo();
 assert.equal(calls.length,2);assert.equal(calls[1].p_id,'p');assert.deepEqual(calls[1].p_data,original);assert.equal(calls[1].p_merge,false);
});
test('expired or cross-workspace Undo cannot write; viewer cannot delete',async()=>{
 const {calls}=setup();const undo=await deleteProjectWithUndo('p');
 actTime(11000);await undo!();assert.equal(calls.length,1);mock.restoreAll();
 const next=setup();const another=await deleteProjectWithUndo('p');useAuthStore.setState({currentWorkspaceId:'other'});await another!();assert.equal(next.calls.length,1);
 setComponentWorkspace('viewer');await assert.rejects(deleteProjectWithUndo('p'),/read-only/);
});
function actTime(offset:number) {const now=Date.now();mock.method(Date,'now',()=>now+offset);}
test('Undo refuses to overwrite a recreated record and keeps restore retryable after refusal',async()=>{
 const {calls,setRecord,original}=setup();const undo=await deleteProjectWithUndo('p');setRecord({...original,name:'Another record'});await undo!();assert.equal(calls.length,1);
 setRecord(null);await undo!();assert.equal(calls.length,2);
});
