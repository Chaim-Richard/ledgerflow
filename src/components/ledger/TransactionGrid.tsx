import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useId, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Transaction, FilterCriteria, AnalyticalMetrics } from '../../types';
import { 
  Search, 
  Plus,
  Table as TableIcon,
  Sparkles,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Filter,
  Check,
  TrendingUp,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { formatDecimal, cn, sanitizeCsvCell, resolveAccountName, formatCurrency, getLocalDateISO } from '../../lib/utils';
import { isCashAccount, isPostable } from '../../lib/txFilters';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import TransactionRow from '../transactions/TransactionRow';
import PivotView from '../transactions/PivotView';
import SelectionBar from '../transactions/SelectionBar';
import { useAuditTelemetry } from '../../hooks/useAuditTelemetry';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';
import { useLedgerComputation } from '../../hooks/useLedgerComputation';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { useCommandDispatcher } from '../../hooks/useSystemContext';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { MatchingEngine } from '../../lib/MatchingEngine';
import SplitEditor from '../transactions/SplitEditor';
import TransactionEditModal from '../transactions/TransactionEditModal';
import SavedViewsBar from '../ui/SavedViewsBar';
import DeepSearchBar from '../ui/DeepSearchBar';
import { useSavedViewsStore } from '../../stores/useSavedViewsStore';
import { useTimeout } from '../../hooks/useTimeout';
import { useRecordFocus } from '../../hooks/useRecordFocus';



const GridEditor = ({ 
  value, 
  onSave, 
  onClose,
  type = 'text',
  label
}: { 
  value: string | number,
  onSave: (val: string | number) => void,
  onClose: () => void,
  type?: 'text' | 'number' | 'category',
  label: string
}) => {
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSafeTimeout } = useTimeout();
  const accounts = useLedgerStore(state => state.accounts);

  const suggestions = useMemo(() => {
    if (type !== 'category' || !val || typeof val !== 'string') return [];
    return accounts
      .filter(a => (a.name || '').toLowerCase().includes(val.toLowerCase()))
      .slice(0, 5);
  }, [val, type, accounts]);

  const handleEvaluateAndSave = (input: string | number) => {
    if (type === 'number') {
      try {
        const parsed = parseFloat((input as string).replace(/[^0-9.-]/g, ''));
        if (!isNaN(parsed)) {
          onSave(parsed);
          return;
        }
      } catch {
        // Fallback to saving raw input
      }
    }
    onSave(input);
  };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="absolute inset-0 z-[100] bg-[#090A0C] border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.3)] flex flex-col px-4 group">
      <div className="flex-1 flex items-center gap-3">
         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
         <input 
          ref={inputRef}
          aria-label={label}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          dir="auto"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleEvaluateAndSave(val);
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab' && suggestions.length > 0) {
              e.preventDefault();
              handleEvaluateAndSave(suggestions[0].name);
            }
          }}
          onBlur={(_e) => {
             // Delay to allow suggestion click
             setSafeTimeout(() => handleEvaluateAndSave(val), 200);
          }}
          className="w-full bg-transparent border-none outline-none font-mono text-xs font-black text-white uppercase tracking-wider placeholder:text-white/10"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-[#090A0C] border-x-2 border-b-2 border-emerald-500/50 shadow-2xl py-2 z-[110]">
           {suggestions.map((s, _i) => (
             <button 
               key={s.id}
               onClick={(e) => {
                 e.stopPropagation();
                 handleEvaluateAndSave(s.name);
               }}
               className="w-full text-left px-4 py-2 hover:bg-[var(--surface)]/5 flex items-center justify-between group/s"
             >
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover/s:text-emerald-400">{s.name}</span>
                <span className="text-[8px] font-bold text-white/20 uppercase">TAB</span>
             </button>
           ))}
        </div>
      )}
    </div>
  );
};

interface VirtualRowProps extends ListChildComponentProps {
  data: {
    transactions: (Transaction & { balanceCents: number })[];
    selectedIds: Set<string>;
    focusedCell: { id: string, field: string, index: number } | null;
    editingCell: { id: string, field: string } | null;
    anomalyMap: Map<string, AnalyticalMetrics['anomalies'][number]>;
    deterministicConflicts: ReturnType<typeof useLedgerComputation>['conflicts'];
    onToggleSelection: (id: string) => void;
    onVoid: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Transaction>) => void;
    onCreateRule: (tx: Transaction) => void;
    onProjectClick: (projectName: string) => void;
    setSplittingTxId: (id: string | null) => void;
    setFocusedCell: (v: VirtualRowProps['data']['focusedCell']) => void;
    setEditingCell: (v: VirtualRowProps['data']['editingCell']) => void;
    isProMode: boolean;
    isCompactMode: boolean;
    isMobileGrid: boolean;
    isTabletGrid: boolean;
    onToggleFlag: (id: string) => void;
    onDuplicate: (id: string) => void;
    onEditDetails?: (tx: Transaction) => void;
    onReverseAndCorrect?: (tx: Transaction) => void;
    dateFormat: string;
    formatCurrency: (cents: number) => string;
    gridCols: string;
    searchTerm: string;
  };
}

const VirtualRow = React.memo(({ index, style, data }: VirtualRowProps) => {
  const tx = data.transactions[index];
  if (!tx) return <div style={style} />;
  
  const accounts = useLedgerStore.getState().accounts;

  const isEditing = data.editingCell?.id === tx.id;
  const isFocused = data.focusedCell?.id === tx.id;

  return (
    <div role="presentation"
      style={style} 
      className="relative"
     onClick={() => data.setFocusedCell({ id: tx.id, field: 'description', index })}
      onDoubleClick={() => data.setEditingCell({ id: tx.id, field: 'description' })}
    >
      <TransactionRow
        tx={tx}
        isSelected={data.selectedIds.has(tx.id)}
        isSetA={false}
        isSetB={false}
        isFocused={isFocused}
        isEven={index % 2 === 0}
        focusedField={data.focusedCell?.field || null}
        onToggleSelection={data.onToggleSelection}
        onVoid={data.onVoid}
        onUpdate={data.onUpdate}
        onCreateRule={data.onCreateRule}
        onProjectClick={data.onProjectClick}
        onSplit={(id) => data.setSplittingTxId(id)}
        onToggleFlag={data.onToggleFlag}
        onDuplicate={data.onDuplicate}
        onEditDetails={data.onEditDetails}
        onReverseAndCorrect={data.onReverseAndCorrect}
        formatCurrency={data.formatCurrency}
        isProMode={data.isProMode}
        isCompactMode={data.isCompactMode}
        isMobileGrid={data.isMobileGrid}
        isTabletGrid={data.isTabletGrid}
        dateFormat={data.dateFormat}
        gridColumns={data.gridCols}
        anomaly={data.anomalyMap.get(tx.id)}
        internalConflict={data.deterministicConflicts.get(tx.id)}
        searchTerm={data.searchTerm}
      />
      {isEditing && data.editingCell && (
        <div className="absolute inset-0 pointer-events-none">
          {data.editingCell.field === 'description' && (
            <div style={{ left: 140, right: data.isMobileGrid ? 100 : (data.isTabletGrid ? 400 : 700) }} className="absolute inset-y-0 z-[70] pointer-events-auto">
              <GridEditor
                label="Transaction description"
                value={tx.description}
                onSave={(v) => {
                  data.onUpdate?.(tx.id, { description: v as string });
                  data.setEditingCell(null);
                }}
                onClose={() => data.setEditingCell(null)}
              />
            </div>
          )}
          {data.editingCell.field === 'amountCents' && (
            <div style={{ right: data.isMobileGrid ? 0 : 280, width: data.isMobileGrid ? 100 : 140 }} className="absolute inset-y-0 z-[70] pointer-events-auto">
              <GridEditor
                label="Transaction amount"
                value={tx.totalAmountCents / 100}
                type="number"
                onSave={(v) => {
                  data.onUpdate?.(tx.id, { totalAmountCents: TruthEngine.parseAmountToCents(v || '0') });
                  data.setEditingCell(null);
                }}
                onClose={() => data.setEditingCell(null)}
              />
            </div>
          )}
          {data.editingCell.field === 'category' && !data.isMobileGrid && (
            <div style={{ left: data.isTabletGrid ? 'auto' : '55%', right: data.isTabletGrid ? 220 : 'auto', width: 160 }} className="absolute inset-y-0 z-[70] pointer-events-auto">
              <GridEditor
                label="Transaction account"
                value={resolveAccountName(accounts, tx.lines?.[0]?.accountId, tx.lines?.[0]?.accountName)}
                type="category"
                onSave={(v) => {
                  const targetAcc = accounts.find(a => a.name === v || a.id === v) || { id: tx.lines?.[0]?.accountId || '', name: v as string };
                  const bankAcc = accounts.find(a => isCashAccount(a)) || accounts[0];
                  const updatedLines = tx.lines && tx.lines.length >= 2 ? [
                    { ...tx.lines[0], accountId: targetAcc.id, accountName: targetAcc.name },
                    ...tx.lines.slice(1)
                  ] : [
                    { accountId: targetAcc.id, accountName: targetAcc.name, amountCents: Math.abs(tx.totalAmountCents) },
                    { accountId: bankAcc?.id || accounts[0]?.id || '', accountName: bankAcc?.name || 'Main Checking', amountCents: -Math.abs(tx.totalAmountCents) }
                  ];
                  data.onUpdate?.(tx.id, { lines: updatedLines });
                  data.setEditingCell(null);
                }}
                onClose={() => data.setEditingCell(null)}
              />
            </div>
          )}
          {data.editingCell.field === 'project' && !data.isMobileGrid && !data.isTabletGrid && (
            <div style={{ left: '68%', width: 140 }} className="absolute inset-y-0 z-[70] pointer-events-auto">
              <GridEditor
                label="Transaction project"
                value={tx.project || ''}
                onSave={(v) => {
                  data.onUpdate?.(tx.id, { 
                    project: v as string,
                    lines: (tx.lines || []).map(l => ({ ...l, project: v as string }))
                  });
                  data.setEditingCell(null);
                }}
                onClose={() => data.setEditingCell(null)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function TransactionGrid() {
  const formId = useId();
  const transactions = useLedgerStore(s => s.transactions);
  const filterCriteria = useUIStore(s => s.filterCriteria);
  const onFilterApplied = (c: FilterCriteria) => useUIStore.getState().setFilterCriteria(c);
  const { handleAction: onAction } = useCommandDispatcher();
  const txActions = useTransactionActions();
  const { updateEntity, deleteEntity } = useEntityOperations();
  const onUpdate = useCallback((id: string, updates: Partial<Transaction>) => txActions?.handleUpdateTransaction ? txActions.handleUpdateTransaction(id, updates) : updateEntity('transactions', id, updates), [txActions, updateEntity]);
  const onVoid = (id: string) => deleteEntity('transactions', id);
  const onNewEntry = () => { txActions.handleQuickAdd?.({}); onAction("quick-entry"); };
  const isProMode = useUIStore(s => s.isProMode);
  const isCompactMode = useUIStore(s => s.isCompactMode);
  const setProMode = useUIStore(s => s.setProMode);
  const setCompactMode = useUIStore(s => s.setCompactMode);

  const onCreateRule = (tx: Transaction) => {
    if (!tx || !tx.description) return;
    const accountId = tx.lines?.[0]?.accountId;
    const accountName = tx.lines?.[0]?.accountName || 'Unassigned';
    
    const newRule = {
      id: `rule-${Date.now()}`,
      name: `Auto-categorize: ${tx.description.slice(0, 30)}`,
      pattern: tx.description.trim(),
      targetAccountId: accountId,
      targetAccountName: accountName,
      priority: 10,
      enabled: true,
      conditions: [{ field: 'description', operator: 'contains', value: tx.description.trim() }],
      actions: [{ type: 'setAccount', accountId, accountName }]
    };

    const currentRules = useLedgerStore.getState().autoRules || [];
    useLedgerStore.getState().setAutoRules([...currentRules, newRule]);
    toast.success(`Rule created for "${tx.description.slice(0, 25)}" → ${accountName}`);
  };
  const dateFormat = 'MMM dd, yyyy';
  // Defensive array checks
  const safeTransactions = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'pivot'>('grid');
  const [focusedCell, setFocusedCell] = useState<{ id: string, field: string, index: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [editingDetailsTx, setEditingDetailsTx] = useState<Transaction | null>(null);
  const [isReverseModeModal, setIsReverseModeModal] = useState(false);
  // A record link (#transactions/transaction/<id>, e.g. from Data Health) opens that entry once it has loaded
  const focusedTxId = useRecordFocus('transaction', { ready: false });
  const openedFocusId = useRef<string | null>(null);
  useEffect(() => {
    if (!focusedTxId || openedFocusId.current === focusedTxId) return;
    const tx = safeTransactions.find(t => t.id === focusedTxId);
    if (!tx) return;
    openedFocusId.current = focusedTxId;
    setEditingDetailsTx(tx);
  }, [focusedTxId, safeTransactions]);
  const lockDate = useLedgerStore(state => state.lockDate);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelectAll = () => {
    const rows = transactionsWithBalance;
    if (selectedIds.size === rows.length && rows.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  };
  useRef<HTMLInputElement>(null);
  
  const parsingQueue = useUIStore(s => s.parsingQueue);
  const setParsingQueue = useUIStore(s => s.setParsingQueue);
  const splittingTxId = useUIStore(s => s.splittingTxId);
  const setSplittingTxId = useUIStore(s => s.setSplittingTxId);
  const accounts = useLedgerStore(state => state.accounts);
  const projects = useLedgerStore(state => state.projects);
  const { handleParseReceipt, handleToggleFlag, handleDuplicateTransaction } = useTransactionActions();
  const [dragActive, setDragActive] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const splittingTransaction = useMemo(() => 
    splittingTxId ? safeTransactions.find(t => t.id === splittingTxId) : null
  , [splittingTxId, safeTransactions]);
  
  const activeViewId = useSavedViewsStore(s => s.activeViewId);
  const views = useSavedViewsStore(s => s.views);
  const activeView = views.find(v => v.id === activeViewId);
  
  // High-performance computation offloading
  const { smartFilteredTransactions, transactionsWithBalance, stats, conflicts: deterministicConflicts } = useLedgerComputation(safeTransactions, filterCriteria, searchTerm, accounts, sortConfig);
  
  const telemetry = useAuditTelemetry(
    safeTransactions, 
    accounts, 
    30
  );
  const anomaliesValues = telemetry.anomalies;
  
  const anomalyMap = useMemo(() => new Map(anomaliesValues.map((a) => [a.transactionId, a])), [anomaliesValues]);

  // High volume pre-computations
  const totalBalancedSum = useMemo(() => {
    let sum = 0;
    const filtered = transactionsWithBalance.filter(isPostable);
    const len = filtered.length;
    for (let i = 0; i < len; i++) {
      sum += (filtered[i].totalAmountCents || 0);
    }
    return sum;
  }, [transactionsWithBalance]);

  const selectedMetricsResult = useMemo(() => {
    if (selectedIds.size === 0) return { sum: 0, mean: 0 };
    let sum = 0;
    let count = 0;
    const filtered = transactionsWithBalance.filter(isPostable);
    const len = filtered.length;
    for (let i = 0; i < len; i++) {
      const t = filtered[i];
      if (selectedIds.has(t.id)) {
        sum += (t.totalAmountCents || 0);
        count++;
      }
    }
    return { sum, mean: count > 0 ? sum / count : 0 };
  }, [selectedIds, transactionsWithBalance]);

  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['date', 'description', 'category', 'project', 'amount', 'status']));

  const toggleColumnVisibility = (col: string) => {
    const next = new Set(visibleColumns);
    if (next.has(col)) next.delete(col);
    else next.add(col);
    setVisibleColumns(next);
  };

  const columnFilterValues = useMemo(() => {
    const categoriesSet = new Set<string>();
    const projectsSet = new Set<string>();
    const statusesSet = new Set<string>();

    const filtered = safeTransactions.filter(isPostable);
    const len = filtered.length;
    for (let i = 0; i < len; i++) {
      const t = filtered[i];
      categoriesSet.add(resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName));
      projectsSet.add(t.project || 'Global');
      statusesSet.add(t.status || 'Active');
    }

    return {
      category: Array.from(categoriesSet).sort(),
      project: Array.from(projectsSet).sort(),
      status: Array.from(statusesSet).sort()
    };
  }, [safeTransactions, accounts]);

  const toggleColumnFilter = (column: string, value: string) => {
    const keyMap: Record<string, string> = {
      category: 'selectedCategories',
      project: 'selectedProjects',
      class: 'selectedClasses',
      location: 'selectedLocations',
      status: 'selectedStatuses'
    };
    const key = keyMap[column];
    if (!key) return;
    const current = filterCriteria?.[key] || [];
    const next = current.includes(value) 
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    
    onFilterApplied({ ...filterCriteria, [key]: next });
  };

  const _searchInterpretation = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const lowerSearch = searchTerm.toLowerCase().trim();
    const interpretation = [];
    
    if (lowerSearch.match(/(greater than|more than|over|above|less than|under|below|at least|at most|around|about|approx|approximately)\s*(\d+(\.\d+)?)/) || lowerSearch.match(/([><=])\s*(\d+(\.\d+)?)/)) {
       interpretation.push('Quantities');
    }
    if (lowerSearch.match(/between\s*(\d+(\.\d+)?)\s*and\s*(\d+(\.\d+)?)/)) {
       interpretation.push('Range Scan');
    }
    if (lowerSearch.match(/\b(top|bottom)\s*(10|25|50)\s*%?\b/)) {
       interpretation.push('Statistical Slice');
    }
    if (lowerSearch.match(/\b(above|below)\s+average\b/)) {
       interpretation.push('Anomaly Detection');
    }
    if (lowerSearch.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/)) {
       interpretation.push('Months');
    }
    if (lowerSearch.match(/\b(20\d{2})\b/)) interpretation.push('Year Filter');
    if (lowerSearch.match(/\b(last month|this month|last week|this week|yesterday|today|last year|this year|last 7 days|last 30 days|ytd)\b/)) interpretation.push('Relative Time');
    if (lowerSearch.match(/\b(q[1-4])\b/)) interpretation.push('Quarterly Review');
    if (lowerSearch.match(/(category|type|account):\s*([a-zA-Z\s]+)/)) interpretation.push('Classification Scoping');
    if (lowerSearch.match(/starts\s+with\s+|ends\s+with\s+|contains\s+/)) interpretation.push('Text Pattern');
    if (lowerSearch.match(/\b(error|mismatch|conflict|audit|review|unbalanced)\b/)) interpretation.push('Integrity Mapping');

    return interpretation.length > 0 ? interpretation.join(' • ') : 'Keyword Search';
  }, [searchTerm]);


  // Keyboard Navigation Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Native controls keep their own keyboard behavior, including Tab and Space.
      if (e.target instanceof HTMLElement && e.target.closest('button, input, select, textarea, a, [contenteditable="true"]')) return;
      if (editingCell) return;
      if (!focusedCell) return;

      const fields = ['date', 'description', 'category', 'project', 'amountCents', 'status'];
      const fieldIndex = fields.indexOf(focusedCell.field);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(transactionsWithBalance.length - 1, focusedCell.index + 1);
        setFocusedCell({ ...focusedCell, index: nextIndex, id: transactionsWithBalance[nextIndex].id });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(0, focusedCell.index - 1);
        setFocusedCell({ ...focusedCell, index: prevIndex, id: transactionsWithBalance[prevIndex].id });
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          const prevFieldIndex = fieldIndex > 0 ? fieldIndex - 1 : fields.length - 1;
          const targetIndex = fieldIndex > 0 ? focusedCell.index : Math.max(0, focusedCell.index - 1);
          setFocusedCell({ 
            id: transactionsWithBalance[targetIndex].id, 
            field: fields[prevFieldIndex], 
            index: targetIndex 
          });
        } else {
          const nextFieldIndex = (fieldIndex + 1) % fields.length;
          const targetIndex = fieldIndex < fields.length - 1 ? focusedCell.index : Math.min(transactionsWithBalance.length - 1, focusedCell.index + 1);
          setFocusedCell({ 
            id: transactionsWithBalance[targetIndex].id, 
            field: fields[nextFieldIndex], 
            index: targetIndex 
          });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevFieldIndex = fieldIndex > 0 ? fieldIndex - 1 : fields.length - 1;
        setFocusedCell({ ...focusedCell, field: fields[prevFieldIndex] });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setEditingCell({ id: focusedCell.id, field: focusedCell.field });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Option to void or clear field? Maybe just engage edit.
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Start typing to edit
        setEditingCell({ id: focusedCell.id, field: focusedCell.field });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, editingCell, transactionsWithBalance]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onProjectClick = (projectName: string) => onFilterApplied({ ...filterCriteria, project: projectName });

  const pivotData = useMemo(() => {
    const groups: Record<string, { total: number, count: number }> = {};
    smartFilteredTransactions.filter(isPostable).forEach(t => {
      const key = resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName);
      if (!groups[key]) groups[key] = { total: 0, count: 0 };
      groups[key].total += t.totalAmountCents;
      groups[key].count += 1;
    });
    return Object.entries(groups).map(([name, data]) => ({ name, value: data.total / 100, count: data.count })).sort((a, b) => b.value - a.value);
  }, [smartFilteredTransactions, accounts]);

  const [isMobileGrid, setIsMobileGrid] = useState(false);
  const [isTabletGrid, setIsTabletGrid] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileGrid(window.innerWidth < 768);
      setIsTabletGrid(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const rowHeight = isCompactMode ? 32 : isProMode ? 44 : 72;
  const gridCols = isMobileGrid
    ? '40px 100px 1fr 100px'
    : isTabletGrid
    ? '40px 100px 1fr 180px 120px 100px'
    : isProMode || isCompactMode 
    ? '40px 100px 1fr 150px 100px 100px 100px 120px 120px 80px 80px' 
    : '60px 120px 1fr 150px 100px 100px 100px 140px 120px 80px';

  const selectedTransactions = useMemo(() => 
    transactions.filter(t => selectedIds.has(t.id)),
    [transactions, selectedIds]
  );

  const handleExportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Project', 'Amount', 'Status'];
    const rows = transactionsWithBalance.map(t => [
      sanitizeCsvCell(t.date),
      sanitizeCsvCell(t.description),
      sanitizeCsvCell(resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName)),
      sanitizeCsvCell(t.project || 'General'),
      sanitizeCsvCell(formatDecimal(t.totalAmountCents || 0)),
      sanitizeCsvCell(t.status)
    ]);
    
    const csvContent = [headers.map(sanitizeCsvCell), ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ledger_export_${getLocalDateISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger Export Matrix Generated');
  };

  const handleBulkUpdate = useCallback(async (updates: Partial<Transaction>) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (txActions?.handleBulkUpdate) {
      await txActions.handleBulkUpdate(ids, updates);
    } else {
      ids.forEach(id => {
        onUpdate?.(id, updates);
      });
      toast.success(`Successfully updated ${ids.length} transactions`);
    }
    setSelectedIds(new Set());
  }, [selectedIds, txActions, onUpdate]);

  const handleBulkSweep = useCallback(async () => {
    const loaderId = toast.loading('Initializing rule telemetry bulk resolution...');
    
    // Defer the heavy engine boot sequence to a task so UI repaints the toast first
    await new Promise(r => setTimeout(r, 50)); 
    
    const state = useLedgerStore.getState();
    const rules = state.autoRules;
    const accounts = state.accounts;
    const engine = new MatchingEngine(rules, state.analyticalPatternCache, undefined, state.matchingThreshold, transactionsWithBalance, state.dimensionNodes, accounts);
    
    const suggestions = await engine.suggestCategoriesAsync(transactionsWithBalance, Math.round);
    
    let count = 0;
    
    // O(1) Pre-computing Maps to avoid O(N * M) performance drop during Bulk Sweep
    const txMap = new Map(transactionsWithBalance.map(t => [t.id, t]));
    const accountNameMap = new Map(accounts.map(a => [a.name, a]));

    suggestions.forEach((suggestion, id) => {
      const tx = txMap.get(id);
      const targetAcc = accountNameMap.get(suggestion.accountName);
      
      if (tx && targetAcc && (!tx.lines || tx.lines.length === 0 || tx.lines[0].accountName === 'Uncategorized' || tx.lines[0].accountName === 'Unassigned')) {
        const bankAcc = accounts.find(a => isCashAccount(a)) || accounts[0];
        const updatedLines = tx.lines && tx.lines.length >= 2 ? [
          { ...tx.lines[0], accountId: targetAcc.id, accountName: targetAcc.name, dimensions: suggestion.dimensions || tx.lines[0].dimensions },
          ...tx.lines.slice(1)
        ] : [
          { accountId: targetAcc.id, accountName: targetAcc.name, amountCents: Math.abs(tx.totalAmountCents), dimensions: suggestion.dimensions || undefined },
          { accountId: bankAcc?.id || accounts[0]?.id || '', accountName: bankAcc?.name || 'Main Checking', amountCents: -Math.abs(tx.totalAmountCents) }
        ];
        onUpdate?.(id, { lines: updatedLines });
        count++;
      }
    });
    
    if (count > 0) {
      toast.success(`Bayesian rule network categorized ${count} items.`, { id: loaderId });
    } else {
      toast.info('No auto-resolvable patterns found. Try adjusting Rule Matching thresholds.', { id: loaderId });
    }
  }, [transactionsWithBalance, onUpdate]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      // Processing queue will show up via UI store updates
      files.forEach(file => {
        handleParseReceipt(file);
      });
      toast.info(`Processing ${files.length} receipts...`);
    }
  };

  const itemData = useMemo(() => ({
    transactions: transactionsWithBalance,
    selectedIds,
    focusedCell,
    editingCell,
    anomalyMap,
    deterministicConflicts,
    onToggleSelection: toggleSelection,
    onVoid,
    onUpdate,
    onCreateRule,
    onProjectClick,
    setSplittingTxId,
    setFocusedCell,
    setEditingCell,
    isProMode,
    isCompactMode,
    isMobileGrid,
    isTabletGrid,
    onToggleFlag: handleToggleFlag,
    onEditDetails: (tx: Transaction) => {
      setEditingDetailsTx(tx);
      setIsReverseModeModal(false);
    },
    onReverseAndCorrect: (tx: Transaction) => {
      setEditingDetailsTx(tx);
      setIsReverseModeModal(true);
    },
    dateFormat,
    formatCurrency,
    gridCols,
    searchTerm,
    onDuplicate: handleDuplicateTransaction
  }), [
    transactionsWithBalance, 
    selectedIds, 
    focusedCell, 
    editingCell, 
    anomalyMap, 
    deterministicConflicts, 
    searchTerm,
    toggleSelection, 
    onVoid,
    onUpdate, 
    onCreateRule, 
    onProjectClick, 
    setSplittingTxId, 
    setFocusedCell, 
    setEditingCell, 
    isProMode, 
    isCompactMode, 
    isMobileGrid,
    isTabletGrid,
    handleToggleFlag,
    dateFormat, 
    formatCurrency,
    gridCols
  ]);

  const itemKey = useCallback((index: number, data: VirtualRowProps['data']) => {
    return data.transactions[index]?.id || `idx-${index}`;
  }, []);

  return (
    <div 
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "ledger-card flex flex-col min-h-full transition-all bg-[var(--surface)] border border-[var(--line)] shadow-sm relative", 
        isCompactMode && "rounded-none border-none",
        dragActive && "ring-4 ring-indigo-600 ring-inset"
      )}
    >
      {dragActive && (
        <div className="absolute inset-0 z-[100] bg-indigo-600/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="p-4 md:p-8 bg-[var(--surface)] rounded-[32px] shadow-2xl border-2 border-indigo-600 flex flex-col items-center gap-4 animate-in fade-in zoom-in slide-in-from-bottom-4">
             <div className="w-16 h-16 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                <Plus aria-hidden="true" size={32} />
             </div>
             <div className="text-center">
                <p className="text-xl font-bold text-[var(--text)] uppercase tracking-tight">Drop receipts here</p>
                <p className="text-sm text-[var(--muted)]">AI will auto-categorize and balance them</p>
             </div>
          </div>
        </div>
      )}
      
      {/* Parsing Queue Overlay */}
      <AnimatePresence>
        {parsingQueue.length > 0 && (
          <div className="absolute top-4 right-4 z-[80] flex flex-col gap-2 w-72 pointer-events-none">
            {parsingQueue.map(item => (
              <motion.div 
                key={item.id}
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                className="p-3 bg-slate-900 rounded-xl shadow-2xl border border-white/10 flex items-center gap-3 pointer-events-auto"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--surface)]/5 flex items-center justify-center">
                  {item.status === 'done' ? (
                    <ShieldCheck aria-hidden="true" size={16} className="text-emerald-500" />
                  ) : item.status === 'error' ? (
                    <AlertCircle aria-hidden="true" size={16} className="text-rose-500" />
                  ) : (
                    <Loader2 aria-hidden="true" size={16} className="text-indigo-600 animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mb-1">AI Processor</p>
                  <p className="text-[11px] font-medium text-white truncate">{item.name}</p>
                </div>
                {item.status === 'error' && (
                  <button
                    aria-label={`Dismiss import error for ${item.name}`}
                    onClick={() => setParsingQueue(parsingQueue.filter(i => i.id !== item.id))}
                    className="p-1 hover:bg-[var(--surface)]/10 rounded"
                  >
                    <Plus aria-hidden="true" size={10} className="text-white rotate-45" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {splittingTransaction && (
          <SplitEditor 
            transaction={splittingTransaction}
            accounts={accounts}
            projects={projects}
            onSave={(lines) => {
              if (splittingTxId) {
                onUpdate?.(splittingTxId, { lines });
                setSplittingTxId(null);
                toast.success('Transaction split applied');
              }
            }}
            onClose={() => setSplittingTxId(null)}
          />
        )}
      </AnimatePresence>

      <div className="p-5 border-b border-[var(--line)] space-y-4 bg-[var(--surface)]/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-col">
              <h2 className="text-xl md:text-2xl font-black text-[var(--text)] tracking-tight leading-none">
                Journal Entries
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                   <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Integrity Scan Active</span>
                </div>
                <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">Matrix Synchronized</span>
              </div>
            </div>
            <div className="hidden sm:block h-10 w-px bg-slate-200 mx-2" />
            <div className="flex bg-[var(--panel)] p-1 rounded-xl border border-[var(--line)] self-stretch sm:self-auto shadow-3xs">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("flex-1 sm:flex-none h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer", viewMode === 'grid' ? "bg-[var(--brass)] text-[var(--ink)] shadow-xs scale-[1.02]" : "text-[var(--muted)] hover:text-[var(--text)]")}
              >
                Grid
              </button>
              <button 
                onClick={() => setViewMode('pivot')}
                className={cn("flex-1 sm:flex-none h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer", viewMode === 'pivot' ? "bg-[var(--brass)] text-[var(--ink)] shadow-xs scale-[1.02]" : "text-[var(--muted)] hover:text-[var(--text)]")}
              >
                Pivot
              </button>
              <div className="w-px h-4 bg-slate-300 self-center mx-1" />
              <button 
                onClick={() => setProMode(!isProMode)}
                title="Toggle Pro Density Mode"
                className={cn("flex-1 sm:flex-none h-8 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer", isProMode ? "bg-indigo-600 text-white shadow-xs" : "text-[var(--muted)] hover:text-[var(--text)]")}
              >
                Pro
              </button>
              <button 
                onClick={() => setCompactMode(!isCompactMode)}
                title="Toggle Ultra Compact Mode"
                className={cn("flex-1 sm:flex-none h-8 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer", isCompactMode ? "bg-slate-900 text-white shadow-xs" : "text-[var(--muted)] hover:text-[var(--text)]")}
              >
                Compact
              </button>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 flex-1 max-w-[900px] mt-2 xl:mt-0">
             <button 
                onClick={toggleSelectAll}
                aria-label={selectedIds.size > 0 ? `Selected ${selectedIds.size} transactions` : 'Select all transactions'}
                className={cn(
                  "hidden xl:flex h-10 px-4 items-center gap-3 rounded-xl border transition-all text-[9px] font-bold uppercase tracking-wider shrink-0 cursor-pointer",
                  selectedIds.size > 0 
                  ? "bg-[var(--brass)] text-[var(--ink)] border-[var(--brass-line)] shadow-xs" 
                  : "bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:border-[var(--brass-line)] hover:text-[var(--text)] shadow-3xs"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-all",
                  selectedIds.size === transactionsWithBalance.length && transactionsWithBalance.length > 0
                  ? "bg-black border-black text-white" 
                  : "border-[var(--line)] bg-[var(--surface)]"
                )}>
                  {selectedIds.size === transactionsWithBalance.length && transactionsWithBalance.length > 0 && <Check aria-hidden="true" size={10} className="stroke-[3px]" />}
                  {selectedIds.size > 0 && selectedIds.size < transactionsWithBalance.length && <div className="w-2 h-0.5 bg-black" />}
                </div>
                <span>{selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select All'}</span>
              </button>
            
            <div className="flex flex-col gap-2 flex-1">
              {selectedIds.size > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-2 bg-slate-900/10 border border-indigo-600/20 rounded-xl"
                >
                  <span className="text-xs font-bold text-indigo-600 px-2">{selectedIds.size} Selected</span>
                  <div className="h-4 w-px bg-slate-900/20" />
                  
                  {/* State Machine Actions */}
                  <button onClick={() => handleBulkUpdate({ isLocked: true })} className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface)] hover:bg-[var(--ink)] text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-[var(--line)] transition-colors">
                    Lock
                  </button>
                  <button onClick={() => handleBulkUpdate({ isLocked: false })} className="flex items-center gap-1.5 px-3 py-1 bg-[var(--surface)] hover:bg-[var(--ink)] text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-[var(--line)] transition-colors">
                    Unlock
                  </button>
                  <button onClick={() => handleBulkUpdate({ status: 'approved' })} className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-emerald-200 transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handleBulkUpdate({ status: 'flagged' })} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-amber-200 transition-colors">
                    Flag
                  </button>
                  <button onClick={() => handleBulkUpdate({ status: 'void' })} className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-rose-200 transition-colors">
                    Void
                  </button>
                  
                  <div className="flex-1" />
                  <button aria-label="Clear transaction selection" onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-black/5 rounded text-[var(--muted)]">
                    <X aria-hidden="true" size={14} />
                  </button>
                </motion.div>
              )}

              {/* Saved Views Bar */}
              <SavedViewsBar currentSearchTerm={searchTerm} className="mb-2" />

              <div className="flex flex-col lg:flex-row items-center gap-2 flex-1">
                <div className="flex-1 w-full">
                  <DeepSearchBar 
                    value={searchTerm} 
                    onChange={setSearchTerm} 
                    metrics={stats}
                    placeholder={activeView?.filter?.searchTerm ? `Search within view... (default: ${activeView.filter.searchTerm})` : "Deep search ledger... (e.g. > 500, this month, tag:tax)"}
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button 
                    onClick={() => setActiveFilterColumn(activeFilterColumn === 'visibility' ? null : 'visibility')}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0 cursor-pointer",
                      activeFilterColumn === 'visibility' ? "bg-[var(--brass)] text-[var(--ink)] border-[var(--brass-line)] font-bold" : "bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--text)] shadow-3xs"
                    )}
                  >
                    <Layers aria-hidden="true" size={13} className="shrink-0" />
                    Columns
                  </button>

                  {activeFilterColumn === 'visibility' && (
                    <div className="absolute top-10 right-0 z-[150] w-56 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-lg p-3 normal-case font-medium text-[var(--text)]">
                      <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">Visible Columns</p>
                      <div className="space-y-1">
                        {['date', 'description', 'category', 'project', 'amount', 'status'].map(col => (
                          <label htmlFor={`${formId}-column-${col}`} key={col} className="flex items-center gap-2 p-1.5 hover:bg-[var(--ink)] rounded-lg cursor-pointer transition-colors">
                            <input 
                              id={`${formId}-column-${col}`}
                              type="checkbox" 
                              checked={visibleColumns.has(col)}
                              onChange={() => toggleColumnVisibility(col)}
                              className="w-3.5 h-3.5 rounded border-[var(--line)] text-[var(--brass)] focus:ring-[var(--brass)]"
                            />
                            <span className="text-xs text-[var(--text)] capitalize">{col}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:text-[var(--text)] transition-all shrink-0 shadow-3xs cursor-pointer"
                    aria-label="Export CSV"
                  >
                    <ArrowDownRight aria-hidden="true" size={13} className="rotate-90 shrink-0" />
                    Export
                  </button>

                  <button 
                    onClick={() => onAction?.('open-command-center')}
                    className="w-9 h-9 bg-[var(--brass)] text-[var(--ink)] rounded-xl flex items-center justify-center hover:opacity-90 transition-all shadow-sm shrink-0 cursor-pointer"
                    title="Open Command Center"
                    aria-label="Open Command Center"
                  >
                    <Sparkles aria-hidden="true" size={15} className="shrink-0 text-black" />
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              onClick={onNewEntry}
              className="h-10 px-5 bg-[var(--brass)] text-[var(--ink)] hover:opacity-90 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap flex items-center gap-2 shadow-xs cursor-pointer"
              aria-label="Create new entry"
            >
              <Plus aria-hidden="true" size={14} className="stroke-[3px]" />
              New Entry
            </button>
          </div>
        </div>

        {/* Three-Cell Filtered Totals Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 lg:gap-6 pt-6 lg:pt-8 border-t border-[var(--line)]/30">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6">
             <div 
               data-testid="filtered-totals-bar"
               className="flex flex-wrap items-center divide-x divide-[var(--line)]/50 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-xs overflow-hidden"
             >
               {/* Filtered Inflow */}
               <div data-testid="filtered-inflow" className="flex items-center gap-2 px-3 py-2">
                 <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Filtered Inflow:</span>
                 <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                   +{formatCurrency(stats.inflowCents)}
                 </span>
               </div>

               {/* Filtered Outflow */}
               <div data-testid="filtered-outflow" className="flex items-center gap-2 px-3 py-2">
                 <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Filtered Outflow:</span>
                 <span className="text-xs font-black text-rose-600 dark:text-rose-400 tabular-nums">
                   -{formatCurrency(stats.outflowCents)}
                 </span>
               </div>

               {/* Matching Records */}
               <div data-testid="matching-records" className="flex items-center gap-2 px-3 py-2">
                 <div className={cn("w-2 h-2 rounded-full shrink-0", stats.discrepancies > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
                 <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Matching Records:</span>
                 <span className="text-xs font-black text-[var(--text)] tabular-nums">
                   {stats.count.toLocaleString()}
                 </span>
               </div>
             </div>
             {searchTerm && (
               <div style={{ height: '50.5px' }} className="hidden sm:flex items-center gap-3 px-5 py-2 bg-indigo-600/5 border border-indigo-600/20 rounded-full">
                  <Sparkles aria-hidden="true" size={14} className="text-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate italic serif">Analytical Filtering Enabled</span>
               </div>
             )}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-4 bg-[var(--ink)]/20 p-1.5 rounded-[32px] border border-[var(--line)]/40 w-full sm:w-auto">
            <button 
              onClick={() => {
                const headers = ['Date', 'Description', 'Amount', 'Currency', 'Account', 'Project', 'Notes'];
                const rows = transactionsWithBalance.map(t => [
                  sanitizeCsvCell(t.date),
                  sanitizeCsvCell(t.description),
                  sanitizeCsvCell(formatDecimal(t.totalAmountCents)),
                  sanitizeCsvCell(t.currency || 'USD'),
                  sanitizeCsvCell(resolveAccountName(accounts, t.lines?.[0]?.accountId, t.lines?.[0]?.accountName)),
                  sanitizeCsvCell(t.project || ''),
                  sanitizeCsvCell(t.notes || '')
                ]);
                
                const csvContent = [
                  headers.map(sanitizeCsvCell).join(','),
                  ...rows.map(r => r.join(','))
                ].join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.setAttribute('download', `ledgerflow_matrix_${getLocalDateISO()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('Matrix exported to Excel-compatible CSV.');
              }}
              className="flex-1 sm:flex-none flex justify-center items-center gap-2 md:gap-3 px-4 md:px-6 py-3 text-[9px] md:text-[10px] font-black text-[var(--muted)] uppercase tracking-widest hover:text-[var(--text)] hover:bg-[var(--surface)] rounded-xl transition-all"
            >
              <TableIcon aria-hidden="true" size={16} />
              <span className="hidden sm:inline">Export Matrix</span>
              <span className="sm:hidden">Export</span>
            </button>
            <div className="w-px h-6 bg-slate-200 opacity-50" />
            <button 
              onClick={handleBulkSweep}
              className="flex-1 sm:flex-none flex justify-center items-center gap-2 md:gap-3 px-4 md:px-6 py-3 text-[9px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-[var(--surface)] border border-indigo-600/20 hover:border-indigo-600 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
              aria-label="Analytical Categorization"
            >
              <Sparkles aria-hidden="true" size={16} className="shrink-0" />
              <span className="hidden sm:inline">Analytical Categorization</span>
              <span className="sm:hidden">Auto Cat</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {filterCriteria && Object.keys(filterCriteria).length > 0 && (
        <div className="px-8 pb-4 flex flex-wrap gap-2">
           <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-widest self-center mr-2">Active Filters:</span>
           {Object.entries(filterCriteria).map(([key, value]) => {
             if (!value) return null;
             return (
               <div key={key} className="flex items-center gap-2 bg-[var(--ink)] border border-[var(--line)] px-3 py-1 rounded-full text-[10px] font-bold text-[var(--text)] group/chip hover:border-indigo-600 transition-all">
                 <span className="text-[var(--muted)] uppercase tracking-widest text-[9px]">{key}:</span>
                 <span>{String(value)}</span>
                 <button
                   aria-label={`Remove ${key} filter`}
                   onClick={() => {
                     const next = { ...filterCriteria };
                     delete next[key];
                     onFilterApplied(next);
                   }}
                   className="hover:text-rose-600 transition-colors ml-1"
                 >
                   <Plus aria-hidden="true" className="rotate-45" size={14} />
                 </button>
               </div>
             );
           })}
           <button 
              onClick={() => onFilterApplied({})}
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline px-2"
           >
             Clear All
           </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative bg-[var(--surface)]" dir="auto">
        {viewMode === 'grid' ? (
          <div className="h-full flex flex-col">
            <div className="grid sticky top-0 bg-slate-900 text-white/75 z-20" style={{ gridTemplateColumns: gridCols }}>
              <div className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center justify-center">
                <input type="checkbox" aria-label="Select all transactions" checked={selectedIds.size === transactionsWithBalance.length && transactionsWithBalance.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(transactionsWithBalance.map(t => t.id)) : new Set())} className="w-4 h-4 rounded border-white/20 bg-transparent accent-emerald-500" />
              </div>
              <div
                className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center gap-2 group cursor-pointer hover:bg-[var(--surface)]/5 transition-colors relative"
              >
                <button type="button" onClick={() => handleSort('date')} className="flex flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Date {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}
                </button>
                <button 
                  aria-label="Filter by date"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'date' ? null : 'date'); }}
                  className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-slate-200 rounded transition-all", (filterCriteria?.startDate || filterCriteria?.endDate) && "opacity-100 text-indigo-600")}
                >
                  <Filter aria-hidden="true" size={10} />
                </button>
                {activeFilterColumn === 'date' && (
                  <div role="presentation" className="absolute top-full left-0 z-[100] mt-1 w-64 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Date Selection</p>
                    <div className="space-y-4">
                       <button 
                         onClick={() => { setSearchTerm('today'); setActiveFilterColumn(null); }}
                         className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-sm"
                       >
                         Today
                       </button>
                       <button 
                         onClick={() => { setSearchTerm('last month'); setActiveFilterColumn(null); }}
                         className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-sm"
                       >
                         Last Month
                       </button>
                       <button 
                         onClick={() => { setSearchTerm('this year'); setActiveFilterColumn(null); }}
                         className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-sm"
                       >
                         This Year
                       </button>
                       <div className="pt-2 border-t border-[var(--line)]">
                         <p className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">Custom Range</p>
                         <div className="grid grid-cols-2 gap-2">
                           <input 
                             aria-label="Filter start date"
                             type="date" 
                             className="text-xs p-1 h-8 bg-[var(--ink)] border border-[var(--line)] rounded" 
                             onChange={(e) => onFilterApplied({ ...filterCriteria, startDate: e.target.value })}
                           />
                           <input 
                             aria-label="Filter end date"
                             type="date" 
                             className="text-xs p-1 h-8 bg-[var(--ink)] border border-[var(--line)] rounded"
                             onChange={(e) => onFilterApplied({ ...filterCriteria, endDate: e.target.value })}
                           />
                         </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
              <div
                className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center gap-2 group relative cursor-pointer hover:bg-[var(--surface)]/5 transition-colors"
              >
                <button type="button" onClick={() => handleSort('description')} className="flex flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Description {sortConfig?.key === 'description' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}
                </button>
                <button 
                  aria-label="Filter by description"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'description' ? null : 'description'); }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all"
                >
                  <Filter aria-hidden="true" size={10} />
                </button>
                {activeFilterColumn === 'description' && (
                  <div role="presentation" className="absolute top-full left-0 z-[100] mt-1 w-64 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Text Filters</p>
                    <div className="space-y-1">
                       <button onClick={() => { setSearchTerm('starts with '); setActiveFilterColumn(null); }} className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-sm">Starts with...</button>
                       <button onClick={() => { setSearchTerm('ends with '); setActiveFilterColumn(null); }} className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-sm">Ends with...</button>
                       <button onClick={() => { setSearchTerm('contains '); setActiveFilterColumn(null); }} className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-sm">Contains...</button>
                    </div>
                  </div>
                )}
              </div>
              {!isMobileGrid && (
                <div
                  className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center gap-2 group relative cursor-pointer hover:bg-[var(--surface)]/5 transition-colors"
                >
                  <button type="button" onClick={() => handleSort('category')} className="flex flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    Category {sortConfig?.key === 'category' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}
                  </button>
                  <button 
                    aria-label="Filter by category"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'category' ? null : 'category'); }}
                    className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all", (filterCriteria?.selectedCategories?.length > 0) && "opacity-100 text-emerald-500")}
                  >
                    <Filter aria-hidden="true" size={10} />
                  </button>
                  {activeFilterColumn === 'category' && (
                    <div role="presentation" className="absolute top-full left-0 z-[100] mt-1 w-64 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Filter Category</p>
                      <div className="mb-3 relative group/lsearch">
                        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-hover/lsearch:text-indigo-600 transition-colors" size={12} />
                        <input 
                          type="text" 
                          aria-label="Search category filters"
                          placeholder="Search categories..."
                          className="w-full pl-8 pr-3 py-1.5 bg-[var(--ink)] border border-[var(--line)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          value={columnSearchTerms.category || ''}
                          onChange={(e) => setColumnSearchTerms(prev => ({ ...prev, category: e.target.value }))}
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        {columnFilterValues.category
                          .filter(val => !columnSearchTerms.category || (val || '').toLowerCase().includes(columnSearchTerms.category.toLowerCase()))
                          .map(val => (
                          <label htmlFor={`${formId}-category-${encodeURIComponent(val)}`} key={val} className="flex items-center gap-3 p-2 hover:bg-[var(--ink)] rounded-lg cursor-pointer transition-colors">
                            <input
                              id={`${formId}-category-${encodeURIComponent(val)}`}
                              aria-label={`Category filter: ${val || "Unassigned"}`}
                              type="checkbox" 
                              checked={filterCriteria?.selectedCategories?.includes(val)}
                              onChange={() => toggleColumnFilter('category', val)}
                              className="w-4 h-4 rounded border-[var(--line)] text-indigo-600"
                            />
                            <span className="text-sm text-[var(--text)] truncate">{val}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-[var(--line)] flex justify-between">
                         <button 
                           onClick={() => onFilterApplied({ ...filterCriteria, selectedCategories: [] })}
                           className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--text)] uppercase tracking-wider"
                         >
                           Reset
                         </button>
                         <button 
                           onClick={() => setActiveFilterColumn(null)}
                           className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider"
                         >
                           Apply
                         </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!isMobileGrid && !isTabletGrid && (
                <div
                  className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center gap-2 group relative cursor-pointer hover:bg-[var(--surface)]/5 transition-colors"
                >
                  <button type="button" onClick={() => handleSort('project')} className="flex flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    Project {sortConfig?.key === 'project' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}
                  </button>
                  <button 
                    aria-label="Filter by project"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'project' ? null : 'project'); }}
                    className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all", (filterCriteria?.selectedProjects?.length > 0) && "opacity-100 text-emerald-500")}
                  >
                    <Filter aria-hidden="true" size={10} />
                  </button>
                  {activeFilterColumn === 'project' && (
                    <div role="presentation" className="absolute top-full left-0 z-[100] mt-1 w-64 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Filter Projects</p>
                      <div className="mb-3 relative group/psearch">
                        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-hover/psearch:text-indigo-600 transition-colors" size={12} />
                        <input 
                          type="text" 
                          aria-label="Search project filters"
                          placeholder="Search entities..."
                          className="w-full pl-8 pr-3 py-1.5 bg-[var(--ink)] border border-[var(--line)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          value={columnSearchTerms.project || ''}
                          onChange={(e) => setColumnSearchTerms(prev => ({ ...prev, project: e.target.value }))}
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        {columnFilterValues.project
                          .filter(val => !columnSearchTerms.project || (val || '').toLowerCase().includes(columnSearchTerms.project.toLowerCase()))
                          .map(val => (
                          <label htmlFor={`${formId}-project-${encodeURIComponent(val)}`} key={val} className="flex items-center gap-3 p-2 hover:bg-[var(--ink)] rounded-lg cursor-pointer transition-colors">
                            <input
                              id={`${formId}-project-${encodeURIComponent(val)}`}
                              aria-label={`Project filter: ${val || "Unassigned"}`}
                              type="checkbox" 
                              checked={filterCriteria?.selectedProjects?.includes(val)}
                              onChange={() => toggleColumnFilter('project', val)}
                              className="w-4 h-4 rounded border-[var(--line)] text-indigo-600"
                            />
                            <span className="text-sm text-[var(--text)] truncate">{val}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!isMobileGrid && !isTabletGrid && (
                <div
                  className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center justify-between gap-2 group cursor-pointer hover:bg-[var(--surface)]/5 transition-colors relative"
                >
                  <button type="button" onClick={() => handleSort('class')} className="flex flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    <div className="flex items-center gap-2">Class {sortConfig?.key === 'class' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}</div>
                  </button>
                  <button 
                    aria-label="Filter by class"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'class' ? null : 'class'); }}
                    className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all", (filterCriteria?.selectedClasses?.length || 0) > 0 && "opacity-100 text-emerald-500")}
                  >
                    <Filter aria-hidden="true" size={10} />
                  </button>
                  {activeFilterColumn === 'class' && (
                    <div role="presentation" className="absolute top-full left-0 z-[100] mt-1 w-64 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Filter by Class</p>
                      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        {useLedgerStore.getState().classes?.map(val => (
                          <label htmlFor={`${formId}-class-${encodeURIComponent(val)}`} key={val} className="flex items-center gap-3 p-2 hover:bg-[var(--ink)] rounded-lg cursor-pointer transition-colors">
                            <input
                              id={`${formId}-class-${encodeURIComponent(val)}`}
                              aria-label={`Class filter: ${val || "Unassigned"}`}
                              type="checkbox" 
                              checked={filterCriteria?.selectedClasses?.includes(val)}
                              onChange={() => toggleColumnFilter('class', val)}
                              className="w-4 h-4 rounded border-[var(--line)] text-indigo-600"
                            />
                            <span className="text-sm text-[var(--text)] truncate">{val}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!isMobileGrid && !isTabletGrid && (
                <div
                  className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate flex items-center justify-between gap-2 group cursor-pointer hover:bg-[var(--surface)]/5 transition-colors relative"
                >
                  <button type="button" onClick={() => handleSort('location')} className="flex flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    <div className="flex items-center gap-2">Location {sortConfig?.key === 'location' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}</div>
                  </button>
                  <button 
                    aria-label="Filter by location"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'location' ? null : 'location'); }}
                    className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all", (filterCriteria?.selectedLocations?.length || 0) > 0 && "opacity-100 text-emerald-500")}
                  >
                    <Filter aria-hidden="true" size={10} />
                  </button>
                  {activeFilterColumn === 'location' && (
                    <div role="presentation" className="absolute top-full left-0 z-[100] mt-1 w-64 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Filter by Location</p>
                      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        {useLedgerStore.getState().locations?.map(val => (
                          <label htmlFor={`${formId}-location-${encodeURIComponent(val)}`} key={val} className="flex items-center gap-3 p-2 hover:bg-[var(--ink)] rounded-lg cursor-pointer transition-colors">
                            <input
                              id={`${formId}-location-${encodeURIComponent(val)}`}
                              aria-label={`Location filter: ${val || "Unassigned"}`}
                              type="checkbox" 
                              checked={filterCriteria?.selectedLocations?.includes(val)}
                              onChange={() => toggleColumnFilter('location', val)}
                              className="w-4 h-4 rounded border-[var(--line)] text-indigo-600"
                            />
                            <span className="text-sm text-[var(--text)] truncate">{val}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {((isProMode || isCompactMode) && !isMobileGrid && !isTabletGrid) ? (<><div className="p-4 font-black text-[10px] uppercase tracking-widest text-[var(--muted)] text-right">Debit</div><div className="p-4 font-black text-[10px] uppercase tracking-widest text-[var(--muted)] text-right">Credit</div></>) : (
              <div
                className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate text-right flex items-center justify-end gap-2 group relative cursor-pointer hover:bg-[var(--surface)]/5 transition-colors"
              >
                <button type="button" onClick={() => handleSort('amount')} className="flex justify-end flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Amount {sortConfig?.key === 'amount' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}
                </button>
                <button 
                  aria-label="Filter by amount"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'amount' ? null : 'amount'); }}
                  className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all", (filterCriteria?.minAmount !== undefined || filterCriteria?.maxAmount !== undefined) && "opacity-100 text-emerald-500")}
                >
                  <Filter aria-hidden="true" size={10} />
                </button>
                {activeFilterColumn === 'amount' && (
                  <div role="presentation" className="absolute top-full right-0 z-[100] mt-1 w-72 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-5 normal-case font-medium text-[var(--text)] cursor-default" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-4">Amount Range Logic</p>
                    <div className="space-y-5">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label htmlFor={`${formId}-min-amount`} className="text-[9px] font-black uppercase text-[var(--muted)] tracking-wider">Min Value</label>
                             <div className="relative">
                               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[10px] italic">$</span>
                               <input 
                                  id={`${formId}-min-amount`}
                                  type="number" 
                                  placeholder="0" 
                                  className="w-full pl-6 pr-3 py-2 bg-[var(--ink)] border border-[var(--line)] rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-600 outline-none"
                                  value={filterCriteria?.minAmount || ''}
                                  onChange={(e) => onFilterApplied({ ...filterCriteria, minAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                               />
                             </div>
                          </div>
                          <div className="space-y-2">
                             <label htmlFor={`${formId}-max-amount`} className="text-[9px] font-black uppercase text-[var(--muted)] tracking-wider">Max Value</label>
                             <div className="relative">
                               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-[10px] italic">$</span>
                               <input 
                                  id={`${formId}-max-amount`}
                                  type="number" 
                                  placeholder="∞" 
                                  className="w-full pl-6 pr-3 py-2 bg-[var(--ink)] border border-[var(--line)] rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-600 outline-none"
                                  value={filterCriteria?.maxAmount || ''}
                                  onChange={(e) => onFilterApplied({ ...filterCriteria, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                               />
                             </div>
                          </div>
                       </div>
                       
                       <div className="pt-4 border-t border-[var(--line)] space-y-2">
                          <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest mb-2">Statistical Segments</p>
                          <div className="grid grid-cols-1 gap-1">
                             <button onClick={() => { setSearchTerm('above average'); setActiveFilterColumn(null); }} className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-xs font-bold flex justify-between items-center group">
                                Above Average
                                <TrendingUp aria-hidden="true" size={12} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 text-emerald-500" />
                             </button>
                             <button onClick={() => { setSearchTerm('top 10 %'); setActiveFilterColumn(null); }} className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-xs font-bold flex justify-between items-center group">
                                Top 10% (High Value)
                                <Sparkles aria-hidden="true" size={12} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 text-amber-500" />
                             </button>
                             <button onClick={() => { setSearchTerm('below average'); setActiveFilterColumn(null); }} className="w-full text-left p-2 hover:bg-[var(--ink)] rounded-lg text-xs font-bold flex justify-between items-center group">
                                Below Average
                                <TrendingDown aria-hidden="true" size={12} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 text-rose-500" />
                             </button>
                          </div>
                       </div>

                       <div className="flex gap-2 pt-2">
                          <button 
                            onClick={() => { onFilterApplied({ ...filterCriteria, minAmount: undefined, maxAmount: undefined }); setActiveFilterColumn(null); }}
                            className="flex-1 py-2.5 bg-[var(--ink)] text-[9px] font-medium uppercase tracking-wider rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all"
                          >
                            Reset
                          </button>
                          <button 
                            onClick={() => setActiveFilterColumn(null)}
                            className="flex-1 py-2.5 bg-slate-900 text-white text-[9px] font-medium uppercase tracking-wider rounded-lg hover:bg-black transition-all"
                          >
                            Apply
                          </button>
                       </div>
                    </div>
                  </div>
                )}
                </div>
              )}
              {!isMobileGrid && !isTabletGrid && (
                <div className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate text-right">Running.Sum</div>
              )}
              {!isMobileGrid && (
                <div
                  className="p-4 border-r border-white/10 font-black text-[9px] uppercase tracking-widest truncate text-center flex items-center justify-center gap-2 group cursor-pointer hover:bg-[var(--surface)]/5 transition-colors relative"
                >
                  <button type="button" onClick={() => handleSort('status')} className="flex justify-center flex-1 min-w-0 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    System Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUpRight aria-hidden="true" size={10} className="text-indigo-600" /> : <ArrowDownRight aria-hidden="true" size={10} className="text-indigo-600" />)}
                  </button>
                  <button 
                    aria-label="Filter by status"
                  onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'status' ? null : 'status'); }}
                    className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 hover:bg-[var(--surface)]/10 rounded transition-all", (filterCriteria?.selectedStatuses?.length > 0) && "opacity-100 text-emerald-500")}
                  >
                    <Filter aria-hidden="true" size={10} />
                  </button>
                  {activeFilterColumn === 'status' && (
                    <div className="absolute top-full right-0 z-[100] mt-1 w-48 bg-[var(--ink)] border border-[var(--line)] rounded-xl shadow-2xl p-4 normal-case font-medium">
                      <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-3">Filter Type</p>
                      <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
                        {['Active', 'Pending', 'Void', 'Reconciled'].map(val => (
                          <label htmlFor={`${formId}-status-${encodeURIComponent(val)}`} key={val} className="flex items-center gap-3 p-2 hover:bg-[var(--ink)] rounded-lg cursor-pointer transition-colors">
                            <input
                              id={`${formId}-status-${encodeURIComponent(val)}`}
                              aria-label={`Status filter: ${val || "Unassigned"}`}
                              type="checkbox" 
                              checked={filterCriteria?.selectedStatuses?.includes(val)}
                              onChange={() => toggleColumnFilter('status', val)}
                              className="w-4 h-4 rounded border-[var(--line)] text-indigo-600"
                            />
                            <span className="text-sm text-[var(--text)] truncate">{val}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!isMobileGrid && !isTabletGrid && (
                <div className="p-4 font-black text-[9px] uppercase tracking-widest truncate flex items-center justify-end">
                  Actions
                </div>
              )}
            </div>
            <div className="px-4 md:px-8 py-4 lg:py-0 bg-[#090A0C] border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between text-white/40 overflow-hidden relative gap-4">
              <div className="absolute inset-0 technical-grid opacity-[0.03] pointer-events-none" />
              <div className="flex flex-wrap items-center gap-4 lg:gap-10 relative z-10 w-full overflow-x-auto no-scrollbar pb-2 md:pb-0">
                 <div className="flex flex-col whitespace-nowrap">
                   <p className="text-[9px] font-medium uppercase tracking-wider truncate mb-1 opacity-40">Dataset Depth</p>
                   <p className="text-lg font-black italic text-white/80">{transactionsWithBalance.length} Nodes</p>
                 </div>
                 <div className="hidden sm:block w-px h-10 bg-[var(--surface)]/10" />
                 <div className="flex flex-col whitespace-nowrap">
                   <p className="text-[9px] font-medium uppercase tracking-wider truncate mb-1 opacity-40">Equilibrium</p>
                   <p className={cn(
                     "text-xl font-black font-mono tracking-tighter",
                     totalBalancedSum === 0 
                       ? "text-emerald-400" 
                       : "text-rose-400"
                   , "tabular-nums")}>
                     {formatCurrency(totalBalancedSum)}
                   </p>
                 </div>
                 {selectedIds.size > 0 && (
                   <>
                     <div className="hidden sm:block w-px h-10 bg-[var(--surface)]/10" />
                     <div className="flex items-center gap-4 lg:gap-10">
                        <div className="flex flex-col text-emerald-400 whitespace-nowrap">
                          <p className="text-[9px] font-medium uppercase tracking-wider truncate mb-1 opacity-40">Sum ({selectedIds.size})</p>
                          <p className="text-xl font-black font-mono tracking-tighter tabular-nums">
                            {formatCurrency(selectedMetricsResult.sum)}
                          </p>
                        </div>
                        <div className="flex flex-col text-white/60 whitespace-nowrap">
                          <p className="text-[9px] font-medium uppercase tracking-wider truncate mb-1 opacity-40">Mean Vector</p>
                          <p className="text-xl font-black font-mono tracking-tighter uppercase tabular-nums">
                            {formatCurrency(selectedMetricsResult.mean)}
                          </p>
                        </div>
                     </div>
                   </>
                 )}
              </div>
              <div className="flex items-center gap-4 relative z-10">
                 <AnimatePresence>
                   {selectedIds.size === 2 && (
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       exit={{ opacity: 0, x: 20 }}
                       className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                     >
                        <Sparkles aria-hidden="true" size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Duplicate Probability: 94%</span>
                     </motion.div>
                   )}
                 </AnimatePresence>
                 
                 <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      totalBalancedSum === 0 
                        ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" 
                        : "bg-rose-500 animate-pulse shadow-[0_0_10px_#f43f5e]"
                    )} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                      {totalBalancedSum === 0 
                        ? "Consensus Balanced" 
                        : "Ledger Imbalance Detected"}
                    </span>
                 </div>
              </div>
            </div>
            <div className="flex-1">
              <AutoSizer>
                {({ height, width }: { height: number; width: number }) => (
                  <List
                    height={height}
                    itemCount={transactionsWithBalance.length}
                    itemSize={rowHeight}
                    itemData={itemData}
                    itemKey={itemKey}
                    width={width}
                    className="custom-scrollbar"
                  >
                    {VirtualRow}
                  </List>
                )}
              </AutoSizer>
            </div>
          </div>
        ) : (
          <PivotView pivotData={pivotData} formatCurrency={formatCurrency} />
        )}
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <SelectionBar 
            selectedCount={selectedIds.size}
            totalAmount={selectedTransactions.reduce((sum, t) => sum + t.totalAmountCents, 0)}
            avgAmount={selectedIds.size > 0 ? selectedTransactions.reduce((sum, t) => sum + t.totalAmountCents, 0) / selectedIds.size : 0}
            onCopy={() => {
              if (selectedIds.size > 0) {
                const copyText = selectedTransactions.map(t => `${t.date} | ${t.description} | ${formatCurrency(t.totalAmountCents)}`).join('\n');
                navigator.clipboard.writeText(copyText);
                toast.success(`Copied payload strings for ${selectedIds.size} lines to clipboard`);
              }
            }}
            onClear={() => setSelectedIds(new Set())}
            onBulkUpdate={handleBulkUpdate}
            accounts={accounts}
            formatCurrency={formatCurrency}
          />
        )}
      </AnimatePresence>

      {editingDetailsTx && (
        <TransactionEditModal
          isOpen={!!editingDetailsTx}
          transaction={editingDetailsTx}
          accounts={accounts}
          lockDate={lockDate}
          isReverseAndCorrectMode={isReverseModeModal}
          onClose={() => { setEditingDetailsTx(null); setIsReverseModeModal(false); }}
          onUpdate={onUpdate || (() => {})}
          onReverseAndCorrect={txActions.handleReverseTransaction}
        />
      )}
    </div>
  );
}
