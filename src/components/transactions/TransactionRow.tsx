import React from 'react';
import { Transaction } from '../../types';

import { 
  Zap,
  RotateCcw,
  RefreshCcw,
  AlertCircle,
  Columns,
  Sparkles,
  Copy,
  Lock,
  Edit3,
  BrainCircuit,
  Paperclip
} from 'lucide-react';
import { resolveAccountName, cn, formatDate, formatSignedAmount } from '../../lib/utils';
import { isInflow } from '../../lib/txFilters';
import { useLedgerStore } from '../../stores/useLedgerStore';
import AsyncButton from '../ui/AsyncButton';
import CategoryWhyPopover from '../common/CategoryWhyPopover';
import { isLockedDate } from '../../lib/periodLock';

function withOccurrenceKeys<T>(items: readonly T[], identity: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map(item => {
    const content = identity(item);
    const occurrence = occurrences.get(content) ?? 0;
    occurrences.set(content, occurrence + 1);
    return { item, key: JSON.stringify([content, occurrence]) };
  });
}

const HighlightMatch = ({ text, match }: { text: string; match?: string }) => {
  if (!match) return <>{text}</>;
  const parts = text.split(new RegExp(`(${match})`, 'gi'));
  return (
    <>
      {withOccurrenceKeys(parts, part => part).map(({ item: p, key }) =>
        p.toLowerCase() === match.toLowerCase() ? (
          <mark key={key} className="bg-yellow-200 text-yellow-900 rounded-[2px] px-0.5 font-bold">{p}</mark>
        ) : (
          <span key={key}>{p}</span>
        )
      )}
    </>
  );
};

interface TransactionRowProps {
  tx: Transaction & { balanceCents: number };
  isSelected: boolean;
  isSetA: boolean;
  isSetB: boolean;
  isFocused: boolean;
  isEven: boolean;
  focusedField: string | null;
  onToggleSelection: (id: string) => void;
  onVoid: (id: string) => Promise<void> | void;
  onUpdate?: (id: string, updates: Partial<Transaction>) => void;
  onSelect?: (id: string) => void;
  onCreateRule: (tx: Transaction) => void;
  onProjectClick: (projectName: string) => void;
  onSplit: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onToggleFlag?: (id: string) => void;
  onEditDetails?: (tx: Transaction) => void;
  onReverseAndCorrect?: (tx: Transaction) => void;
  formatCurrency: (cents: number) => string;
  isProMode?: boolean;
  isCompactMode?: boolean;
  isMobileGrid?: boolean;
  isTabletGrid?: boolean;
  dateFormat?: string;
  gridColumns: string;
  anomaly?: { score: number, reason: string };
  internalConflict?: { type: string, message: string };
  searchTerm?: string;
}

const TransactionRow = React.memo(({
  tx,
  isSelected,
  isSetA,
  isSetB,
  isFocused,
  isEven,
  focusedField,
  onToggleSelection,
  onVoid,
  onUpdate,
  onSelect,
  onCreateRule,
  onProjectClick,
  onSplit,
  onDuplicate,
  onToggleFlag,
  onEditDetails,
  onReverseAndCorrect,
  formatCurrency,
  isProMode = false,
  isCompactMode = false,
  isMobileGrid = false,
  isTabletGrid = false,
  gridColumns,
  anomaly,
  internalConflict,
  searchTerm
}: TransactionRowProps) => {
  const isPrivacyMode = useLedgerStore(state => state.isPrivacyMode);
  const accounts = useLedgerStore(state => state.accounts);
  const lockDate = useLedgerStore(state => state.lockDate);
  const lockException = useLedgerStore(state => state.lockException);
  const isLocked = (!!tx.date && isLockedDate(tx.date, lockDate, lockException)) || !!tx.isLocked;
  const displayTx = tx;

  const [isEditingDesc, setIsEditingDesc] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState<string | null>(null);
  const descValue = editDraft !== null ? editDraft : displayTx.description;

  const handleDescSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsEditingDesc(false);
    if (editDraft !== null && editDraft !== displayTx.description && !isLocked && onUpdate) {
      onUpdate(tx.id, { description: editDraft });
    }
    setEditDraft(null);
  };

  return (
    <div className="flex flex-col w-full h-full relative group/row">
      <div role="presentation"
        onClick={() => onSelect?.(tx.id)}
        className={cn(
          "grid w-full h-full items-center transition-all border-b border-[var(--line)] cursor-pointer relative",
          tx.type === 'reversal' && "bg-rose-50/5",
          tx.type === 'adjustment' && "bg-amber-50/5",
          (anomaly || internalConflict) && "bg-indigo-600/[0.03]",
          isSetA && "bg-amber-50/10",
          isSetB && "bg-emerald-50/10",
          isFocused ? "bg-[var(--brass)]/[0.15]" : (isEven ? "bg-[var(--ink)]" : "bg-[var(--surface)]"),
          isSelected && "bg-[var(--brass)]/[0.2]",
          tx.isFlagged && "bg-amber-500/5",
          "hover:bg-[var(--text)] hover:text-[var(--ink)] group/active"
        )}
        style={{ gridTemplateColumns: gridColumns }}
      >
        <div className={cn("px-4 relative h-full flex items-center justify-center border-r border-[var(--line)]/50", isProMode && "px-2", isCompactMode && "px-1")}>
          {isFocused && <div className="absolute inset-y-0 left-0 w-1 bg-slate-900 shadow-[0_0_10px_rgba(0,0,0,0.2)]" />}
          <input aria-label={`Select transaction ${tx.description}`}
            type="checkbox" 
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelection(tx.id); }}
            className={cn(
              "w-4 h-4 rounded border-[var(--line)] text-[var(--text)] focus:ring-slate-900/20 cursor-pointer relative z-10 accent-ledger-ink transition-all group-hover/active:border-white/40",
              isCompactMode && "w-3.5 h-3.5"
            )}
          />
        </div>
        <div className={cn(
          "px-4 text-slate-500 font-mono whitespace-nowrap text-[10px] h-full flex items-center border-r border-[var(--line)]/50 transition-colors group-hover/active:text-white/60", 
          isProMode && "px-2 text-[9px]",
          isCompactMode && "px-1 text-[9px]",
          isFocused && focusedField === 'date' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
        )}>
          {displayTx.date ? formatDate(displayTx.date) : 'N/A'}
        </div>
        <div 
          onDoubleClick={(e) => {
            if (!isLocked) {
              e.stopPropagation();
              setIsEditingDesc(true);
            }
          }}
          className={cn(
            "px-4 font-bold text-[var(--text)] transition-colors text-xs h-full flex flex-col justify-center relative border-r border-[var(--line)]/50 group-hover/active:text-white", 
            isProMode && "px-2 text-[10px]",
            isFocused && focusedField === 'description' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5",
            "truncate"
          )} 
          dir="auto"
        >
          {isEditingDesc ? (
            <input aria-label="Transaction description"
              type="text"
              autoFocus
              value={descValue}
              onChange={(e) => setEditDraft(e.target.value)}
              onBlur={() => handleDescSubmit()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDescSubmit();
                if (e.key === 'Escape') {
                  setEditDraft(null);
                  setIsEditingDesc(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white text-slate-900 px-2 py-1 text-xs font-semibold rounded border border-indigo-500 shadow-xs outline-none"
            />
          ) : (
            <>
              <button type="button" className="text-left truncate w-full font-sans tracking-tight flex items-center gap-1.5 flex-wrap">
                <HighlightMatch text={displayTx.description} match={searchTerm} />
                {displayTx.fileUrls && displayTx.fileUrls.length > 0 && (
                  <span 
                    data-testid="attachment-badge"
                    title={`${displayTx.fileUrls.length} attachment${displayTx.fileUrls.length === 1 ? '' : 's'}`}
                    aria-label={`${displayTx.fileUrls.length} attachment${displayTx.fileUrls.length === 1 ? '' : 's'}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 shrink-0 select-none group-hover/active:bg-indigo-500 group-hover/active:text-white group-hover/active:border-white/20"
                  >
                    <Paperclip aria-hidden="true" size={10} className="shrink-0" />
                    <span>{displayTx.fileUrls.length}</span>
                  </span>
                )}
                {isLocked && (
                  <span title="Locked under Absolute Integrity">
                    <Lock aria-hidden="true" className="text-amber-500 inline shrink-0 animate-pulse" size={11} />
                  </span>
                )}
              </button>
              {!isCompactMode && tx.verification?.hash && (
                <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1 transition-colors group-hover/active:text-white/40">
                  <Zap aria-hidden="true" size={9} className={isLocked ? "text-amber-400" : "text-emerald-500"} />
                  {tx.verification.hash.slice(0, 8)} {isLocked && <span className="text-[7px] font-black tracking-widest uppercase bg-amber-400/10 text-amber-500 dark:text-amber-400 px-1.5 py-0.5 border border-amber-400/20 rounded font-sans scale-90 origin-left">SEALED</span>}
                </span>
              )}
            </>
          )}
        </div>
        {!isMobileGrid && (
          <div className={cn(
            "px-4 h-full flex items-center border-r border-[var(--line)]/50", 
            isProMode && "px-2", 
            isCompactMode && "px-1",
            isFocused && focusedField === 'category' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
          )}>
            <div className="flex flex-col gap-1 w-full">
              {withOccurrenceKeys(tx.lines?.slice(0, 2) || [], line => line.id || JSON.stringify([line.accountId, line.description, line.project, line.class, line.location])).map(({ item: line, key }, idx) => (
                <div key={key} className="flex items-center justify-between gap-1 w-full">
                  <span 
                    dir="auto"
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider truncate flex-1 border transition-all",
                      line.amountCents > 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 group-hover/active:bg-emerald-500 group-hover/active:text-white group-hover/active:border-white/20" : "bg-[var(--ink)] text-slate-500 border-[var(--line)] group-hover/active:bg-[var(--surface)]/10 group-hover/active:text-white/80 group-hover/active:border-white/20",
                    )}
                  >
                    <HighlightMatch text={resolveAccountName(accounts, line.accountId, line.accountName)} match={searchTerm} />
                    {line.isAnalyticalTagged && (
                      <div className="absolute -top-2 -right-2 z-20 group/spark">
                        <Sparkles aria-hidden="true" size={10} className="text-amber-500 animate-[pulse_2s_infinite]" />
                        <div className="absolute top-4 left-0 w-48 p-3 bg-slate-900 text-white rounded-xl text-[8px] font-medium leading-relaxed opacity-0 group-hover/spark:opacity-100 transition-opacity pointer-events-none shadow-2xl border border-white/10 italic">
                          Analytical pattern matched: This transaction corresponds to a recurring {resolveAccountName(accounts, line.accountId, line.accountName).toLowerCase()} vector based on historical consistency.
                        </div>
                      </div>
                    )}
                  </span>
                  {idx === 0 && (
                    <CategoryWhyPopover 
                      description={displayTx.description} 
                      accountName={resolveAccountName(accounts, line.accountId, line.accountName)} 
                    />
                  )}
                </div>
              ))}
              
              {tx.lines?.map(l => l.tags || []).flat().filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).map(tag => (
                <span 
                  key={`tag-${tag}`}
                  dir="auto"
                  className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest truncate w-full border transition-all bg-indigo-50 text-indigo-600 border-indigo-200 group-hover/active:bg-indigo-500 group-hover/active:text-white group-hover/active:border-white/20"
                >
                  <HighlightMatch text={tag} match={searchTerm} />
                </span>
              ))}
            </div>
          </div>
        )}
        {!isMobileGrid && !isTabletGrid && (
          <div className={cn(
            "px-4 h-full flex items-center border-r border-[var(--line)]/50", 
            isProMode && "px-2",
            isFocused && focusedField === 'project' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
          )}>
            <div className="flex flex-wrap gap-1 w-full">
              {tx.lines?.find(l => l.project)?.project && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onProjectClick(tx.lines!.find(l => l.project)!.project!);
                  }}
                  dir="auto"
                  className="px-2 py-0.5 bg-[var(--ink)] text-slate-500 rounded text-[9px] font-bold border border-[var(--line)] hover:border-slate-800 transition-colors truncate uppercase group-hover/active:text-white group-hover/active:border-white/20 group-hover/active:bg-[var(--surface)]/10"
                >
                  <HighlightMatch text={tx.lines!.find(l => l.project)!.project!} match={searchTerm} />
                </button>
              )}
            </div>
          </div>
        )}
        {!isMobileGrid && !isTabletGrid && (
          <div className={cn(
            "px-4 h-full flex items-center border-r border-[var(--line)]/50", 
            isProMode && "px-2",
            isFocused && focusedField === 'class' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
          )}>
            <div className="flex flex-wrap gap-1 w-full">
              {tx.lines?.find(l => l.class)?.class && (
                <span className="px-2 py-0.5 bg-[var(--ink)] text-slate-500 rounded text-[9px] font-bold border border-[var(--line)] truncate uppercase group-hover/active:text-white group-hover/active:border-white/20 group-hover/active:bg-[var(--surface)]/10">
                  <HighlightMatch text={tx.lines!.find(l => l.class)!.class!} match={searchTerm} />
                </span>
              )}
            </div>
          </div>
        )}
        {!isMobileGrid && !isTabletGrid && (
          <div className={cn(
            "px-4 h-full flex items-center border-r border-[var(--line)]/50", 
            isProMode && "px-2",
            isFocused && focusedField === 'location' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
          )}>
            <div className="flex flex-wrap gap-1 w-full">
              {tx.lines?.find(l => l.location)?.location && (
                <span className="px-2 py-0.5 bg-[var(--ink)] text-slate-500 rounded text-[9px] font-bold border border-[var(--line)] truncate uppercase group-hover/active:text-white group-hover/active:border-white/20 group-hover/active:bg-[var(--surface)]/10">
                  <HighlightMatch text={tx.lines!.find(l => l.location)!.location!} match={searchTerm} />
                </span>
              )}
            </div>
          </div>
        )}
        <div 
          className={cn(
            "px-4 text-right font-black font-mono transition-colors text-sm h-full flex flex-col justify-center relative overflow-hidden border-r border-[var(--line)]/50 items-end",
            isInflow(tx, accounts)
              ? "text-emerald-600 group-hover/active:text-emerald-400"
              : "text-rose-600 group-hover/active:text-rose-400",
            isFocused && focusedField === 'amountCents' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
          )}
        >
          <span data-testid="tx-amount" className={cn("relative z-10 tabular-nums tracking-tighter truncate whitespace-nowrap", isPrivacyMode && "blur-[6px] select-none pointer-events-none opacity-20 transition-all")}>
            {/* sign as well as colour (E-26): money in +, money out − */}
            {formatSignedAmount(displayTx.totalAmountCents, isInflow(tx, accounts) ? 'in' : 'out')}
          </span>
          {tx.originalCurrency && tx.exchangeRate && (
            <span className={cn("text-[9px] font-sans font-bold uppercase tracking-wider text-[var(--muted)] mt-0.5 truncate whitespace-nowrap", isPrivacyMode && "blur-[6px] select-none pointer-events-none opacity-20 transition-all")}>
              {tx.originalCurrency} @ {tx.exchangeRate.toFixed(4)}
            </span>
          )}
        </div>
        {!isMobileGrid && !isTabletGrid && (
          <div className={cn(
            "px-4 text-right font-bold font-mono text-slate-500 text-[11px] h-full flex items-center justify-end border-r border-[var(--line)]/50 transition-colors group-hover/active:text-white/60 whitespace-nowrap tabular-nums",
            isProMode && "px-2 text-[10px]"
          )}>
            {formatCurrency(tx.balanceCents || 0)}
          </div>
        )}
        {!isMobileGrid && (
          <div className={cn(
            "px-4 text-center h-full flex items-center justify-center border-r border-[var(--line)]/50", 
            isProMode && "px-2",
            isFocused && focusedField === 'status' && "ring-2 ring-inset ring-indigo-600 bg-indigo-600/5"
          )}>
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider border transition-all",
              tx.status === 'approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 group-hover/active:bg-emerald-500 group-hover:text-white" :
              tx.status === 'flagged' ? "bg-amber-500/10 text-amber-600 border-amber-500/20 group-hover/active:bg-amber-500 group-hover:text-white" :
              tx.status === 'void' ? "bg-rose-500/10 text-rose-600 border-rose-500/20 group-hover/active:bg-rose-500 group-hover:text-white" :
              tx.status === 'draft' ? "bg-[var(--ink)]0/10 text-slate-600 border-slate-500/20 group-hover/active:bg-[var(--ink)]0 group-hover:text-white" :
              "bg-[var(--ink)] text-slate-500 border-[var(--line)] group-hover/active:bg-[var(--surface)]/10 group-hover/active:text-white group-hover/active:border-white/20",
              tx.lines?.some(l => l.isAnalyticalTagged) && "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
            )}>
              {tx.status || tx.type}
            </span>
          </div>
        )}
        {!isMobileGrid && !isTabletGrid && (
          <div className={cn("px-4 text-right h-full flex items-center justify-end group-hover/active:text-white")}>
            {isLocked ? (
              <div className="flex items-center justify-end gap-1.5">
                <div className="flex items-center gap-1 text-[8px] font-medium uppercase tracking-wider text-[#d97706] bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded border border-amber-500/20 shrink-0 select-none">
                  <Lock aria-hidden="true" size={10} className="text-[#d97706]" /> Immutable
                </div>
                {!tx.reversalEventId && tx.type !== 'reversal' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onReverseAndCorrect) {
                        onReverseAndCorrect(tx);
                      } else {
                        onEditDetails?.(tx);
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:text-indigo-400 dark:hover:text-white rounded border border-indigo-500/20 text-[9px] font-bold transition-all shrink-0 cursor-pointer"
                    title="Reverse & Correct (Sanctioned closed-period correction)"
                  >
                    <RefreshCcw aria-hidden="true" size={10} />
                    <span className="hidden sm:inline">Reverse & Correct</span>
                  </button>
                )}
                {tx.reversalEventId && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 select-none">
                    Reversed
                  </span>
                )}
              </div>
            ) : (
              <div className={cn(
                "flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity",
                (isProMode || isCompactMode) && "opacity-100"
              )}>
                <button aria-label="Edit Transaction Details"
                  onClick={(e) => { e.stopPropagation(); onEditDetails?.(tx); }}
                  className="p-1 text-[var(--muted)] hover:text-indigo-600 rounded transition-all"
                  title="Edit Transaction Details"
                >
                  <Edit3 aria-hidden="true" size={14} />
                </button>
                <button aria-label="Split Transaction"
                  onClick={(e) => { e.stopPropagation(); onSplit(tx.id); }}
                  className="p-1 text-[var(--muted)] hover:text-indigo-600 rounded transition-all"
                  title="Split Transaction"
                >
                  <Columns aria-hidden="true" size={14} />
                </button>
                <button aria-label="Duplicate Transaction"
                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(tx.id); }}
                  className="p-1 text-[var(--muted)] hover:text-indigo-600 rounded transition-all"
                  title="Duplicate Transaction"
                >
                  <Copy aria-hidden="true" size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onCreateRule(tx); }}
                  className="p-1 text-[var(--muted)] hover:text-indigo-600 rounded transition-all cursor-pointer"
                  title="Create Auto-Categorization Rule"
                  aria-label="Create Auto-Categorization Rule"
                >
                  <Zap aria-hidden="true" size={14} />
                </button>
                <button aria-label={tx.isFlagged ? "Unflag transaction" : "Flag for Review"}
                  onClick={(e) => { e.stopPropagation(); onToggleFlag?.(tx.id); }}
                  className={cn(
                    "p-1 rounded transition-all",
                    tx.isFlagged ? "text-amber-500" : "text-[var(--muted)] hover:text-amber-500"
                  )}
                  title="Flag for Review"
                >
                  <AlertCircle aria-hidden="true" size={14} />
                </button>
                <AsyncButton aria-label="Reverse transaction"
                  onClick={(e) => { e.stopPropagation(); return onVoid(tx.id); }}
                  className="p-1 text-[var(--muted)] hover:text-rose-600 rounded transition-all"
                  variant="ghost"
                  size="icon"
                  disabled={tx.type === 'reversal' || !!tx.reversalEventId}
                >
                  <RotateCcw aria-hidden="true" size={14} />
                </AsyncButton>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Anomaly Resolution Panel */}
      {anomaly && (
        <div className="bg-indigo-50/50 border-b border-[var(--line)] px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <BrainCircuit aria-hidden="true" className="text-indigo-600" size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-900">Anomaly Detected</h4>
              <p className="text-xs text-indigo-700/80 mt-0.5">{anomaly.reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdate?.(tx.id, { isFlagged: false }); /* mark reviewed */ }}
              className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
            >
              Mark Reviewed
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onUpdate?.(tx.id, { isFlagged: false }); /* dismiss */ }}
              className="px-3 py-1.5 bg-white border border-indigo-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default TransactionRow;
