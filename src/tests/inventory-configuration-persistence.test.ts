import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

test('bundle and mixed-language unit settings persist through inventory RLS without stock or money changes', {skip:!process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set'},async()=>{
 const client=new pg.Client({connectionString:process.env.LF_TEST_DATABASE_URL});await client.connect();
 const key=`item_config_${randomBytes(6).toString('hex')}`;
 const original={workspaceId:key,uid:`${key}_owner`,name:'ערכה Kit',sku:'KIT',itemType:'stock',quantityAtHand:0,unitPriceCents:1000,unitCostCents:500,reorderPoint:0,createdAt:'2026-10-01'};
 async function asUser(uid:string,patch:Record<string,unknown>){await client.query('begin');try{await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:uid,role:'authenticated',aal:'aal1'})]);await client.query('select public.lf_update($1,$2,$3)',['inventory',key,patch]);await client.query('commit');}catch(error){await client.query('rollback');throw error;}}
 async function read(){return (await client.query('select data from public.inventory where id=$1',[key])).rows[0].data;}
 try{
  await client.query('insert into public.workspaces (id,data) values ($1,$2)',[key,{uid:original.uid,name:'Synthetic inventory',currency:'USD',members:[original.uid,`${key}_book`,`${key}_viewer`],roles:{[`${key}_book`]:'bookkeeper',[`${key}_viewer`]:'viewer'}}]);
  await client.query('insert into public.inventory (id,data) values ($1,$2)',[key,original]);
  await client.query('insert into public.inventory (id,data) values ($1,$2)',[`${key}_part`,{...original,name:'חלק Widget',sku:'PART'}]);
  const settings={bundleParts:[{itemId:`${key}_part`,quantity:3}],measurementUnit:'קופסה Box',unitsPerPackage:24};
  await asUser(`${key}_book`,settings);let saved=await read();
  for(const [field,value] of Object.entries({...original,...settings}))assert.deepEqual(saved[field],value,field);
  for(const uid of [`${key}_viewer`,`${key}_outsider`]){await assert.rejects(asUser(uid,{measurementUnit:'Refused',bundleParts:[]}));assert.deepEqual(await read(),saved);}
  await asUser(original.uid,{bundleParts:[]});saved=await read();assert.deepEqual(saved.bundleParts,[]);assert.equal(saved.measurementUnit,'קופסה Box');assert.equal(saved.unitsPerPackage,24);
  assert.equal(saved.quantityAtHand,0);assert.equal(saved.unitPriceCents,1000);assert.equal(saved.unitCostCents,500);
  assert.equal((await client.query('select count(*)::int as count from public.transactions where workspace_id=$1',[key])).rows[0].count,0);
 }finally{await client.query('delete from public.inventory where workspace_id=$1',[key]);await client.query('delete from public.workspaces where id=$1',[key]);await client.end();}
});
