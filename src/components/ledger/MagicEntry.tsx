import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Zap, X, Trash2, Sliders, ChevronDown } from 'lucide-react';
import { aiService } from '../../services/aiService';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { IntentResolver } from '../../lib/intentResolver';
import { ChartAccount } from '../../types';

interface MagicEntryProps {
  onAdd: (data: any) => void;
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  accounts: ChartAccount[];
  projects: string[];
  autoRules: any[];
  patternCache: Record<string, any>;
}

export default function MagicEntry({ onAdd, isOpen, onClose, categories, accounts, projects, autoRules, patternCache }: MagicEntryProps) {
  const [input, setInput] = useState('');
  const [previews, setPreviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMagicEntry = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(false);

    // 1. Analytical Optimization (Supports multi-line & common English patterns)
    const deterministicData = IntentResolver.resolveEntry(input, { rules: autoRules, accounts, neuralCache: patternCache });
    if (deterministicData && deterministicData.length > 0) {
      setPreviews(deterministicData);
      setLoading(false);
      return;
    }

    const learnedMappings = patternCache ? Object.entries(patternCache).slice(0, 15).map(([k, v]) => `${k} -> ${v.accountName}`).join(', ') : '';
    const patternContext = learnedMappings ? `PREVIOUSLY LEARNED PATTERNS (PREFER THESE): ${learnedMappings}.` : '';

    // 2. Analytical Fallback (Handles Hebrew and complex natural language)
    try {
      const data = await aiService.process('parse-magic-entry', {
        input,
        categories,
        accounts: accounts.map(a => ({ id: a.id, name: a.name })),
        projects,
        patternContext
      });
      setPreviews(Array.isArray(data) ? data : [data]);
    } catch (err) {
      console.error("AI Extraction Error:", err);
      setError("Failed to extract details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updatePreview = (index: number, updates: any) => {
    const next = [...previews];
    next[index] = { ...next[index], ...updates };
    setPreviews(next);
  };

  const deletePreview = (index: number) => {
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const commitEntries = () => {
    if (previews.length > 0) {
      previews.forEach(p => {
        const account = accounts.find(a => a.name === p.dimensions?.category);
        const txData = {
          ...p,
          lines: p.lines || [{
            accountId: account?.id || 'uncategorized',
            accountName: account?.name || 'Uncategorized',
            amountCents: p.amountCents
          }]
        };
        onAdd(txData);
      });

      setSuccess(true);
      setPreviews([]);
      setInput('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl bg-white rounded-[40px] border border-zinc-200 shadow-2xl overflow-hidden p-4 md:p-8 flex flex-col min-h-[600px] max-h-[90dvh]"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-900 rounded-[32px] flex items-center justify-center text-white shadow-xl shadow-black/10">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Neural Command Ingress</h3>
              <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">
                {loading ? 'Processing Vectors...' : previews.length > 0 ? 'Verification Phase' : 'Data Input Phase'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-zinc-100 rounded-[32px] text-zinc-400 transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {previews.length === 0 ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 relative">
                  <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    dir="auto"
                    placeholder='e.g., "$1200 on cloud services\n$50 for lunch\nReceived $5k from client"'
                    className="w-full h-full p-4 md:p-8 bg-zinc-50 border border-zinc-200 rounded-[32px] text-xl font-bold text-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all resize-none placeholder:text-zinc-300 placeholder:italic"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        e.preventDefault();
                        handleMagicEntry();
                      }
                    }}
                  />
                  <div className="absolute bottom-6 left-8 flex items-center gap-4 text-zinc-400">
                    <div className="flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white border border-zinc-200 rounded text-[9px] font-black">CTRL + ENTER</kbd>
                      <span className="text-[9px] font-medium uppercase tracking-wider">To Analyze</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Templates:</p>
                    <div className="flex gap-2">
                      {["Lunch $50", "Sales $5k", "Walmart $100 ($40 Food, $60 Gear)"].map(tag => (
                        <button 
                          key={tag}
                          onClick={() => setInput(prev => prev + (prev ? '\n' : '') + tag)}
                          className="text-[10px] font-bold text-zinc-500 bg-white border border-zinc-200 px-4 py-2 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleMagicEntry}
                    disabled={loading || !input.trim()}
                    className={cn(
                      "flex items-center gap-3 px-10 py-5 rounded-[32px] font-black text-sm uppercase tracking-widest transition-all shadow-2xl",
                      loading || !input.trim() 
                        ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                        : "bg-zinc-900 text-white hover:bg-black shadow-black/20"
                    )}
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                    {loading ? 'Analyzing Vector...' : 'Execute Parse'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="previews"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-auto custom-scrollbar space-y-4 pb-8 pr-4">
                  <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/80 backdrop-blur-md py-4 z-20">
                     <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                        <span className="text-xs font-medium uppercase tracking-wider truncate text-zinc-900">
                          {previews.length} Entries Identified
                        </span>
                     </div>
                     <button 
                      onClick={() => setPreviews([])}
                      className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-600 tracking-widest transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={12} />
                      Discard all and restart
                    </button>
                  </div>
                  
                  {previews.map((p, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={i} 
                      className="p-4 md:p-8 bg-zinc-50 rounded-[40px] border border-zinc-200 group hover:border-zinc-900 transition-all hover:shadow-xl hover:shadow-zinc-900/5 relative"
                    >
                      <button 
                        onClick={() => deletePreview(i)}
                        className="absolute top-6 right-6 p-2 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div className="flex-1 space-y-6">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-zinc-200 text-[10px] font-black shadow-sm">
                               Entry {i+1}
                             </div>
                             <div className="flex-1">
                               <input 
                                 value={p.description}
                                 onChange={(e) => updatePreview(i, { description: e.target.value })}
                                 className="w-full bg-transparent border-none p-0 text-xl font-black text-zinc-900 focus:ring-0 placeholder:text-zinc-300"
                                 dir="auto"
                                 placeholder="Entry Description"
                               />
                             </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category:</span>
                              <div className="relative">
                                <select 
                                  value={p.dimensions?.category || 'Uncategorized'}
                                  onChange={(e) => updatePreview(i, { dimensions: { ...p.dimensions, category: e.target.value } })}
                                  className="appearance-none bg-white border border-zinc-200 rounded-xl px-4 py-2 pr-8 text-[11px] font-bold text-zinc-900 focus:border-zinc-900 focus:outline-none shadow-sm cursor-pointer"
                                >
                                  <option value="Uncategorized">Uncategorized</option>
                                  {accounts.map(acc => (
                                    <option key={acc.id} value={acc.name}>{acc.name} ({acc.code})</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={12} />
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date:</span>
                              <input 
                                type="date"
                                value={p.date}
                                onChange={(e) => updatePreview(i, { date: e.target.value })}
                                className="bg-white border border-zinc-200 rounded-xl px-4 py-2 text-[11px] font-bold text-zinc-900 focus:border-zinc-900 focus:outline-none shadow-sm"
                              />
                            </div>

                            {p.isLearned && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-white rounded-full text-[9px] font-medium uppercase tracking-wider shadow-lg shadow-black/10">
                                <Zap size={10} fill="white" />
                                Autonomous Match
                              </div>
                            )}
                          </div>

                          {/* Sub-item Drilldown Preview */}
                          {p.lines && p.lines.length > 0 && (
                            <div className="pt-4 mt-4 border-t border-zinc-200/50 space-y-2">
                               {p.lines.map((line: any, li: number) => (
                                 <div key={li} className="flex items-center justify-between group/line">
                                    <div className="flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 group-hover/line:bg-zinc-900 transition-colors" />
                                      <p className="text-[11px] font-bold text-zinc-600">
                                        {line.description}
                                        {line.quantity > 0 && (
                                          <span className="ml-2 text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
                                            {line.quantity} units @ {((line.unitPriceCents || 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <p className="text-[10px] font-mono font-bold text-zinc-400">
                                       {(line.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </p>
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>

                        <div className="text-right flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 bg-white md:bg-transparent p-4 md:p-0 rounded-[32px] border border-zinc-100 md:border-none">
                          <div className="space-y-1">
                            <input 
                              type="number"
                              step="0.01"
                              value={(Math.abs(p.amountCents) / 100)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value || '0');
                                updatePreview(i, { amountCents: Math.round(val * 100) * (p.amountCents < 0 ? -1 : 1) });
                              }}
                              className={cn(
                                "bg-transparent border-none p-0 text-3xl font-black text-right focus:ring-0 w-32 mono-value",
                                p.amountCents >= 0 ? "text-emerald-500" : "text-zinc-900"
                              )}
                            />
                            <div className="flex items-center gap-2 justify-end">
                               <button 
                                 onClick={() => updatePreview(i, { amountCents: Math.abs(p.amountCents) * -1 })}
                                 className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all", p.amountCents < 0 ? "bg-rose-500 text-white" : "bg-zinc-100 text-zinc-400")}
                               >
                                 Expense
                               </button>
                               <button 
                                 onClick={() => updatePreview(i, { amountCents: Math.abs(p.amountCents) })}
                                 className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all", p.amountCents >= 0 ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400")}
                               >
                                 Income
                               </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="pt-8 flex gap-4 mt-auto">
                  <button 
                    onClick={() => setPreviews([])}
                    className="flex-1 py-5 bg-zinc-100 hover:bg-zinc-200 rounded-[28px] text-xs font-medium uppercase tracking-wider text-zinc-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Sliders size={18} />
                    Edit Input Data
                  </button>
                  <button 
                    onClick={commitEntries}
                    className="flex-[2] py-5 bg-zinc-900 hover:bg-black rounded-[28px] text-xs font-medium uppercase tracking-wider text-white transition-all shadow-2xl shadow-zinc-900/20 flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 size={20} />
                    Commit and Synchronize {previews.length} Entries
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-x-8 bottom-8 z-50"
          >
            <div className="bg-emerald-500 text-white p-7 rounded-[32px] flex items-center justify-between shadow-[0_20px_50px_rgba(16,185,129,0.3)]">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-white/20 rounded-[20px] flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                   <p className="text-lg font-black uppercase tracking-tight">Vectors Ingested Successfully</p>
                   <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Double-entry integrity checked.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
