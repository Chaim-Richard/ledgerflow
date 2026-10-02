import React, { useState, useEffect } from 'react';
import { History, Search, User, Building, Calendar, ChevronDown, ChevronUp, Filter, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, activateOnKey } from '../../lib/utils';
import { auditDescription, auditTime } from '../../lib/auditFormat';
import { auth } from '../../firebase';
import { Labelled } from '../ui/Labelled';

const fetchWithAuth = async (url: string, options: any = {}) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  return fetch(url, { ...options, headers });
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    userId: '',
    workspaceId: '',
    action: '',
    startDate: '',
    endDate: '',
    limit: 50
  });

  const fetchLogs = async () => {
    try {
      const queryParams = new URLSearchParams(filters as any).toString();
      const res = await fetchWithAuth(`/api/v1/admin/audit-logs?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    async function init() {
      try {
        const queryParams = new URLSearchParams(filters as any).toString();
        const res = await fetchWithAuth(`/api/v1/admin/audit-logs?${queryParams}`);
        if (res.ok && mounted) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleApplyFilter = () => {
    setLoading(true);
    fetchLogs();
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const renderDiff = (before: any, after: any) => {
    if (!before || !after) return null;
    
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const changedKeys = allKeys.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

    if (changedKeys.length === 0) return <p className="text-[10px] text-[var(--muted)] italic">No field-level changes detected.</p>;

    return (
      <div className="space-y-2 mt-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)] mb-2">Field Diffs</h4>
        <div className="grid grid-cols-1 gap-2">
          {changedKeys.map(key => (
            <div key={key} className="flex flex-col p-2 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-tight">{key}</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono line-through text-rose-500 bg-rose-50 px-1 rounded truncate max-w-[200px]">
                  {JSON.stringify(before[key])}
                </span>
                <ArrowRight size={12} className="text-slate-300 flex-shrink-0" />
                <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-1 rounded truncate max-w-[200px]">
                  {JSON.stringify(after[key])}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] p-6 shadow-3xs">
        <div className="flex items-center gap-3 mb-6">
          <Filter size={18} className="text-[var(--muted)]" />
          <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--text)]">Forensic Audit Filter</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Actor UID</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
              <input 
                name="userId"
                value={filters.userId}
                onChange={handleFilterChange}
                placeholder="Filter by Actor..."
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-[#0047AB]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Workspace ID</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
              <input 
                name="workspaceId"
                value={filters.workspaceId}
                onChange={handleFilterChange}
                placeholder="Filter by Workspace..."
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-[#0047AB]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Labelled labelClassName="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] ml-1" label="Action Type">
              <select 
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-4 py-2 text-xs font-medium outline-none focus:border-[#0047AB]"
              >
                <option value="">All Actions</option>
                <option value="ADMIN_WORKSPACE_UPDATED">Workspace Update</option>
                <option value="ADMIN_USER_UPDATED">User Update</option>
                <option value="ADMIN_GLOBAL_CONFIG_UPDATED">Global Config</option>
              </select>
            </Labelled>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] ml-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={14} />
              <input 
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-[#0047AB]"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleApplyFilter}
              className="w-full bg-slate-900 text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              <Search size={14} />
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Log List */}
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[32px] shadow-3xs overflow-hidden">
        <div className="p-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]">
          <div className="flex items-center gap-3">
            <History size={16} className="text-[var(--muted)]" />
            <h3 className="text-[12px] font-black uppercase tracking-widest text-[var(--text)]">Institutional Audit Trail</h3>
          </div>
          <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Showing {logs.length} most recent operations</span>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest">Retrieving logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center text-[var(--muted)]">
              <p className="text-sm font-medium">No audit records match your current criteria.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={cn(
                "transition-all",
                expandedId === log.id ? "bg-slate-50/50" : "hover:bg-slate-50/30"
              )}>
                <div 
                  role="button" tabIndex={0} onKeyDown={activateOnKey} onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="p-4 md:p-6 cursor-pointer flex items-center gap-4"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                    log.action.includes('UPDATED') ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"
                  )}>
                    <History size={18} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{log.action}</span>
                      <span className="text-[9px] font-bold text-[var(--muted)]">•</span>
                      <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">{auditTime(log)?.toLocaleString() || ''}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-600 truncate">{auditDescription(log)}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <User size={10} className="text-[var(--muted)]" />
                        <span className="text-[9px] font-bold text-[var(--muted)]">{log.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Building size={10} className="text-[var(--muted)]" />
                        <span className="text-[9px] font-bold text-[var(--muted)]">{log.workspaceId}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-2 rounded-lg transition-all",
                      expandedId === log.id ? "bg-slate-200" : "bg-slate-100"
                    )}>
                      {expandedId === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === log.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Operation Metadata</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                                <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Audit ID</span>
                                <span className="text-[9px] font-mono text-slate-600">{log.id}</span>
                              </div>
                              <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                                <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Actor UID</span>
                                <span className="text-[9px] font-mono text-slate-600">{log.userId}</span>
                              </div>
                              <div className="flex justify-between py-1.5 border-b border-dashed border-slate-100">
                                <span className="text-[9px] font-bold text-[var(--muted)] uppercase">Environment</span>
                                <span className="text-[9px] font-bold text-slate-600">PRODUCTION</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            {renderDiff(log.before, log.after)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
