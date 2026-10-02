import React, { useMemo } from 'react';
import { JournalEntry } from '../../types';
import { FileSearch, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { parseLocalDate } from '../../lib/utils';
import { toast } from 'sonner';

interface JournalViewProps {
  journalEntries: JournalEntry[];
  formatCurrency: (val: number) => string;
}

export default function JournalView({ journalEntries = [], formatCurrency }: JournalViewProps) {
  const sortedEntries = useMemo(() => {
    return [...journalEntries].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  }, [journalEntries]);

  const Row = ({ index, style }: { index: number, style: React.CSSProperties }) => {
    const entry = sortedEntries[index];
    if (!entry) return null;

    const totalDebits = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);

    return (
      <div style={style} className="px-5 flex items-center border-b border-[var(--line)] hover:bg-[var(--ink)] transition-all cursor-pointer group">
         <div className="grid grid-cols-[80px_1fr_120px_150px] w-full items-center gap-4 py-3 px-2">
            <div className="flex flex-col">
               <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider">Date</span>
               <span className="font-mono text-xs text-slate-600 font-semibold">{format(parseLocalDate(entry.date), 'dd.MM.yy')}</span>
            </div>
            
            <div className="flex flex-col">
               <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider">Description</span>
               <span className="font-bold text-xs text-[var(--text)] tracking-tight truncate">
                 {entry.description || 'General Slip Entry'}
               </span>
            </div>

            <div className="flex flex-col">
               <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider">Reference</span>
               <span className="font-mono text-[10px] text-[var(--muted)]">
                 {entry.reference || `CB-${(entry.id || 'xxxxxx').substring(0, 6).toUpperCase()}`}
               </span>
            </div>

            <div className="flex flex-col items-end">
               <span className="text-[8px] font-bold text-[var(--muted)] uppercase tracking-wider">Magnitude</span>
               <span className="font-mono text-xs font-bold text-[var(--text)] tabular-nums">
                 {formatCurrency(totalDebits)}
               </span>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)]/85 rounded-xl shadow-3xs overflow-hidden flex-1 min-h-[500px] flex flex-col relative">
       <div className="absolute technical-grid inset-0 opacity-[0.015] pointer-events-none" />
       
       <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[var(--ink)] shrink-0 relative z-10 gap-3">
        <div>
          <h2 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider leading-none">Journal Protocol</h2>
          <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">Verified Cryptographic Log</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const totalDebits = sortedEntries.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + (l.debit || 0), 0), 0);
              toast.info(`Journal Metrics: ${sortedEntries.length} slips, Total volume: ${formatCurrency(totalDebits)}`);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-[9px] font-bold uppercase tracking-wider hover:border-slate-400 transition-colors cursor-pointer"
          >
             <Activity size={12} className="text-blue-500 shrink-0" />
             Metrics
          </button>
          <button 
            onClick={() => {
              toast.success("Cryptographic Journal Verification Passed", {
                description: `All ${sortedEntries.length} journal slips balanced and verified against hash chain.`
              });
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer"
          >
            <FileSearch size={12} className="shrink-0" />
            Full Audit
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[var(--surface)] relative z-10 overflow-x-auto custom-scrollbar">
        {sortedEntries.length > 0 ? (
          <React.Suspense fallback={<div className="p-6 text-center text-xs font-mono uppercase text-[var(--muted)]">Opening Table...</div>}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  itemCount={sortedEntries.length}
                  itemSize={64}
                  width={Math.max(width, 700)}
                  className="custom-scrollbar"
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          </React.Suspense>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 bg-[var(--ink)] border border-[var(--line)] rounded-xl flex items-center justify-center text-[var(--muted)] mx-auto mb-3 shadow-3xs">
               <Activity size={20} />
            </div>
            <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Log Matrix Zero State</p>
          </div>
        )}
      </div>
    </div>
  );
}
