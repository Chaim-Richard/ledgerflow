import React, { useMemo } from 'react';
import { AuditLog } from '../../types';
import { ShieldCheck, History, User, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { cn } from '../../lib/utils';

interface AuditTrailViewProps {
  auditLogs: AuditLog[];
}

const Row = ({ index, style, data }: { index: number, style: React.CSSProperties, data: AuditLog[] }) => {
  const log = data[index];
  if (!log) return null;

  return (
    <div style={style} className="px-8 flex items-center">
      <div className="w-full flex items-center justify-between p-6 bg-[var(--ink)]/20 rounded-[32px] border border-[var(--line)] hover:border-indigo-600/30 transition-all group overflow-hidden">
        <div className="flex items-center gap-6 overflow-hidden">
          <div className="w-12 h-12 bg-[var(--ink)] rounded-[32px] flex items-center justify-center text-slate-500 shadow-inner border border-[var(--line)] shrink-0">
            <Activity size={20} className="group-hover:text-indigo-600 transition-colors" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-3 mb-1.5">
              <span className={cn(
                "px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider ring-1 ring-inset",
                log.action?.toLowerCase() === 'create' ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" :
                log.action?.toLowerCase() === 'update' ? "bg-amber-500/10 text-amber-500 ring-amber-500/20" :
                "bg-rose-500/10 text-rose-500 ring-rose-500/20"
              )}>
                {log.action}
              </span>
              <p className="text-xs font-black text-[var(--text)] uppercase tracking-tight truncate">
                {log.entityType} <span className="opacity-20 mx-2">//</span> {log.details?.description || log.entityId}
              </p>
            </div>
            <div className="flex items-center gap-6 text-[9px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">
              <span className="flex items-center gap-2"><History size={11} className="text-indigo-600/40" />{log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm:ss') : 'N/A'}</span>
              <span className="flex items-center gap-2"><User size={11} className="text-indigo-600/40" />{log.email || log.userEmail || (log.uid && log.uid.substring(0, 8)) || 'System'}</span>
            </div>
          </div>
        </div>
        <div className="text-right hidden md:block shrink-0">
          <div className="px-3 py-1 bg-[var(--ink)] rounded-lg border border-[var(--line)] mb-1">
            <p className="text-[9px] font-mono font-bold text-indigo-600">
              0x{(log.id || 'xxxxxxxxx').substring(0, 10).toUpperCase()}
            </p>
          </div>
          <p className="text-[7px] text-slate-500 uppercase tracking-[0.3em] font-black opacity-30">Integrity Hash</p>
        </div>
      </div>
    </div>
  );
};

const AuditTrailView = React.memo(({ auditLogs = [] }: AuditTrailViewProps) => {
  const sortedLogs = useMemo(() => {
    return [...auditLogs].sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });
  }, [auditLogs]);

  return (
    <div className="bg-[var(--surface)] rounded-[40px] border border-[var(--line)] shadow-sm overflow-hidden flex-1 min-h-[500px] flex flex-col">
      <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/30 shrink-0">
        <div>
          <h3 className="text-xl font-black text-[var(--text)] uppercase italic tracking-tighter">Audit Trail Matrix</h3>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 opacity-40">Immutable cryptographic record of system directives</p>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 bg-indigo-600 text-white rounded-xl border border-indigo-600/20 shadow-lg shadow-ledger-accent/10">
          <ShieldCheck size={18} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Authenticity Verified</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-[var(--surface)]/50">
        {sortedLogs.length > 0 ? (
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                itemCount={sortedLogs.length}
                itemSize={112}
                width={width}
                className="py-6"
                itemData={sortedLogs}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-[var(--ink)] rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-[var(--line)] shadow-inner">
              <ShieldCheck size={40} className="opacity-10 text-indigo-600" />
            </div>
            <p className="font-medium uppercase tracking-wider truncate text-[10px] text-slate-500">Zero directives detected in current mesh</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default AuditTrailView;
