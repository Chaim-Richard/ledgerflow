import React, { useMemo } from 'react';
import { usePerformanceTrace } from '../../hooks/usePerformanceTrace';
import { 
  History, 
  Search, 
  Download,
  User,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface AuditTrailProps {
  auditLogs: any[];
}

const Row = ({ index, style, data }: { index: number, style: React.CSSProperties, data: any[] }) => {
  const log = data[index];
  if (!log) return null;

  return (
    <div style={style} className="px-8 flex items-center">
      <div className="w-full flex items-center justify-between p-5 bg-[var(--ink)]/20 rounded-[32px] border border-[var(--line)] hover:border-indigo-600/30 transition-all group">
        <div className="flex items-center gap-6 overflow-hidden">
          <div className="w-10 h-10 bg-[var(--ink)] rounded-xl flex items-center justify-center text-slate-500 shrink-0 border border-[var(--line)]">
            <Activity size={18} />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-3 mb-1">
              <span className={cn(
                "px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-wider",
                log.action?.toLowerCase() === 'create' ? "bg-emerald-500/20 text-emerald-500" :
                log.action?.toLowerCase() === 'update' ? "bg-indigo-600/20 text-indigo-600" :
                "bg-rose-500/20 text-rose-500"
              )}>
                {log.action}
              </span>
              <p className="text-xs font-black text-[var(--text)] uppercase tracking-tight truncate">
                {log.entityType} <span className="opacity-20 mx-1">/</span> {log.details?.description || log.entityId}
              </p>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">
              <span className="flex items-center gap-1.5"><History size={10} />{log.timestamp ? format(new Date(log.timestamp), 'MMM dd, HH:mm:ss') : 'N/A'}</span>
              <span className="flex items-center gap-1.5"><User size={10} />{log.userEmail || log.email || log.uid?.substring(0, 8)}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="hidden md:flex flex-col items-end gap-1">
            <div className="px-2 py-0.5 bg-[var(--ink)] rounded border border-[var(--line)]">
              <p className="text-[9px] font-mono font-bold text-indigo-600">
                0x{(log.id || 'xxxxxx').substring(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuditTrail = React.memo(({ auditLogs: passedLogs }: AuditTrailProps) => {
  usePerformanceTrace("AuditTrail");

  const storeLogs = useLedgerStore(state => state.auditLogs || []);
  const auditLogs = passedLogs || storeLogs;
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredLogs = useMemo(() => {
    let base = auditLogs.map(log => ({
      ...log,
      _timestampMs: log.timestamp ? new Date(log.timestamp).getTime() : 0
    }));

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      base = base.filter(log => 
        (log.action?.toLowerCase() || '').includes(term) ||
        (log.entityType?.toLowerCase() || '').includes(term) ||
        (log.userEmail?.toLowerCase() || '').includes(term) ||
        (log.email?.toLowerCase() || '').includes(term)
      );
    }
    
    return base.sort((a, b) => b._timestampMs - a._timestampMs);
  }, [auditLogs, searchTerm]);

  const downloadAuditLog = () => {
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate mb-4">
            <History size={14} />
            Verified Audit Stream
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-[var(--text)] tracking-tighter">Audit Trail</h2>
          <p className="text-slate-500 font-normal text-lg mt-2 max-w-xl leading-relaxed">Continuous cryptographic observability of legal and fiscal vectors.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group/search">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-hover/search:text-indigo-600 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search feed..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 h-14 pl-14 pr-6 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-xs font-bold text-[var(--text)] focus:outline-none focus:border-indigo-600 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={downloadAuditLog}
            className="h-14 px-8 bg-slate-900 text-white hover:bg-zinc-800 rounded-[32px] flex items-center gap-3 text-[10px] font-medium uppercase tracking-wider transition-all shadow-xl shadow-ledger-ink/10"
           aria-label="Export Core">
            <Download size={18} />
            Export Core
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] overflow-hidden shadow-2xl relative min-h-[500px]">
        <div className="absolute technical-grid pointer-events-none opacity-[0.05] inset-0" />
        <div className="absolute inset-0 z-10">
          {filteredLogs.length > 0 ? (
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  itemCount={filteredLogs.length}
                  itemSize={100}
                  width={width}
                  className="py-8"
                  itemData={filteredLogs}
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <History size={64} className="text-slate-200 mx-auto mb-6 opacity-20" />
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider truncate">Zero Vectors Detected in Current Buffer</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default AuditTrail;
