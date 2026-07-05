import React, { useState, useMemo } from 'react';
import { Transaction, ChartAccount } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Inbox, 
  CheckCircle2, 
  ArrowRight, 
  Tag, 
  Building2, 
  Search,
  CheckSquare,
  Square,
  Upload,
  Zap,
  FileImage
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useCallback } from 'react';

interface InboxViewProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  onCategorize: (transactionIds: string[], category: string, account: string) => void;
  formatCurrency: (val: number) => string;
  onParseReceipt: (file: File, transactionId?: string) => void;
}

const Row = React.memo(({ index, style, data }: { index: number, style: React.CSSProperties, data: any }) => {
  const { pendingTransactions, selectedIds, toggleSelect, formatCurrency, handleFileChange } = data;
  const t = pendingTransactions[index];
  if (!t) return null;

  return (
    <div style={style} className="px-10 pb-4">
      <div 
        className={cn(
          "p-8 flex items-center gap-8 bg-white border border-slate-200 rounded-[32px] hover:bg-white/[0.03] transition-all cursor-pointer group border-l-4",
          selectedIds.includes(t.id) ? "bg-indigo-600/5 border-indigo-600 shadow-inner" : "border-transparent"
        )}
        onClick={() => toggleSelect(t.id)}
      >
        <div className="shrink-0">
          {selectedIds.includes(t.id) ? (
            <CheckSquare size={24} className="text-indigo-600" />
          ) : (
            <Square size={24} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
          )}
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
          <div className="md:col-span-2">
            <p className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{t.description}</p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] opacity-40">{format(new Date(t.date), 'MMM dd, yyyy')}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200/50" />
              <span className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em]">{t.lines?.[0]?.accountName || 'UNCATEGORIZED SIGNAL'}</span>
            </div>
          </div>

          <div className="text-right md:text-left">
            <p className={cn(
              "text-2xl font-black font-mono tracking-tighter italic",
              t.totalAmountCents > 0 ? "text-emerald-500" : "text-slate-900"
            )}>
              {formatCurrency(t.totalAmountCents)}
            </p>
          </div>

          <div className="flex justify-end items-center gap-4">
            <label className="cursor-pointer p-4 bg-slate-50 text-slate-500 rounded-[32px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Ingest Metadata Artifact" onClick={(e) => e.stopPropagation()}>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e, t.id)}
              />
              <FileImage size={20} />
            </label>
            <button 
              className="p-4 bg-slate-50 text-slate-500 rounded-[32px] hover:bg-slate-900 hover:text-white transition-all shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function InboxView({ transactions = [], accounts = [], onCategorize, formatCurrency, onParseReceipt }: InboxViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkAccount, setBulkAccount] = useState('');

  const pendingTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return transactions.filter(t => 
      t.status === 'pending' || 
      !t.lines?.length || 
      t.lines.some(l => l.accountName === 'Uncategorized')
    ).filter(t => 
      t.description.toLowerCase().includes(term) ||
      t.totalAmountCents.toString().includes(searchTerm)
    );
  }, [transactions, searchTerm]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, transactionId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      onParseReceipt(file, transactionId);
    }
  }, [onParseReceipt]);

  const itemData = useMemo(() => ({
    pendingTransactions,
    selectedIds,
    toggleSelect,
    formatCurrency,
    handleFileChange
  }), [pendingTransactions, selectedIds, toggleSelect, formatCurrency, handleFileChange]);

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingTransactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingTransactions.map(t => t.id));
    }
  };

  const handleBulkAction = () => {
    if (selectedIds.length === 0 || !bulkCategory || !bulkAccount) return;
    onCategorize(selectedIds, bulkCategory, bulkAccount);
    setSelectedIds([]);
    setBulkCategory('');
    setBulkAccount('');
  };

  return (
    <div className="space-y-8">
      {/* Zero-Touch Upload Zone */}
      <div className="bg-gradient-to-br from-ledger-accent to-[#1557b0] rounded-[40px] p-4 md:p-10 text-white relative overflow-hidden group shadow-2xl shadow-ledger-accent/20">
        <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
          <Zap size={160} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-[32px] flex items-center justify-center border border-white/20">
                <Zap size={24} className="text-white" />
              </div>
              <h2 className="text-3xl font-black tracking-tight uppercase italic">Autonomous Reconciliation</h2>
            </div>
            <p className="text-white/80 font-medium leading-relaxed text-lg">
              Synthesize your financial data. Drop receipts to automatically extract lineage, detect taxation nodes, and match operational flows.
            </p>
          </div>

          <label className="shrink-0 cursor-pointer group/upload">
            <input 
              type="file" 
              className="hidden" 
              accept="image/*,application/pdf"
              onChange={(e) => handleFileChange(e)}
            />
            <div className="px-12 py-8 bg-white/10 hover:bg-white/20 backdrop-blur-xl border-2 border-dashed border-white/30 rounded-[32px] flex flex-col items-center gap-4 transition-all group-hover/upload:border-white/60 shadow-xl">
              <Upload className="text-white" size={40} />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Deploy Document</span>
            </div>
          </label>
        </div>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/50 border border-slate-200 rounded-[32px] p-4 md:p-8 text-slate-900 relative overflow-hidden group hover:border-indigo-600/40 transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
            <Inbox size={80} className="text-indigo-600" />
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 opacity-50">Pending Analysis</p>
          <p className="text-3xl md:text-5xl font-black italic tracking-tighter">{pendingTransactions.length}</p>
          <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest bg-white/5 py-1 px-3 rounded-full inline-block">Awaiting Categorization</p>
        </div>
        
        <div className="bg-white/50 border border-slate-200 rounded-[32px] p-4 md:p-8 text-slate-900 relative overflow-hidden group hover:border-indigo-600/40 transition-all">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 opacity-50">Selected Clusters</p>
          <p className="text-3xl md:text-5xl font-black italic tracking-tighter text-indigo-600">{selectedIds.length}</p>
          <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase tracking-widest bg-white/5 py-1 px-3 rounded-full inline-block">Active Selection Pool</p>
        </div>

        <div className="bg-emerald-500 text-white rounded-[32px] p-4 md:p-8 relative overflow-hidden group shadow-xl shadow-emerald-500/10">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform text-white">
            <CheckCircle2 size={80} />
          </div>
          <p className="text-[10px] font-black text-white border-b border-slate-50/20 pb-2 mb-3 uppercase tracking-[0.2em] opacity-60">Success Vectors</p>
          <p className="text-3xl md:text-5xl font-black italic tracking-tighter">0</p>
          <p className="text-[10px] text-white mt-3 font-bold uppercase tracking-widest opacity-80">Autonomous Pattern Matches</p>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-slate-50 p-4 md:p-8 rounded-[40px] border border-indigo-600 shadow-[0_0_50px_rgba(26,115,232,0.15)] flex flex-col lg:flex-row items-center gap-8 sticky top-4 z-50 backdrop-blur-md"
          >
            <div className="flex items-center gap-4 shrink-0">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center font-black text-xl shadow-xl shadow-ledger-accent/30">
                {selectedIds.length}
              </div>
              <div className="uppercase">
                <p className="text-[10px] font-black text-slate-500 tracking-widest opacity-50">Global Cluster Action</p>
                <p className="text-sm font-black text-slate-900 italic">Assign Architectural Mapping</p>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Classification (e.g. INFRASTRUCTURE)"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm font-bold text-slate-900 uppercase tracking-tight"
                />
              </div>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <select 
                  value={bulkAccount}
                  onChange={(e) => setBulkAccount(e.target.value)}
                  className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm font-bold text-slate-900 appearance-none cursor-pointer uppercase tracking-tight"
                >
                  <option value="" className="bg-slate-50">Destination Node...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.name} className="bg-slate-50">{acc.name} [{acc.code}]</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              onClick={handleBulkAction}
              disabled={!bulkCategory || !bulkAccount}
              className="px-10 py-4 bg-indigo-600 text-white rounded-[32px] font-black text-xs hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale shrink-0 uppercase tracking-[0.2em] shadow-xl shadow-ledger-accent/20"
            >
              Commit Mapping
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction List */}
      <div className="bg-white/30 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden backdrop-blur-sm">
        <div className="p-4 md:p-10 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-slate-50/10">
          <div className="flex items-center gap-6">
            <button 
              onClick={toggleSelectAll}
              className="p-3 text-slate-500 hover:text-indigo-600 transition-all hover:bg-slate-50 rounded-xl"
            >
              {selectedIds.length === pendingTransactions.length && pendingTransactions.length > 0 ? (
                <CheckSquare size={28} className="text-indigo-600" />
              ) : (
                <Square size={28} />
              )}
            </button>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Signal Inbox</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-50 mt-1">Operational Flow Pre-Categorization</p>
            </div>
          </div>
          
          <div className="flex-1 w-full md:w-auto relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
              <input 
                type="text" 
                placeholder="Search signal stream..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-14 pr-8 py-4 bg-slate-50 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm font-bold text-slate-900 w-full md:w-80 shadow-inner"
              />
          </div>
        </div>

        <div className="h-[600px] min-h-0">
          {pendingTransactions.length === 0 ? (
            <div className="p-32 text-center space-y-6">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[32px] flex items-center justify-center text-emerald-500 mx-auto shadow-2xl shadow-emerald-500/5">
                <CheckCircle2 size={48} />
              </div>
              <div>
                <h4 className="text-2xl font-black text-slate-900 uppercase italic">Zen Matrix Achieved</h4>
                <p className="text-sm text-slate-500 mt-2 font-medium opacity-60">All operational signals have been reconciled with architectural nodes.</p>
              </div>
            </div>
          ) : (
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  itemCount={pendingTransactions.length}
                  itemSize={130}
                  width={width}
                  className="py-6"
                  itemData={itemData}
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          )}
        </div>
      </div>
    </div>
  );
}
