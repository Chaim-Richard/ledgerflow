import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, ArrowRight, FileText, User, Building, FolderKanban, Tags, DollarSign, Zap, FolderPlus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { SYSTEM_COMMANDS, ANALYTICAL_LENSES_REGISTRY } from '../../config/registry';
import { useUIStore } from '../../stores/useUIStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { parseNaturalLanguageEntry, ParsedCommandIntent } from '../../lib/algorithms/nl-parser';
import { useShallow } from 'zustand/react/shallow';
import { Transaction, Project } from '../../types';
import { getLocalDateISO } from '../../lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, details?: any) => void;
  onQuery?: (q: string) => Promise<any>;
  recentQueries?: string[];
}

export default function CommandPalette({ isOpen, onClose, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const language = useUIStore(state => state.language);
  const ledger = useLedgerStore(useShallow(state => ({
    transactions: state.transactions,
    projects: state.projects,
    customers: state.customers,
    vendors: state.vendors,
    accounts: state.accounts
  })));

  // Parse natural language intent live from search query
  const parsedIntent: ParsedCommandIntent = useMemo(() => {
    return parseNaturalLanguageEntry(query);
  }, [query]);

  // Execute Natural Language Intent
  const handleExecuteIntent = () => {
    if (!parsedIntent || parsedIntent.type === 'unknown') return;

    if (parsedIntent.type === 'transaction') {
      const { setTransactions, deleteTransaction } = useLedgerStore.getState();
      const amountCents = parsedIntent.amountCents || 0;
      const isExpense = parsedIntent.action === 'expense';
      const newTxId = `tx-nl-${Date.now()}`;

      // Default double-entry lines
      const cashAccountId = ledger.accounts.find(a => a.type === 'asset')?.id || 'acc-cash';
      const categoryAccountId = isExpense 
        ? (ledger.accounts.find(a => a.type === 'expense')?.id || 'acc-exp')
        : (ledger.accounts.find(a => a.type === 'income')?.id || 'acc-inc');

      const newTx: Transaction = {
        id: newTxId,
        uid: 'user-default',
        workspaceId: 'ws-default',
        date: parsedIntent.dateStr || getLocalDateISO(),
        description: parsedIntent.description || 'Natural Language Entry',
        payee: parsedIntent.payee || undefined,
        status: 'completed',
        type: 'actual',
        totalAmountCents: amountCents,
        currency: 'USD',
        createdAt: new Date().toISOString(),
        lines: [
          {
            accountId: categoryAccountId,
            accountName: isExpense ? 'General Expense' : 'Revenue',
            amountCents: isExpense ? amountCents : -amountCents,
            description: parsedIntent.description || 'NL line'
          },
          {
            accountId: cashAccountId,
            accountName: parsedIntent.method || 'Cash / Checking',
            amountCents: isExpense ? -amountCents : amountCents,
            description: 'Payment settlement'
          }
        ]
      };

      setTransactions([newTx, ...ledger.transactions]);
      toast.success(`⚡ Posted: ${parsedIntent.displaySummary}`, {
        action: {
          label: 'Undo',
          onClick: () => {
            deleteTransaction(newTxId);
            toast.info('Transaction undone');
          }
        }
      });
      setQuery('');
      onClose();
    } else if (parsedIntent.type === 'project' && parsedIntent.projectName) {
      const { setProjects } = useLedgerStore.getState();
      const newProjId = `proj-${Date.now()}`;
      const newProject: Project = {
        id: newProjId,
        uid: 'user-default',
        workspaceId: 'ws-default',
        name: parsedIntent.projectName,
        status: 'active',
        type: 'general',
        budgetCents: 0,
        dimensions: ['project'],
        description: 'Created via Omnibox Command',
        createdAt: new Date().toISOString()
      };

      setProjects([newProject, ...ledger.projects]);
      toast.success(`✨ Created project "${parsedIntent.projectName}"`);
      setQuery('');
      onClose();
    }
  };

  // Map commands to the currently active UI language
  const localizedCommands = React.useMemo(() => {
    const base = SYSTEM_COMMANDS.map(cmd => ({
      id: cmd.id,
      type: 'command',
      label: cmd.label[language] || cmd.label['en'],
      category: cmd.category,
      actionId: cmd.actionId,
      payload: cmd.payload,
      icon: <ArrowRight size={16} />
    }));
    
    const lenses = ANALYTICAL_LENSES_REGISTRY.map((lens: any) => ({
      id: `lens-${lens.id}`,
      type: 'command',
      label: `Open: ${(lens.label && lens.label[language]) || (lens.label && lens.label['en']) || lens.name || lens.id}`,
      category: 'Calculators & Analytics',
      actionId: 'switch-tab',
      payload: { tab: 'intelligence', channel: lens.id },
      icon: <ArrowRight size={16} />
    }));
    
    return [...base, ...lenses];
  }, [language]);

  // Deep Omnisearch across the entire business model
  const dataResults = useMemo(() => {
    if (!query || query.length < 2) return [];
    
    const lowerQ = query.toLowerCase();
    const results: any[] = [];
    const searchTerms = lowerQ.split(' ').filter(t => t.length > 0);

    // Helper to check if all search terms match a string
    const match = (str?: string) => {
      if (!str) return false;
      const lower = str.toLowerCase();
      return searchTerms.every(term => lower.includes(term));
    };

    // Helper to check array of tags
    const matchArray = (arr?: string[]) => {
      if (!arr) return false;
      const str = arr.join(' ').toLowerCase();
      return searchTerms.every(term => str.includes(term));
    };

    const currentWorkspace = useAuthStore.getState().getCurrentWorkspace();
    const dimensionNodes = currentWorkspace?.dimensionNodes || [];
    
    // Check if the query matches a DimensionNode
    const matchedDimensionNodes = dimensionNodes.filter(n => 
      match(n.id) || match(n.description) || matchArray(n.aliases)
    ).map(n => n.id);

    // 1. Transactions
    ledger.transactions.forEach(t => {
      const hasMatchedDim = t.dimensions && matchedDimensionNodes.length > 0 && Object.values(t.dimensions).some(val => matchedDimensionNodes.includes(val as string));
      
      if (match(t.description) || matchArray(t.tags) || match(t.payee) || match(t.id) || hasMatchedDim) {
        results.push({
          id: `tx-${t.id}`,
          type: 'data',
          label: `${t.description || 'Transaction'} - ${(t.totalAmountCents / 100).toLocaleString('en-US', { style: 'currency', currency: t.currency || 'USD' })}`,
          category: `Transaction • ${t.date} ${t.tags ? '• ' + t.tags.join(', ') : ''}`,
          actionId: 'switch-tab',
          payload: { tab: 'transactions', id: t.id },
          icon: <DollarSign size={16} className="text-emerald-500 shrink-0" />
        });
      } else {
        // Search inside lines
        for (const line of t.lines) {
          const lineHasMatchedDim = line.dimensions && matchedDimensionNodes.length > 0 && Object.values(line.dimensions).some(val => matchedDimensionNodes.includes(val as string));
          if (match(line.description) || match(line.accountName) || matchArray(line.tags) || match(line.project) || match(line.class) || match(line.location) || lineHasMatchedDim) {
            results.push({
              id: `tx-line-${t.id}-${line.accountId}`,
              type: 'data',
              label: `${line.description || t.description} (in ${line.accountName})`,
              category: `Transaction Line • ${(line.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: t.currency || 'USD' })} ${line.tags ? '• ' + line.tags.join(', ') : ''}`,
              actionId: 'switch-tab',
              payload: { tab: 'transactions', id: t.id },
              icon: <FileText size={16} className="text-blue-500 shrink-0" />
            });
            break; // Don't duplicate if multiple lines match
          }
        }
      }
    });

    // 1.5. Dimension Nodes
    dimensionNodes.forEach(node => {
      if (match(node.id) || match(node.description) || matchArray(node.aliases)) {
        results.push({
          id: `dim-${node.id}`,
          type: 'data',
          label: `${node.id.toUpperCase()}: ${node.description}`,
          category: `Dimension Node • ${node.dimensionId}`,
          actionId: 'switch-tab',
          payload: { tab: 'intelligence-center' },
          icon: <FolderPlus size={16} className="text-purple-500 shrink-0" />
        });
      }
    });

    // 2. Projects / Units
    ledger.projects.forEach(p => {
      if (match(p.name) || match(p.description)) {
        results.push({
          id: `proj-${p.id}`,
          type: 'data',
          label: p.name,
          category: `Project / Unit • ${p.status}`,
          actionId: 'switch-tab',
          payload: { tab: 'projects', id: p.id },
          icon: <FolderKanban size={16} className="text-purple-500 shrink-0" />
        });
      }
    });

    // 3. Customers
    ledger.customers.forEach(c => {
      if (match(c.name) || match(c.email) || matchArray(c.tags) || match((c as any).group)) {
        results.push({
          id: `cust-${c.id}`,
          type: 'data',
          label: c.name,
          category: `Customer ${(c as any).group ? '• ' + (c as any).group : ''}`,
          actionId: 'switch-tab',
          payload: { tab: 'sales', id: c.id },
          icon: <User size={16} className="text-amber-500 shrink-0" />
        });
      }
    });

    // 4. Vendors
    ledger.vendors.forEach(v => {
      if (match(v.name) || match(v.email) || matchArray(v.tags) || match((v as any).group)) {
        results.push({
          id: `vend-${v.id}`,
          type: 'data',
          label: v.name,
          category: `Vendor ${(v as any).group ? '• ' + (v as any).group : ''}`,
          actionId: 'switch-tab',
          payload: { tab: 'expenses', id: v.id },
          icon: <Building size={16} className="text-rose-500 shrink-0" />
        });
      }
    });

    // 5. Accounts
    ledger.accounts.forEach(a => {
      if (match(a.name) || match(a.code) || match(a.category)) {
        results.push({
          id: `acc-${a.id}`,
          type: 'data',
          label: `${a.code ? a.code + ' - ' : ''}${a.name}`,
          category: `Account • ${a.type} ${a.category ? '• ' + a.category : ''}`,
          actionId: 'switch-tab',
          payload: { tab: 'ledger', accountId: a.id },
          icon: <Tags size={16} className="text-blue-500 shrink-0" />
        });
      }
    });

    return results.slice(0, 50); // Limit to top 50 results
  }, [query, ledger.transactions, ledger.projects, ledger.customers, ledger.vendors, ledger.accounts]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onAction?.('open-command-palette');
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, onClose, onAction]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setIsExecuting(false);
    }
  }, [isOpen]);

  const filteredCommands = query
    ? localizedCommands.filter((command) =>
        command.label.toLowerCase().includes(query.toLowerCase())
      )
    : localizedCommands;

  const combinedResults = [...dataResults, ...filteredCommands];

  const handleSelect = async (item: any) => {
    setIsExecuting(true);
    await new Promise(r => setTimeout(r, 400));
    
    // Core Application Action Mappings
    if (onAction && item.actionId) {
      onAction(item.actionId, item.payload);
    }
    toast.success(`${item.label} opened`);
    setIsExecuting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-gray-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed z-[201] top-[10%] left-1/2 -translate-x-1/2 w-full max-w-3xl bg-[var(--surface)] rounded-[32px] shadow-2xl overflow-hidden border border-gray-200"
          >
            <div className="flex items-center px-6 py-5 border-b border-gray-100">
              <Search className="text-indigo-600 mr-4" size={24} />
              <input
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-xl font-medium"
                placeholder='Type $40 gas cash, paid Maria 150, new project: Aspen, or search...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsedIntent.type !== 'unknown') {
                    e.preventDefault();
                    handleExecuteIntent();
                  }
                }}
                disabled={isExecuting}
              />
              <div className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] font-mono uppercase tracking-widest hidden sm:block">
                ESC to close
              </div>
            </div>
            
            <div className="max-h-[60dvh] overflow-y-auto bg-[var(--ink)]">
              {parsedIntent.type !== 'unknown' && (
                <div className="p-3 bg-indigo-50/80 border-b border-indigo-100">
                  <button
                    onClick={handleExecuteIntent}
                    className="w-full flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-md group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/20 rounded-xl">
                        {parsedIntent.type === 'project' ? <FolderPlus size={20} /> : <Zap size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-wide uppercase text-indigo-200">Instant Command Execution (Press Enter)</p>
                        <p className="text-base font-semibold">{parsedIntent.displaySummary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-lg group-hover:bg-white/30 transition-colors">
                      <span>Execute</span>
                      <ArrowRight size={14} />
                    </div>
                  </button>
                </div>
              )}

              {isExecuting ? (
                <div className="flex flex-col items-center justify-center p-16 text-gray-500">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p className="text-base font-medium">Navigating universe...</p>
                </div>
              ) : combinedResults.length > 0 ? (
                <div className="p-3 space-y-1">
                  {combinedResults.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface)] hover:shadow-sm rounded-2xl transition-all group text-left border border-transparent hover:border-[var(--line)]"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-gray-900 truncate">{item.label}</p>
                          <p className="text-xs font-medium text-gray-500 truncate">{item.category}</p>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
                         <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 mr-2 hidden sm:inline">Jump</span>
                         <ArrowRight size={16} className="text-indigo-600 inline-block -translate-x-2 group-hover:translate-x-0 transition-all shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.length > 0 ? (
                <div className="p-16 text-center text-gray-500">
                  <Tags size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-bold text-gray-900">No dimensions matched</p>
                  <p className="text-sm font-medium mt-1">Try searching by tags, units, categories, or dollar amounts.</p>
                </div>
              ) : (
                 <div className="p-10 flex items-center justify-center opacity-50">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center max-w-sm">
                      Amount Search Matrix active.<br/>Type any tag, location, class, or entity to instantly filter your workspace.
                    </p>
                 </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
