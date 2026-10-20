import './helpers/dom';
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import InventoryItemDialog from '../components/inventory/InventoryItemDialog';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useAuthStore } from '../stores/useAuthStore';
import { BUNDLE_MAX_QUANTITY } from '../lib/itemBundles';
import type { InventoryItem } from '../types';

const part: InventoryItem={id:'part',uid:'test-user',workspaceId:'component-workspace',name:'חלק Widget',sku:'PART',unitPriceCents:1000,unitCostCents:500,quantityAtHand:0,reorderPoint:0,createdAt:'2026-10-01'};
const kit: InventoryItem={...part,id:'kit',name:'ערכה Kit',sku:'KIT',measurementUnit:'ארגז pack',unitsPerPackage:12,bundleParts:[]};
beforeEach(()=>{setComponentWorkspace();useAuthStore.setState({user:null,isGuest:true});});afterEach(()=>cleanup());
function mount(item:InventoryItem=kit){
 let saved:Record<string,string>|undefined;
 render(<InventoryItemDialog open editingItem={item} allItems={[item,part,{...part,id:'nested',name:'Nested',bundleParts:[{itemId:'part',quantity:1}]}]} categories={[]} canChangeStock={false} onAdjust={()=>{}} onClose={()=>{}} onSubmit={event=>{event.preventDefault();saved=Object.fromEntries(Array.from(new window.FormData(event.currentTarget).entries()).map(([key,value])=>[key,String(value)]));}}/>);
 return ()=>saved;
}
function choose(quantity:string){fireEvent.change(screen.getByLabelText('Item to add as a bundle part'),{target:{value:'part'}});fireEvent.change(screen.getByLabelText('How many of the part one bundle holds'),{target:{value:quantity}});}
test('bundle parts, Hebrew unit and package size reach the existing form submit without price or stock changes',()=>{
 const saved=mount();choose('3');fireEvent.click(screen.getByRole('button',{name:'Add part'}));
 fireEvent.change(screen.getByLabelText('UOM (e.g. pack, kg)'),{target:{value:'קופסה Box'}});
 fireEvent.change(screen.getByLabelText('Units per Package'),{target:{value:'24'}});
 fireEvent.submit(screen.getByRole('button',{name:'Update Item'}).closest('form')!);
 const data=saved()!;assert.deepEqual(JSON.parse(data.bundleParts),[{itemId:'part',quantity:3}]);assert.equal(data.measurementUnit,'קופסה Box');assert.equal(data.unitsPerPackage,'24');assert.equal(data.name,'ערכה Kit');
 assert.equal(data.unitPrice,'10');assert.equal(data.unitCost,'5');assert.equal(kit.quantityAtHand,0);
});
test('adding the same part replaces its quantity; removal explicitly clears the bundle',()=>{
 const saved=mount();choose('2');fireEvent.click(screen.getByRole('button',{name:'Add part'}));choose('5');fireEvent.click(screen.getByRole('button',{name:'Add part'}));
 assert.equal(screen.getAllByRole('button',{name:'Remove חלק Widget'}).length,1);
 fireEvent.click(screen.getByRole('button',{name:'Remove חלק Widget'}));fireEvent.submit(screen.getByRole('button',{name:'Update Item'}).closest('form')!);assert.deepEqual(JSON.parse(saved()!.bundleParts),[]);
});
test('invalid, fractional and excessive candidate quantities cannot be added',()=>{
 mount();for(const quantity of ['0','-1','1.5',String(BUNDLE_MAX_QUANTITY+1)]){choose(quantity);assert.equal((screen.getByRole('button',{name:'Add part'}) as HTMLButtonElement).disabled,true);assert.match(screen.getByRole('alert').textContent||'',/positive whole number/);}
});
test('missing saved parts block both the save button and direct form submission, retaining the draft',()=>{
 const saved=mount({...kit,bundleParts:[{itemId:'missing',quantity:1}]});const save=screen.getByRole('button',{name:'Update Item'}) as HTMLButtonElement;
 assert.equal(save.disabled,true);fireEvent.submit(save.closest('form')!);assert.equal(saved(),undefined);assert.equal((screen.getByLabelText('Item Name') as HTMLInputElement).value,'ערכה Kit');assert.match(screen.getByRole('alert').textContent||'',/not in the item list/);
});
test('guest demo explains that item images require a saved workspace record',()=>{
 mount();
 assert.ok(screen.getByRole('heading',{name:'Item image'}));
 assert.match(document.body.textContent||'',/available for saved items in a signed-in workspace/);
 assert.equal(screen.queryByLabelText('Choose image for ערכה Kit'),null);
 assert.ok(screen.getByRole('button',{name:'Update Item'}));
});
test('self and nested bundles are absent from part choices; help does not promise invoice expansion',()=>{
 mount();const options=Array.from((screen.getByLabelText('Item to add as a bundle part') as HTMLSelectElement).options).map(option=>option.value);
 assert.ok(!options.includes('kit'));assert.ok(!options.includes('nested'));assert.ok(options.includes('part'));
 assert.match(document.body.textContent||'',/Automatic expansion into invoice lines is not available here/);
});
