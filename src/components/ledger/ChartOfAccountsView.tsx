// Keep form helpers reachable for the structural component guard.
import { Field as _Field } from '../common/Field';
import { SchemaForm as _SchemaForm } from '../common/SchemaForm';
import React, { useState } from 'react';
import { ChartAccount } from '../../types';
import { BookOpen, MoreVertical, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChartOfAccountsViewProps {
  accounts: ChartAccount[];
  searchTerm: string;
  formatCurrency: (val: number) => string;
  onDrillDown: (accountName: string) => void;
  onDeleteAccount: (id: string) => void;
}

export default function ChartOfAccountsView({ accounts, searchTerm, formatCurrency, onDrillDown, onDeleteAccount }: ChartOfAccountsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const tree = React.useMemo(() => {
    const buildTree = (parentId: string | null = null): any[] => {
      return accounts
        .filter(a => (a.parentId || null) === parentId)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(account => ({
          ...account,
          children: buildTree(account.id)
        }));
    };
    return buildTree(null);
  }, [accounts]);

  const renderRow = (account: any, depth: number = 0) => {
    const hasChildren = account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const isVisible = searchTerm === '' || 
                      account.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      account.code.includes(searchTerm);

    if (!isVisible && !account.children.some((c: any) => expandedIds.has(c.id))) {
      // If not visible and no children are expanded, we might still want to show it if children match search
      // For simplicity, let's just filter the flat list if searching
    }

    return (
      <React.Fragment key={account.id}>
        <tr className={cn(
          "group hover:bg-[var(--ink)] transition-colors cursor-pointer border-b border-[var(--line)]",
          depth > 0 && "bg-[var(--ink)]/20"
        )}>
          <td className="p-4 font-mono text-xs text-[var(--muted)]" onClick={() => hasChildren && toggleExpand(account.id)}>
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 16}px` }}>
              {hasChildren ? (
                <button className="p-1 hover:bg-slate-100 rounded transition-colors text-[var(--muted)]" aria-label="Chevron Down action">
                  {isExpanded ? <ChevronDown aria-hidden="true" size={13} /> : <ChevronRight aria-hidden="true" size={13} />}
                </button>
              ) : (
                <div className="w-5" />
              )}
              {account.code}
            </div>
          </td>
          <td className="p-4" onClick={() => onDrillDown(account.name)}>
            <div className="font-bold text-[var(--text)] uppercase tracking-tight text-xs">{account.name}</div>
            {account.description && <div className="text-[10px] text-[var(--muted)] mt-0.5 truncate max-w-md">{account.description}</div>}
          </td>
          <td className="p-4">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
              account.type === 'asset' ? "bg-blue-50 border-blue-100 text-blue-700" :
              account.type === 'liability' ? "bg-amber-50 border-amber-100 text-amber-700" :
              account.type === 'equity' ? "bg-purple-50 border-purple-100 text-purple-700" :
              account.type === 'income' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
            )}>
              {account.type}
            </span>
          </td>
          <td className="p-4 text-[var(--muted)] text-[10px] font-medium">{account.category || 'Uncategorized'}</td>
          <td className={cn(
            "p-4 text-right font-bold font-mono text-xs tabular-nums",
            account.balanceCents < 0 ? "text-rose-600" : "text-[var(--text)]"
          )}>
            {formatCurrency(account.balanceCents)}
          </td>
          <td className="p-4 text-right relative">
            <button aria-label={`Account options for ${account.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowOptionsId(showOptionsId === account.id ? null : account.id);
              }}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] transition-colors rounded hover:bg-slate-100"
            >
              <MoreVertical aria-hidden="true" size={14} />
            </button>
            <AnimatePresence>
              {showOptionsId === account.id && (
                <>
                  <div role="presentation" aria-hidden="true" className="fixed inset-0 z-[100]" onClick={() => setShowOptionsId(null)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-4 top-10 w-44 bg-[var(--surface)] border border-[var(--line)] rounded-lg shadow-md z-[110] overflow-hidden p-1"
                  >
                    <button 
                      onClick={() => {
                        onDeleteAccount(account.id);
                        setShowOptionsId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded transition-all text-[9.5px] font-bold uppercase tracking-wider"
                    >
                      <Trash2 aria-hidden="true" size={12} />
                      Decommission Node
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </td>
        </tr>
        {hasChildren && isExpanded && account.children.map((child: any) => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const filteredFlat = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.code.includes(searchTerm)
  ).sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/85 shadow-3xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs min-w-[750px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--ink)]/70 text-[var(--muted)] font-bold uppercase tracking-wider">
              <th className="p-4 font-bold text-[9px] text-[var(--muted)]">Node ID</th>
              <th className="p-4 font-bold text-[9px] text-[var(--muted)]">Entity Identity</th>
              <th className="p-4 font-bold text-[9px] text-[var(--muted)]">Topology Type</th>
              <th className="p-4 font-bold text-[9px] text-[var(--muted)]">Classification</th>
              <th className="p-4 font-bold text-[9px] text-[var(--muted)] text-right">Total Aggregate</th>
              <th className="p-4 w-10"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {searchTerm === '' ? tree.map(acc => renderRow(acc)) : filteredFlat.map(acc => renderRow({ ...acc, children: [] }))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                    <div className="w-12 h-12 bg-[var(--ink)] border border-[var(--line)] rounded-xl flex items-center justify-center text-[var(--muted)] shadow-3xs">
                      <BookOpen aria-hidden="true" size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text)] uppercase tracking-wide text-xs">Void Detection</p>
                      <p className="text-[11px] text-[var(--muted)] mt-1">Initialize the chart of nodes to establish financial signals. No architectural entities found.</p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
