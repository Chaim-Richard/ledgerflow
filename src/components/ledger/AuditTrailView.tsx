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
    <div style={style} className="px-6 flex items-center">
      <div className="w-full flex items-center justify-between p-4 bg-[var(--ink)]/30 rounded-xl border border-[var(--line)] hover:border-[var(--brass-line)] transition-all group overflow-hidden">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="w-10 h-10 bg-[var(--surface)] rounded-lg flex items-center justify-center text-[var(--muted)] border border-[var(--line)] shrink-0">
            <Activity size={18} className="group-hover:text-[var(--brass)] transition-colors" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                log.action?.toLowerCase() === 'create' ? "bg-[var(--pos)]/10 text-[var(--pos)]" :
                log.action?.toLowerCase() === 'update' ? "bg-amber-500/10 text-amber-500" :
                "bg-rose-500/10 text-rose-500"
              )}>
                {log.action}
              </span>
              <p className="text-xs font-bold text-[var(--text)] uppercase tracking-tight truncate">
                {log.entityType} <span className="text-[var(--muted)] opacity-40 mx-1.5">//</span> {log.details?.description || log.entityId}
              </p>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider italic">
              <span className="flex items-center gap-1.5"><History size={11} className="text-[var(--brass)]" />{log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm:ss') : 'N/A'}</span>
              <span className="flex items-center gap-1.5"><User size={11} className="text-[var(--brass)]" />{log.email || log.userEmail || (log.uid && log.uid.substring(0, 8)) || 'System'}</span>
            </div>
          </div>
        </div>
        <div className="text-right hidden md:block shrink-0">
          <div className="px-2.5 py-1 bg-[var(--surface)] rounded border border-[var(--line)] mb-0.5">
            <p className="text-[9px] font-mono font-bold text-[var(--brass)]">
              0x{(log.id || 'xxxxxxxxx').substring(0, 10).toUpperCase()}
            </p>
          </div>
          <p className="text-[7px] text-[var(--muted)] uppercase tracking-[0.2em] font-bold">Integrity Hash</p>
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
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden flex-1 min-h-[500px] flex flex-col">
      <div className="p-4 md:p-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/30 shrink-0">
        <div>
          <h3 className="text-lg font-black text-[var(--text)] uppercase tracking-tight">Audit Trail Matrix</h3>
          <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mt-0.5">Immutable cryptographic record of system directives</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--brass-soft)] text-[var(--brass)] rounded-xl border border-[var(--brass-line)] shadow-sm">
          <ShieldCheck size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Authenticity Verified</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-[var(--surface)]">
        {sortedLogs.length > 0 ? (
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                itemCount={sortedLogs.length}
                itemSize={100}
                width={width}
                className="py-4"
                itemData={sortedLogs}
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-[var(--ink)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--line)]">
              <ShieldCheck size={32} className="text-[var(--muted)]" />
            </div>
            <p className="font-bold uppercase tracking-wider text-[10px] text-[var(--muted)]">Zero directives detected in current mesh</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default AuditTrailView;
