import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Filter, DollarSign, Calendar, Tag, Shield, Building, FolderKanban, HelpCircle, Save, Sparkles, ChevronDown } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useSavedViewsStore } from '../../stores/useSavedViewsStore';
import { formatCurrency } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface DeepSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  onSaveAsView?: () => void;
}

const SEARCH_OPERATORS = [
  { prefix: 'amount:', description: 'Amount operator e.g. amount:>500 or amount:100..500', icon: DollarSign },
  { prefix: 'payee:', description: 'Vendor or payee name e.g. payee:Apple', icon: Building },
  { prefix: 'type:', description: 'Transaction type e.g. type:expense or type:income', icon: Filter },
  { prefix: 'account:', description: 'Account name or code e.g. account:Checking', icon: WalletIcon },
  { prefix: 'tag:', description: 'Tag or tax flag e.g. tag:tax', icon: Tag },
  { prefix: 'status:', description: 'Status e.g. status:posted or status:pending', icon: Shield },
  { prefix: 'project:', description: 'Project code or name e.g. project:Alpha', icon: FolderKanban },
];

function WalletIcon(props: any) {
  return <Building {...props} />;
}

export default function DeepSearchBar({ value, onChange, placeholder = "Deep search ledger... (e.g. amount:>500 payee:Apple type:expense)", className, onSaveAsView }: DeepSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const projects = useLedgerStore(s => s.projects);
  const vendors = useLedgerStore(s => s.vendors);
  const customers = useLedgerStore(s => s.customers);

  // Live match calculation
  const searchLower = value.trim().toLowerCase();
  const searchMetrics = useMemo(() => {
    if (!searchLower) return { count: transactions.length, totalMoneyCents: 0 };

    let count = 0;
    let totalCents = 0;

    transactions.forEach(t => {
      if (!t) return;
      const desc = (t.description || '').toLowerCase();
      const payee = (t.payee || '').toLowerCase();
      const proj = (t.project || '').toLowerCase();
      const amtStr = (t.totalAmountCents / 100).toString();

      // Basic operator checking in query
      if (searchLower.includes('amount:>')) {
        const val = parseFloat(searchLower.split('amount:>')[1]);
        if (!isNaN(val) && Math.abs(t.totalAmountCents / 100) <= val) return;
      }
      if (searchLower.includes('type:expense') && t.totalAmountCents > 0) return;
      if (searchLower.includes('type:income') && t.totalAmountCents < 0) return;

      const matchesText = desc.includes(searchLower) || payee.includes(searchLower) || proj.includes(searchLower) || amtStr.includes(searchLower);
      
      if (matchesText || searchLower.includes('amount:>') || searchLower.includes('type:')) {
        count++;
        totalCents += Math.abs(t.totalAmountCents || 0);
      }
    });

    return { count, totalMoneyCents: totalCents };
  }, [value, transactions]);

  const handleAppendOperator = (prefix: string) => {
    const nextVal = value ? `${value.trim()} ${prefix}` : prefix;
    onChange(nextVal);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div 
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-2 bg-[var(--surface-card)] border rounded-xl shadow-xs transition-all",
          isFocused 
            ? "border-[var(--brass)] ring-2 ring-[var(--brass)]/20 shadow-md bg-[var(--surface-elevated)]" 
            : "border-[var(--line)] hover:border-[var(--line-strong)]"
        )}
      >
        <Search size={16} className={cn("shrink-0 transition-colors", isFocused ? "text-[var(--brass)]" : "text-[var(--muted)]")} />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className="w-full text-xs font-medium bg-transparent text-[var(--text)] placeholder-[var(--muted)] outline-none"
        />

        {value && (
          <button
            onClick={() => onChange('')}
            className="p-1 text-[var(--muted)] hover:text-[var(--text)] rounded-md hover:bg-[var(--line)]/50 transition-colors"
          >
            <X size={14} />
          </button>
        )}

        {/* Live Money Result Badge */}
        {value.trim() && (
          <div className="flex items-center gap-2 pl-2 border-l border-[var(--line)] shrink-0">
            <span className="text-[11px] font-bold text-[var(--brass)] bg-[var(--brass)]/15 px-2 py-0.5 rounded-md">
              ${formatCurrency(searchMetrics.totalMoneyCents / 100)}
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono">
              ({searchMetrics.count} found)
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowHelper(!showHelper)}
          title="Search Operator Guide"
          className={cn(
            "p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 border",
            showHelper 
              ? "bg-[var(--brass)]/20 border-[var(--brass)] text-[var(--brass)]" 
              : "bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
          )}
        >
          <HelpCircle size={14} />
        </button>
      </div>

      {/* Operator Cheat Sheet & Quick Pills Drawer */}
      {showHelper && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 p-4 bg-[var(--surface-card)] border border-[var(--brass)]/50 rounded-2xl shadow-xl space-y-3 animate-in fade-in duration-150 text-[var(--text)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
            <span className="text-xs font-bold text-[var(--brass)] flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>Deep Search Operators</span>
            </span>
            <button 
              onClick={() => setShowHelper(false)}
              className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              Close
            </button>
          </div>

          <p className="text-[11px] text-[var(--muted)]">
            Click any operator chip below to append it to your query string:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {SEARCH_OPERATORS.map((op) => {
              const OpIcon = op.icon;
              return (
                <button
                  key={op.prefix}
                  onClick={() => handleAppendOperator(op.prefix)}
                  className="flex items-center gap-2 p-2 text-left bg-[var(--surface-elevated)] border border-[var(--line)] hover:border-[var(--brass)] rounded-xl transition-all cursor-pointer group"
                >
                  <div className="p-1.5 bg-[var(--brass)]/10 text-[var(--brass)] rounded-lg group-hover:bg-[var(--brass)] group-hover:text-black transition-colors">
                    <OpIcon size={13} />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-[var(--text)]">{op.prefix}</div>
                    <div className="text-[10px] text-[var(--muted)] truncate max-w-[160px]">{op.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preset Quick Searches */}
          <div className="pt-2 border-t border-[var(--line)] flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Presets:</span>
            
            <button
              onClick={() => onChange('amount:>1000 type:expense')}
              className="text-[10px] px-2.5 py-1 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--brass)] rounded-lg font-mono text-[var(--text-secondary)]"
            >
              amount:&gt;1000 type:expense
            </button>

            <button
              onClick={() => onChange('tag:tax type:expense')}
              className="text-[10px] px-2.5 py-1 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--brass)] rounded-lg font-mono text-[var(--text-secondary)]"
            >
              tag:tax type:expense
            </button>

            <button
              onClick={() => onChange('account:Checking status:pending')}
              className="text-[10px] px-2.5 py-1 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--brass)] rounded-lg font-mono text-[var(--text-secondary)]"
            >
              account:Checking status:pending
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
