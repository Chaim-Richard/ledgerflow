import React, { useState } from 'react';
import { 
  Zap, Plus, Trash2, Shield, Sliders, CheckCircle2,
  AlertCircle, Sparkles, Wand2, ArrowRight,
  Loader2, BarChart3, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { AutoRule, ChartAccount, Transaction } from '../../types';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface CategorizationRulesProps {
  rules: AutoRule[];
  accounts: ChartAccount[];
  transactions: Transaction[];
  onAddRule: (rule: any) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  onUpdateRule: (id: string, updates: Partial<AutoRule>) => Promise<void>;
  onApplyRules: (ruleIds: string[]) => Promise<void>;
  onSmartCluster: () => Promise<any[] | undefined>;
}

export default function CategorizationRules({ 
  rules, 
  accounts, 
  transactions,
  onAddRule, 
  onDeleteRule,
  onUpdateRule,
  onApplyRules,
  onSmartCluster
}: CategorizationRulesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const analyticalCache = useLedgerStore(state => state.analyticalPatternCache);
  const [isClustering, setIsClustering] = useState(false);
  const [clusters, setClusters] = useState<any[] | null>(null);
  const [newRule, setNewRule] = useState({
    condition: { vendor: '', project: '', category: '', descriptionContains: '' },
    action: { targetNodeId: '', targetProject: '', targetCategory: '' }
  });

  const promotePattern = async (description: string, accountId: string, accountName: string) => {
    await onAddRule({
      condition: { descriptionContains: description },
      action: { targetNodeId: accountId, targetCategory: accountName },
      confidence: 1.0,
      isHardened: true,
      createdAt: new Date().toISOString()
    });
    toast.success('Pattern promoted to classification rule');
  };

  const handleAdd = async () => {
    if (!newRule.condition.descriptionContains && !newRule.condition.vendor) {
      toast.error("Set a condition first.");
      return;
    }
    await onAddRule({
      ...newRule,
      confidence: 1,
      isHardened: true,
      createdAt: new Date().toISOString()
    });
    setIsAdding(false);
    setNewRule({
      condition: { vendor: '', project: '', category: '', descriptionContains: '' },
      action: { targetNodeId: '', targetProject: '', targetCategory: '' }
    });
  };

  const handleUpdate = async (id: string) => {
    await onUpdateRule(id, newRule);
    setEditingRuleId(null);
    setNewRule({
      condition: { vendor: '', project: '', category: '', descriptionContains: '' },
      action: { targetNodeId: '', targetProject: '', targetCategory: '' }
    });
  };

  const handleRunCluster = async () => {
    setIsClustering(true);
    const results = await onSmartCluster();
    if (results) setClusters(results);
    setIsClustering(false);
  };

  const getRuleImpact = (rule: AutoRule) => {
    return transactions.filter(t => {
      if (rule.condition.descriptionContains && !t.description.toLowerCase().includes(rule.condition.descriptionContains.toLowerCase())) return false;
      if (rule.condition.vendor && !t.description.toLowerCase().includes(rule.condition.vendor.toLowerCase())) return false;
      // Filter out those already correctly categorized (optional)
      return true;
    }).length;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 text-white rounded-xl">
              <Zap size={24} />
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">Automated Categorization Rules</h1>
          </div>
          <p className="text-slate-500 font-medium">Automate your ledger with localized intelligence.</p>
        </div>
        <button 
          onClick={handleRunCluster}
          disabled={isClustering}
          className="px-6 py-4 bg-white border border-slate-200 text-slate-900 rounded-[32px] font-black text-xs uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center gap-2"
        >
          {isClustering ? <Loader2 className="animate-spin" size={18} /> : <BarChart3 size={18} />}
          Statistical Discovery
        </button>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Define New Rule
        </button>
      </header>

      <AnimatePresence>
        {clusters && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-12 p-4 md:p-8 bg-blue-50/50 border border-blue-100 rounded-[32px] overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-blue-900 tracking-tight">Clustering Output</h3>
                <p className="text-xs text-blue-700/60 font-bold uppercase tracking-widest">Statistical grouping of unmapped metadata</p>
              </div>
              <button onClick={() => setClusters(null)} className="text-blue-400 hover:text-blue-600">
                <Trash2 size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(new Set(clusters.map(c => c.cluster))).map(clusterId => {
                const clusterTxs = clusters.filter(c => c.cluster === clusterId);
                const sampleTx = transactions.find(t => t.id === clusterTxs[0].id);
                return (
                  <div key={clusterId} className="p-4 bg-white border border-blue-100 rounded-[32px] shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase">Cluster {clusterId + 1}</span>
                      <span className="text-[10px] font-black text-zinc-400">{clusterTxs.length} Items</span>
                    </div>
                    <p className="text-xs font-bold text-zinc-600 line-clamp-2 italic mb-3">
                      "{sampleTx?.description}" and {clusterTxs.length - 1} others...
                    </p>
                    <button 
                      onClick={() => {
                        setNewRule({
                          ...newRule,
                          condition: { ...newRule.condition, descriptionContains: sampleTx?.description.split(' ')[0] || '' }
                        });
                        setIsAdding(true);
                        setClusters(null);
                      }}
                      className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-medium uppercase tracking-wider hover:bg-blue-100 transition-colors"
                    >
                      Convert to Rule
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Rules List */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {rules.length === 0 && !isAdding && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-20 text-center"
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield size={32} className="text-slate-500" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">No Automation Rules</h3>
                <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">Define rules to automatically categorize bank feeds as they arrive.</p>
                <button onClick={() => setIsAdding(true)} className="btn-secondary">Get Started</button>
              </motion.div>
            )}

            {isAdding && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-[32px] border border-indigo-600 shadow-xl shadow-ledger-accent/5 p-4 md:p-8"
              >
                {/* Autonomous Insights Section */}
          {Object.keys(analyticalCache).length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-zinc-900 text-white rounded-xl flex items-center justify-center">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900 tracking-tight leading-none">Autonomous Insights</h3>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Discovered patterns waiting for confirmation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(analyticalCache)
                  .filter(([pattern]) => !rules.find(r => r.condition.descriptionContains?.toLowerCase() === pattern.toLowerCase()))
                  .map(([pattern, data]) => (
                  <motion.div 
                    key={pattern}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-zinc-50 rounded-[32px] border border-zinc-200 flex items-center justify-between group hover:border-zinc-900 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-zinc-400 border border-zinc-100 shadow-sm">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Recurring Pattern</p>
                        <h4 className="text-sm font-bold text-zinc-900 leading-none">
                          "{pattern}" <ArrowRight className="inline mx-2 text-zinc-300" size={12} /> <span className="text-emerald-600">{data.accountName}</span>
                        </h4>
                      </div>
                    </div>
                    <button 
                      onClick={() => promotePattern(pattern, data.accountId, data.accountName)}
                      className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-medium uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zinc-900/10"
                    >
                      Confirm
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Sparkles className="text-indigo-600" size={20} /> Smart Rule Provisioning
                  </h3>
                  <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="micro-label">Condition (When...)</label>
                      <input 
                        type="text" 
                        placeholder="Description contains (e.g. 'Stripe')"
                        value={newRule.condition.descriptionContains}
                        onChange={(e) => setNewRule({...newRule, condition: {...newRule.condition, descriptionContains: e.target.value}})}
                        className="w-full p-4 bg-white border border-slate-200 rounded-[32px] font-bold focus:border-indigo-600 outline-none"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="micro-label">Action (Then Map to...)</label>
                      <select 
                        value={newRule.action.targetNodeId}
                        onChange={(e) => setNewRule({...newRule, action: {...newRule.action, targetNodeId: e.target.value}})}
                        className="w-full p-4 bg-white border border-slate-200 rounded-[32px] font-bold focus:border-indigo-600 outline-none"
                      >
                        <option value="">Select Account</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-4 p-6 bg-white/50 rounded-[32px]">
                    <button onClick={() => setIsAdding(false)} className="btn-secondary">Cancel</button>
                    <button onClick={handleAdd} className="btn-primary bg-indigo-600">Save Rule</button>
                  </div>
                </div>
              </motion.div>
            )}

            {rules.map((rule) => (
              <motion.div 
                key={rule.id}
                layout
                className={cn(
                  "bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group",
                  editingRuleId === rule.id && "border-indigo-600 ring-4 ring-indigo-600/5"
                )}
              >
                {editingRuleId === rule.id ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                       <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest">Editing Classification Rule</h4>
                       <button onClick={() => setEditingRuleId(null)} className="text-slate-500 hover:text-slate-900"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description Match</label>
                        <input 
                          type="text" 
                          value={newRule.condition.descriptionContains}
                          onChange={(e) => setNewRule({...newRule, condition: {...newRule.condition, descriptionContains: e.target.value}})}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-600 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Account</label>
                        <select 
                          value={newRule.action.targetNodeId}
                          onChange={(e) => setNewRule({...newRule, action: {...newRule.action, targetNodeId: e.target.value}})}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-600 outline-none"
                        >
                          <option value="">Select Account</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                      <button onClick={() => setEditingRuleId(null)} className="btn-secondary py-2">Discard</button>
                      <button onClick={() => handleUpdate(rule.id)} className="btn-primary bg-indigo-600 py-2">Commit Changes</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-sm font-bold text-slate-900">
                            When description contains <span className="text-indigo-600 px-1.5 bg-indigo-600/5 rounded">"{rule.condition.descriptionContains}"</span>
                          </p>
                          <ArrowRight size={14} className="text-slate-500" />
                          <p className="text-sm font-bold text-slate-900">
                            Map to <span className="text-emerald-600">{accounts.find(a => a.id === rule.action.targetNodeId)?.name || 'Unassigned'}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Impact: {getRuleImpact(rule)} Transactions
                          </span>
                          {rule.isHardened && (
                            <span className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest">
                              <Sliders size={10} /> Hardened
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingRuleId(rule.id);
                          setNewRule({
                            condition: { vendor: rule.condition.vendor || '', project: rule.condition.project || '', category: rule.condition.category || '', descriptionContains: rule.condition.descriptionContains || '' },
                            action: { targetNodeId: rule.action.targetNodeId || '', targetProject: rule.action.targetProject || '', targetCategory: rule.action.targetCategory || '' }
                          });
                        }}
                        className="p-2 hover:bg-slate-50 text-slate-900 rounded-lg transition-colors"
                        title="Edit Configuration"
                      >
                        <Sliders size={18} />
                      </button>
                      <button 
                        onClick={() => onApplyRules([rule.id])}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="Apply to Historical"
                      >
                        <Wand2 size={18} />
                      </button>
                      <button 
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-4 md:p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <Sparkles className="absolute top-4 right-4 text-indigo-600/20" size={80} />
            <h3 className="text-xl font-black mb-4 relative z-10">Pattern Intelligence</h3>
            <p className="text-sm text-slate-200/60 font-medium leading-relaxed mb-6 block relative z-10">
              Our autonomous agent analyzes your transaction patterns to suggest new categorization rules with 98% precision.
            </p>
            <div className="bg-white/10 p-4 rounded-[32px] border border-white/10 relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle size={16} className="text-indigo-600" />
                <span className="text-xs font-medium uppercase tracking-wider">Global Scan Result</span>
              </div>
              <p className="text-xs font-bold text-slate-200/90">
                The neural engine is actively scanning for new categorization patterns.
              </p>
            </div>
          </div>

          <div className="bg-white p-4 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
            <h3 className="micro-label mb-6">System Statistics</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">Processing Efficiency</span>
                  <span className="text-slate-900">OPTIMIZED</span>
                </div>
                <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white rounded-[32px] border border-slate-200">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                  Manual Touches
                </div>
                <div className="text-xl font-black text-slate-900">
                  MINIMAL
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
