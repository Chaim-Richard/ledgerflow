import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import ExportTemplateControls from './ExportTemplateControls';
import { useAuthStore } from '../../stores/useAuthStore';
import { readPeriodLayout, savePeriodLayout, movePeriod, validPeriodLayout } from '../../lib/reportPeriodLayout';
import { orderReportCells } from './orderReportCells';
import { downloadCsv } from '../../lib/csvExport';
import { hiddenColumnsCss, readHidden, saveHidden, toggleColumn } from '../../lib/columnChoice';

/**
 * A named focusable region and native controls let keyboard users scroll wide tables. N-10:
 * "Columns" shows or hides the table's columns, remembered per report on this device (the report is
 * known by the table's caption); hidden columns don't print either.
 */
export default function ReportTableScroll({children}:{children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);
 const scope=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 const [headers,setHeaders]=useState<string[]>([]);
 const [report,setReport]=useState('');
 const [hidden,setHidden]=useState<number[]>([]);
 const [open,setOpen]=useState(false);
 const user=useAuthStore(state=>state.user?.uid);
 const workspace=useAuthStore(state=>state.currentWorkspaceId);
 const identity=user?JSON.stringify([user,workspace]):'';
 const reportKey=identity?JSON.stringify([identity,report]):report;
 const ids=headers.map((_,index)=>String(index));
 const orderKey=JSON.stringify(['lf_report_order_v1',identity,report,headers]);
 const [choice,setChoice]=useState<{key:string;order:string[]}|null>(null);
 const storedOrder=(choice?.key===orderKey?validPeriodLayout({order:choice.order},ids):readPeriodLayout(orderKey,ids)).order;
 const order=ids.length?['0',...storedOrder.filter(id=>id!=='0')]:[];
 const [reorderable,setReorderable]=useState(false);
 const move=(column:number,direction:-1|1)=>{
  const next=movePeriod({order,hidden:[]},String(column),direction);
  // The identifying first column stays first.
  if(next.order[0]!=='0')return;
  setChoice({key:orderKey,order:next.order});savePeriodLayout(orderKey,next);
 };
 const effectiveHidden=[...new Set(hidden.filter(index=>index>0&&index<headers.length))].slice(0,Math.max(0,headers.length-2));

 const scroll=(left:number)=>ref.current?.scrollBy({left,behavior:'auto'});
 // the table's column headings and its name, read when it is on screen and whenever it changes
 const reportRef=useRef('');
 useEffect(()=>{
  const el=ref.current;
  if(!el)return;
  const read=()=>{
   const table=el.querySelector('table');
   const row=table?.querySelector('thead tr:last-child');
   const cells=row?Array.from(row.children):[];
   const indexed=cells.every(cell=>cell.hasAttribute('data-source-column'));
   if(indexed)cells.sort((a,b)=>Number(a.getAttribute('data-source-column'))-Number(b.getAttribute('data-source-column')));
   const names=cells.map(c=>(c.textContent||'').trim());
   const rectangular=Array.from(table?.querySelectorAll('tr')||[]).every(tr=>tr.children.length===cells.length&&Array.from(tr.children).every(cell=>cell.hasAttribute('data-source-column')));
   setReorderable(indexed&&rectangular&&!!cells.length&&!table?.querySelector('[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])'));
   const name=(table?.querySelector('caption')?.textContent||'').trim()||names.join('|');
   setHeaders(prev=>(JSON.stringify(prev)===JSON.stringify(names)?prev:names));
   if(JSON.stringify([identity,name])!==reportRef.current){reportRef.current=JSON.stringify([identity,name]);setReport(name);setHidden(name?readHidden(identity?JSON.stringify([identity,name]):name):[]);}
  };
  const watch=new MutationObserver(read);
  watch.observe(el,{childList:true,subtree:true,characterData:true});
  const first=setTimeout(read,0);
  return()=>{watch.disconnect();clearTimeout(first);};
 },[identity]);
 const change=(index:number)=>{const next=toggleColumn(effectiveHidden,index,headers.length);setHidden(next);if(report)saveHidden(reportKey,next);};
 const exportDisplayed=()=>{
  const table=ref.current?.querySelector('table');
  if(!table||!reorderable)return;
  const visible=order.map(Number).filter(index=>!effectiveHidden.includes(index));
  const rows=Array.from(table.querySelectorAll('tbody tr,tfoot tr')).filter(row=>getComputedStyle(row).display!=='none').map(row=>{
   const cells=Array.from(row.children);
   const byIndex=new Map(cells.map(cell=>[Number(cell.getAttribute('data-source-column')),cell.textContent?.trim()||'']));
   return visible.map(index=>byIndex.get(index)||'');
  });
  downloadCsv('Displayed_report_rows.csv',visible.map(index=>headers[index]),rows);
 };
 return <div ref={ref} data-columns={scope} className="overflow-x-auto" role="region" aria-label="Scrollable report table" tabIndex={0}>
  <style>{hiddenColumnsCss(scope,effectiveHidden.map(index=>reorderable?order.indexOf(String(index)):index))}</style>
  <div data-print-hide className="sticky left-0 flex flex-wrap gap-2 mb-2">
   <button type="button" aria-label="Scroll table left" onClick={()=>scroll(-240)} className="min-h-11 px-3 border rounded">← Scroll left</button>
   <button type="button" aria-label="Scroll table right" onClick={()=>scroll(240)} className="min-h-11 px-3 border rounded">Scroll right →</button>
   {headers.length>2&&<button type="button" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="min-h-11 px-3 border rounded">Columns{effectiveHidden.length?` (${effectiveHidden.length} hidden)`:''}</button>}
   {open&&reorderable&&<button type="button" onClick={exportDisplayed} className="min-h-11 px-3 border rounded">Export displayed rows CSV</button>}
  </div>
  {open&&reorderable&&report&&<ExportTemplateControls report={report} columns={headers} layout={{order,hidden:effectiveHidden.map(String)}} onUse={next=>{
   const nextOrder=['0',...next.order.filter(id=>id!=='0')];
   const nextHidden=next.hidden.map(Number).filter(index=>index>0&&index<headers.length).slice(0,Math.max(0,headers.length-2));
   setChoice({key:orderKey,order:nextOrder});savePeriodLayout(orderKey,{order:nextOrder,hidden:[]});
   setHidden(nextHidden);saveHidden(reportKey,nextHidden);
  }}/>}
  {open&&headers.length>2&&(
   <fieldset data-print-hide className="sticky left-0 mb-2 flex flex-wrap gap-3 text-sm">
    <legend className="sr-only">Columns to show</legend>
    {reorderable&&<p className="w-full">CSV includes these displayed rows and columns as shown, including localized text. Use the report’s financial export for plain numeric amounts.</p>}
    {order.filter(id=>id!=='0').map(id=>({name:headers[Number(id)],column:Number(id)})).map(c=>(
     <div key={c.column} className="flex flex-wrap items-center gap-1"><label className="min-h-11 flex items-center gap-1"><input type="checkbox" checked={!effectiveHidden.includes(c.column)} onChange={()=>change(c.column)}/>{c.name||`Column ${c.column+1}`}</label>
      {reorderable&&<><button type="button" className="min-h-11 px-3 border rounded" aria-label={`Move ${c.name||`Column ${c.column+1}`} earlier`} disabled={order.indexOf(String(c.column))<=1} onClick={()=>move(c.column,-1)}>←</button><button type="button" className="min-h-11 px-3 border rounded" aria-label={`Move ${c.name||`Column ${c.column+1}`} later`} disabled={order.indexOf(String(c.column))===order.length-1} onClick={()=>move(c.column,1)}>→</button></>}
     </div>
    ))}
   </fieldset>
  )}
  {orderReportCells(children,reorderable?order.map(Number):[])}
 </div>;
}
