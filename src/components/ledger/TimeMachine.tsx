import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useScenarioStore } from '../../lib/scenarioStore';
import { GitMerge, GitCommit, GitPullRequest, GitBranch, RotateCcw, Clock, ArrowRight, Save, Trash2, Zap, CheckCircle2, AlertCircle, Plus, FileText, Activity } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function TimeMachine() {
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  
  const scenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  const addScenario = useScenarioStore(s => s.addScenario);
  const toggleScenario = useScenarioStore(s => s.toggleScenario);
  const deleteScenario = useScenarioStore(s => s.deleteScenario);
  const addGhost = useScenarioStore(s => s.addGhost);
  const deleteGhost = useScenarioStore(s => s.deleteGhost);

  const [activeTab, setActiveTab] = useState<'history' | 'branches' | 'diff'>('branches');
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDesc, setNewBranchDesc] = useState('');
  
  const [showNewGhostModal, setShowNewGhostModal] = useState<string | null>(null); // scenario id
  const [ghostForm, setGhostForm] = useState({ description: '', amount: '', type: 'expense' as const });
  const [expandedCommitHash, setExpandedCommitHash] = useState<string | null>(null);

  // Group transactions by date as "commits"
  const commitList = useMemo(() => {
    const commits = transactions.reduce((acc, tx) => {
      const date = tx.date;
      if (!acc[date]) {
        acc[date] = { date, id: tx.id, hash: tx.verification?.hash || Math.random().toString(36).substring(7), txs: [] };
      }
      acc[date].txs.push(tx);
      return acc;
    }, {} as Record<string, any>);
    return Object.values(commits).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const handleCreateBranch = () => {
    if (!newBranchName) return;
    addScenario(newBranchName, newBranchDesc);
    setShowNewBranchModal(false);
    setNewBranchName('');
    setNewBranchDesc('');
  };

  const handleAddGhost = (scenarioId: string) => {
    if (!ghostForm.description || !ghostForm.amount) return;
    addGhost(scenarioId, {
      description: ghostForm.description,
      amountCents: Math.round(parseFloat(ghostForm.amount) * 100),
      date: new Date().toISOString().split('T')[0],
      frequency: 'once',
      type: ghostForm.type
    });
    setShowNewGhostModal(null);
    setGhostForm({ description: '', amount: '', type: 'expense' });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-[var(--text)] tracking-tight flex items-center gap-3">
            <GitMerge className="text-[#0047AB]" size={32} />
            Version Control
          </h2>
          <p className="text-slate-500 font-medium mt-1">Git for your books. Fearless scenario testing and immutable history.</p>
        </div>
        <button 
          onClick={() => setShowNewBranchModal(true)}
          className="h-10 px-4 bg-slate-900 hover:bg-[#0047AB] text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md"
        >
          <GitBranch size={16} />
          Try something (New Branch)
        </button>
      </div>

      <div className="flex gap-4 border-b border-[var(--line)]">
        {[
          { id: 'branches', icon: GitBranch, label: 'Scenario Branches' },
          { id: 'history', icon: Clock, label: 'Commit History' },
          { id: 'diff', icon: GitPullRequest, label: 'Period Diff' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "pb-3 px-2 text-sm font-bold flex items-center gap-2 transition-all border-b-2",
              activeTab === tab.id 
                ? 'border-[#0047AB] text-[#0047AB]' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map(scenario => {
            const isActive = activeScenarioId === scenario.id;
            const isMain = scenario.id === 'default-scenario';
            return (
              <div key={scenario.id} className={cn(
                "bg-[var(--surface)] rounded-2xl border-2 p-6 relative transition-all shadow-sm",
                isActive ? "border-[#0047AB]" : "border-[var(--line)] hover:border-slate-300",
                isMain ? "bg-[var(--ink)]/50" : ""
              )}>
                {isActive && (
                  <div className="absolute top-0 right-0 bg-[#0047AB] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">Checked Out</div>
                )}
                {isMain && !isActive && (
                  <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">Main Reality</div>
                )}
                
                <h3 className="font-black text-[var(--text)] text-lg flex items-center gap-2 mb-2">
                  <GitBranch size={20} className={isActive ? "text-[#0047AB]" : "text-slate-400"} />
                  {scenario.name}
                </h3>
                <p className="text-sm text-slate-500 mb-6 h-10">{scenario.description}</p>
                
                {!isMain && (
                  <div className="mb-6 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex justify-between items-center">
                      Simulated Entries
                      <button 
                        onClick={() => setShowNewGhostModal(scenario.id)}
                        className="text-[#0047AB] hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </h4>
                    {scenario.ghosts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No simulated entries yet.</p>
                    ) : (
                      scenario.ghosts.map(ghost => (
                        <div key={ghost.id} className="flex items-center justify-between bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                          <div>
                            <p className="text-sm font-medium text-[var(--text)]">{ghost.description}</p>
                            <p className="text-xs text-slate-500">{ghost.type} • {ghost.frequency}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn("font-mono font-bold text-sm", ghost.type === 'expense' ? "text-red-600" : "text-green-600")}>
                              {ghost.type === 'expense' ? '-' : '+'}{formatCurrency(ghost.amountCents)}
                            </span>
                            <button onClick={() => deleteGhost(scenario.id, ghost.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {showNewGhostModal === scenario.id && (
                      <div className="bg-slate-100 p-3 rounded-xl space-y-3 mt-3">
                        <input 
                          type="text" 
                          placeholder="e.g. Purchase Delivery Truck" 
                          className="w-full text-sm p-2 rounded-lg border border-[var(--line)]"
                          value={ghostForm.description}
                          onChange={e => setGhostForm({...ghostForm, description: e.target.value})}
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="Amount" 
                            className="w-1/2 text-sm p-2 rounded-lg border border-[var(--line)]"
                            value={ghostForm.amount}
                            onChange={e => setGhostForm({...ghostForm, amount: e.target.value})}
                          />
                          <select 
                            className="w-1/2 text-sm p-2 rounded-lg border border-[var(--line)]"
                            value={ghostForm.type}
                            onChange={e => setGhostForm({...ghostForm, type: e.target.value as any})}
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowNewGhostModal(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                          <button onClick={() => handleAddGhost(scenario.id)} className="px-3 py-1.5 text-xs font-bold bg-[#0047AB] text-white rounded-lg">Add Entry</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-auto">
                  {!isActive && (
                    <button 
                      onClick={() => toggleScenario(scenario.id)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-[var(--text)] py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      Checkout (View Dashboard)
                    </button>
                  )}
                  {isActive && !isMain && (
                    <button 
                      className="flex-1 bg-[#0047AB] hover:bg-blue-800 text-white py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      Merge to Main
                    </button>
                  )}
                  {!isMain && (
                    <button onClick={() => deleteScenario(scenario.id)} className="p-2 bg-[var(--ink)] hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4">
            <div className="w-12 h-12 bg-[var(--surface)] rounded-xl shadow-sm flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-[#0047AB]" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-[var(--text)] text-lg">Provable History</h4>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">Every posting batch is a cryptographically chained commit. You can checkout any point in time to view the ledger exactly as it was. Your auditor's dream.</p>
            </div>
          </div>
          
          <div className="relative border-l-2 border-[var(--line)] ml-6 space-y-8 py-6">
            {commitList.map((commit: any) => (
              <div key={commit.id} className="relative pl-8 group">
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-slate-300 group-hover:bg-[#0047AB] transition-colors" />
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[var(--text)] text-lg">{new Date(commit.date).toLocaleDateString()}</span>
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{commit.hash.substring(0, 7)}</span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        <Activity size={14} />
                        Posted {commit.txs.length} transactions
                      </div>
                    </div>
                    <button className="text-xs font-bold text-[#0047AB] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                      <RotateCcw size={14} />
                      Checkout
                    </button>
                  </div>
                  
                  <div className="space-y-1 mt-4">
                    {(expandedCommitHash === commit.hash ? commit.txs : commit.txs.slice(0, 3)).map((tx: any) => (
                      <div key={tx.id} className="text-sm py-2 flex justify-between border-t border-slate-50">
                        <span className="text-slate-700 font-medium truncate flex items-center gap-2">
                          <FileText size={14} className="text-slate-400" />
                          {tx.description || 'Unknown'}
                        </span>
                        <span className="font-mono text-[var(--text)] font-bold ml-4">{formatCurrency(tx.totalAmountCents, tx.currency)}</span>
                      </div>
                    ))}
                    {commit.txs.length > 3 && (
                      <button 
                        onClick={() => setExpandedCommitHash(expandedCommitHash === commit.hash ? null : commit.hash)}
                        className="text-xs text-[#0047AB] font-bold mt-2 pt-3 border-t border-slate-50 cursor-pointer hover:underline block w-full text-left"
                      >
                        {expandedCommitHash === commit.hash ? 'Show Less' : `+ View ${commit.txs.length - 3} more entries`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'diff' && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-[var(--ink)] rounded-full flex items-center justify-center mx-auto mb-6">
            <GitPullRequest className="text-slate-400" size={40} />
          </div>
          <h3 className="text-2xl font-black text-[var(--text)] mb-3">Period Differences (Diff)</h3>
          <p className="text-slate-500 max-w-lg mx-auto text-lg">Compare changes between any two points in time. See exactly what changed in Q1 since you filed your taxes — in one click.</p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <select className="border border-[var(--line)] rounded-xl px-4 py-3 text-sm font-bold text-slate-700 shadow-sm focus:border-[#0047AB] outline-none">
              <option>Tax Filing (March 15)</option>
              <option>Q1 Close (April 1)</option>
            </select>
            <ArrowRight className="text-slate-400" size={20} />
            <select className="border border-[var(--line)] rounded-xl px-4 py-3 text-sm font-bold text-slate-700 shadow-sm focus:border-[#0047AB] outline-none">
              <option>Today (Live)</option>
            </select>
          </div>
          <button className="mt-8 px-8 py-3 bg-[#0047AB] hover:bg-blue-800 text-white font-bold text-sm rounded-xl transition-all shadow-md">
            Compute Diff
          </button>
        </div>
      )}

      {/* New Branch Modal */}
      <AnimatePresence>
        {showNewBranchModal && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm"
          >
            <div className="bg-[var(--surface)] rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[var(--line)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <GitBranch className="text-[#0047AB]" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[var(--text)]">New Scenario</h3>
                  <p className="text-sm text-slate-500">Fork your real books to try something safely.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Branch Name</label>
                  <input 
                    type="text" 
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    placeholder="e.g. hire-new-developer" 
                    className="w-full px-4 py-3 rounded-xl border border-[var(--line)] text-sm font-medium focus:border-[#0047AB] outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    value={newBranchDesc}
                    onChange={e => setNewBranchDesc(e.target.value)}
                    placeholder="What if we hire a new developer in Q3?" 
                    className="w-full px-4 py-3 rounded-xl border border-[var(--line)] text-sm font-medium focus:border-[#0047AB] outline-none transition-colors resize-none h-24"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowNewBranchModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-[var(--line)] text-slate-700 font-bold text-sm hover:bg-[var(--ink)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateBranch}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#0047AB] hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-colors"
                >
                  Create Branch
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
