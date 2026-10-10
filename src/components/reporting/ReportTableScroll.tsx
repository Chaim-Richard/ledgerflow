import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { hiddenColumnsCss, readHidden, saveHidden, toggleColumn } from '../../lib/columnChoice';

/**
 * Native controls let keyboard users scroll wide tables without a focusable static element. N-10:
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
 const scroll=(left:number)=>ref.current?.scrollBy({left,behavior:'auto'});
 // the table's column headings and its name, read when it is on screen and whenever it changes
 const reportRef=useRef('');
 useEffect(()=>{
  const el=ref.current;
  if(!el)return;
  const read=()=>{
   const table=el.querySelector('table');
   const row=table?.querySelector('thead tr:last-child');
   const names=row?Array.from(row.children).map(c=>(c.textContent||'').trim()):[];
   const name=(table?.querySelector('caption')?.textContent||'').trim()||names.join('|');
   setHeaders(prev=>(prev.join('|')===names.join('|')?prev:names));
   if(name!==reportRef.current){reportRef.current=name;setReport(name);setHidden(name?readHidden(name):[]);}
  };
  const watch=new MutationObserver(read);
  watch.observe(el,{childList:true,subtree:true,characterData:true});
  const first=setTimeout(read,0);
  return()=>{watch.disconnect();clearTimeout(first);};
 },[]);
 const change=(index:number)=>{const next=toggleColumn(hidden,index,headers.length);setHidden(next);if(report)saveHidden(report,next);};
 return <div ref={ref} data-columns={scope} className="overflow-x-auto" role="region" aria-label="Scrollable report table">
  <style>{hiddenColumnsCss(scope,hidden)}</style>
  <div data-print-hide className="sticky left-0 flex flex-wrap gap-2 mb-2">
   <button type="button" aria-label="Scroll table left" onClick={()=>scroll(-240)} className="min-h-11 px-3 border rounded">← Scroll left</button>
   <button type="button" aria-label="Scroll table right" onClick={()=>scroll(240)} className="min-h-11 px-3 border rounded">Scroll right →</button>
   {headers.length>2&&<button type="button" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="min-h-11 px-3 border rounded">Columns{hidden.length?` (${hidden.length} hidden)`:''}</button>}
  </div>
  {open&&headers.length>2&&(
   <fieldset data-print-hide className="sticky left-0 mb-2 flex flex-wrap gap-3 text-sm">
    <legend className="sr-only">Columns to show</legend>
    {headers.map((name,column)=>({name,column})).slice(1).map(c=>(
     <label key={c.column} className="flex items-center gap-1"><input type="checkbox" checked={!hidden.includes(c.column)} onChange={()=>change(c.column)}/>{c.name||`Column ${c.column+1}`}</label>
    ))}
   </fieldset>
  )}
  {children}
 </div>;
}
