import {useRef,type ReactNode} from 'react';
/** Native controls let keyboard users scroll wide tables without a focusable static element. */
export default function ReportTableScroll({children}:{children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);
 const scroll=(left:number)=>ref.current?.scrollBy({left,behavior:'auto'});
 return <div ref={ref} className="overflow-x-auto" role="region" aria-label="Scrollable report table">
  <div data-print-hide className="sticky left-0 flex gap-2 mb-2">
   <button type="button" aria-label="Scroll table left" onClick={()=>scroll(-240)} className="min-h-11 px-3 border rounded">← Scroll left</button>
   <button type="button" aria-label="Scroll table right" onClick={()=>scroll(240)} className="min-h-11 px-3 border rounded">Scroll right →</button>
  </div>
  {children}
 </div>;
}
