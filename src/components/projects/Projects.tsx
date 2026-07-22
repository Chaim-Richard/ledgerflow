import React, { useState, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Project, Transaction, Budget, Vendor } from '../../types';
import { 
  BrainCircuit,
  Pencil,
  Plus, 
  Search, 
  FolderKanban, 
  Trash2,
  Target,
  Users,
  BookOpen,
  DollarSign,
  BarChart3,
  Calendar,
  LayoutDashboard,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeConfirm } from '../../lib/utils';
import { toast } from 'sonner';
import ProjectPipeline from './ProjectPipeline';

interface ProjectsProps {
  user: User;
  projects: Project[];
  transactions: Transaction[];
  budgets: Budget[];
  vendors: Vendor[];
  onAction: (action: string) => void;
  onAdd?: (data: any) => Promise<void>;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function Projects({ 
  user, 
  projects = [], 
  transactions = [], 
  budgets = [], 
  vendors = [], 
  onAction,
  onAdd,
  onUpdate,
  onDelete
}: ProjectsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'pipeline' | 'list'>('pipeline');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    description: '',
    type: 'general',
    status: 'active',
    budgetCents: 0
  });

  const handleAddProject = async () => {
    if (!newProject.name || !onAdd) return;
    setLoading(true);
    try {
      await onAdd({
        ...newProject,
        uid: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsNewProjectModalOpen(false);
      setNewProject({
        name: '',
        description: '',
        type: 'general',
        status: 'active',
        budgetCents: 0
      });
      toast.success('Project initialized successfully');
    } catch (err) {
      toast.error('Failed to initialize project');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !onUpdate) return;
    setLoading(true);
    try {
      await onUpdate(editingProject.id, editingProject);
      setEditingProject(null);
      toast.success('Project updated successfully');
    } catch (err) {
      toast.error('Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!onDelete || !safeConfirm('Are you sure you want to delete this project? All associations will remain but will point to a missing entity.')) return;
    try {
      await onDelete(id);
      if (selectedProjectId === id) setSelectedProjectId(null);
      toast.success('Project deep-deleted');
    } catch (err) {
      toast.error('Deletion failed');
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      const searchStr = `${p.name || ''} ${p.description || ''} ${p.tags?.join(' ') || ''} ${p.metadata ? JSON.stringify(p.metadata) : ''}`.toLowerCase();
      return searchStr.includes(term);
    });
  }, [projects, searchTerm]);

  const projectStats = useMemo(() => {
    const stats: Record<string, { actualCents: number, budgetCents: number, incomeCents: number, expenseCents: number }> = {};
    
    projects.forEach(p => {
      const projectTransactions = transactions.filter(t => t.lines?.some(l => l.project === p.id));
      let income = 0;
      let expense = 0;

      projectTransactions.forEach(t => {
        t.lines?.filter(l => l.project === p.id).forEach(l => {
          const accName = (l.accountName || '').toLowerCase();
          if (accName.includes('income') || accName.includes('revenue')) {
            income += Math.abs(l.amountCents);
          } else if (accName.includes('expense') || accName.includes('cost')) {
            expense += Math.abs(l.amountCents);
          }
        });
      });
      
      stats[p.id] = {
        actualCents: income - expense,
        budgetCents: p.budgetCents,
        incomeCents: income,
        expenseCents: expense
      };
    });
    
    return stats;
  }, [projects, transactions]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val / 100);

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
  [projects, selectedProjectId]);

  const projectVendors = useMemo(() => {
    if (!selectedProjectId) return [];
    // In a real app, we'd have a mapping. For now, let's find vendors who have transactions in this project.
    const vendorIds = new Set(
      transactions
        .filter(t => t.lines?.some(l => l.project === selectedProjectId) && t.metadata?.vendorId)
        .map(t => t.metadata?.vendorId)
    );
    return vendors.filter(v => vendorIds.has(v.id));
  }, [selectedProjectId, transactions, vendors]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header with brand gold backdrop */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[10px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <FolderKanban size={12} />
              DIMENSIONAL COST ARCHITECTURE
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Project & Initiative Tracking</h1>
            <p className="text-xs text-[var(--muted)] font-medium mt-1">Initiative performance management paired with multi-rule split protocol tracing.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center bg-[var(--surface)]/80 p-1 rounded-xl border border-[var(--line)] shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setActiveSubTab('pipeline')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all gap-1.5 flex items-center cursor-pointer",
                  activeSubTab === 'pipeline' 
                    ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                 <LayoutDashboard size={13} /> Board
              </button>
              <button
                onClick={() => setActiveSubTab('list')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all gap-1.5 flex items-center cursor-pointer",
                  activeSubTab === 'list' 
                    ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                <List size={13} /> List
              </button>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] group-focus-within:text-[var(--brass)] transition-colors" size={14} />
              <input 
                type="text"
                placeholder="Search projects or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl text-xs focus:outline-none focus:border-[var(--brass-line)] focus:ring-1 focus:ring-[var(--brass)] transition-all w-52 sm:w-60 text-[var(--text)] placeholder:text-[var(--faint)] font-medium"
              />
            </div>
            <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="h-9 px-4 bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black hover:opacity-95 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
            >
              <Plus size={15} />
              Initialize Project
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'pipeline' ? (
         <ProjectPipeline 
           projects={filteredProjects}
           onUpdateProject={async (id, data) => { if (onUpdate) await onUpdate(id, data); }}
         />
      ) : (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="xl:col-span-2 space-y-3">
          {filteredProjects.map((project) => {
            const stats = projectStats[project.id];
            const progress = stats.budgetCents > 0 ? (stats.expenseCents / stats.budgetCents) * 100 : 0;
            
            return (
              <motion.div 
                key={project.id}
                layoutId={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={cn(
                  "p-5 rounded-xl border transition-all cursor-pointer group relative overflow-hidden",
                  selectedProjectId === project.id 
                    ? "bg-slate-900 border-slate-950 text-white shadow-xs" 
                    : "bg-[var(--surface)] border-[var(--line)]/80 hover:border-slate-300 text-[var(--text)] shadow-3xs"
                )}
              >
                {selectedProjectId === project.id && (
                  <div className="absolute inset-0 technical-grid opacity-10 pointer-events-none" />
                )}
                
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                        selectedProjectId === project.id ? "bg-[var(--surface)]/10" : "bg-slate-100 border border-[var(--line)]/40"
                      )}>
                        <FolderKanban size={18} className={selectedProjectId === project.id ? "text-orange-300" : "text-slate-600"} />
                      </div>
                      <div dir="auto">
                        <h3 className="font-bold text-sm tracking-tight">{project.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider", selectedProjectId === project.id ? "bg-[var(--surface)]/10 text-white" : "bg-slate-100 text-slate-600")}>
                            {project.type}
                          </span>
                          <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border", selectedProjectId === project.id ? "border-white/10 text-white/80" : "border-[var(--line)] text-slate-400")}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 bg-[var(--surface)]/5 p-0.5 rounded-lg border border-slate-250/10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                          }}
                          className={cn(
                            "p-1.5 rounded-md transition-all",
                            selectedProjectId === project.id ? "text-white/80 hover:text-white hover:bg-[var(--surface)]/10" : "text-slate-400 hover:text-[var(--text)] hover:bg-[var(--ink)]"
                          )}
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                          className={cn(
                            "p-1.5 rounded-md transition-all",
                            selectedProjectId === project.id ? "text-white/80 hover:text-red-400 hover:bg-[var(--surface)]/10" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50/50"
                          )}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[9px] font-bold uppercase tracking-wider mb-0.5", selectedProjectId === project.id ? "text-white/60" : "text-slate-400")}>Net Impact</p>
                        <p className={cn("text-base font-bold font-mono tracking-tight", stats.actualCents < 0 ? (selectedProjectId === project.id ? "text-rose-300" : "font-semibold text-rose-700") : (selectedProjectId === project.id ? "text-emerald-300" : "font-semibold text-emerald-700"))}>
                          {formatCurrency(stats.actualCents)}
                        </p>
                      </div>
                    </div>
                  </div>

                <div className="grid grid-cols-3 gap-4 mb-4 relative z-10 pt-2 border-t border-[var(--line)]/10">
                  <div className="space-y-0.5">
                    <p className={cn("text-[8px] font-bold uppercase tracking-wider", selectedProjectId === project.id ? "text-white/60" : "text-slate-400")}>Allocated</p>
                    <p className="font-semibold font-mono text-xs">{formatCurrency(stats.budgetCents)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className={cn("text-[8px] font-bold uppercase tracking-wider", selectedProjectId === project.id ? "text-white/60" : "text-slate-400")}>Cost Burn</p>
                    <p className="font-semibold font-mono text-xs">{formatCurrency(stats.expenseCents)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className={cn("text-[8px] font-bold uppercase tracking-wider", selectedProjectId === project.id ? "text-white/60" : "text-slate-400")}>Usage</p>
                    <p className="font-semibold font-mono text-xs">{progress.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className={cn("h-1 w-full rounded-full overflow-hidden relative z-10", selectedProjectId === project.id ? "bg-[var(--surface)]/10" : "bg-slate-100")}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    className={cn(
                      "h-full rounded-full",
                      selectedProjectId === project.id 
                        ? "bg-[var(--surface)]" 
                        : (progress > 90 ? "bg-rose-500" : progress > 70 ? "bg-amber-500" : "bg-slate-900")
                    )}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Project Detail Sidebar */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedProject ? (
              <motion.div 
                key={selectedProject.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-[var(--surface)] rounded-xl border border-[var(--line)]/80 shadow-3xs p-5 relative overflow-hidden"
              >
                <div className="absolute inset-0 technical-grid opacity-[0.01] pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--line)]">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Collaborators</h4>
                      <h3 className="text-sm font-black text-[var(--text)] tracking-tight mt-0.5">{selectedProject.name}</h3>
                    </div>
                    <div className="w-8 h-8 bg-[var(--ink)] border border-[var(--line)]/60 rounded-lg flex items-center justify-center">
                      <Users size={14} className="text-slate-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {projectVendors.length > 0 ? projectVendors.map(vendor => (
                      <div key={vendor.id} className="flex items-center justify-between p-3 bg-[var(--ink)] rounded-xl border border-[var(--line)]/60 hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-xs shadow-3xs">
                            {vendor.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[var(--text)]">{vendor.name}</p>
                            <p className="text-[8px] text-[var(--muted)] uppercase tracking-wider font-bold">{vendor.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold font-mono text-[var(--text)] col-span-1">
                            {formatCurrency(transactions.filter(t => t.lines?.some(l => l.project === selectedProjectId) && t.metadata?.vendorId === vendor.id).reduce((sum, t) => sum + Math.abs(t.totalAmountCents), 0))}
                          </p>
                          <p className="text-[8px] text-[var(--muted)] uppercase tracking-wider">Settled</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-10 bg-[var(--ink)]/50 rounded-xl border border-dashed border-[var(--line)]">
                        <div className="w-10 h-10 bg-[var(--ink)] border border-[var(--line)] rounded-lg flex items-center justify-center mx-auto mb-3 opacity-60">
                          <BrainCircuit size={18} className="text-[var(--muted)]" />
                        </div>
                        <p className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">No active project members</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-[var(--line)]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-4 bg-[var(--brass)] rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">Split Tranches</h3>
                    </div>
                    
                    <div className="space-y-3">
                      {selectedProject.splitRules?.map((rule, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-[var(--muted)]">{rule.partnerName}</span>
                            <span className="text-[10px] font-bold font-mono text-[var(--text)]">{rule.percentage}%</span>
                          </div>
                          <div className="h-1 w-full bg-[var(--line)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--brass)]" style={{ width: `${rule.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                      {!selectedProject.splitRules?.length && (
                        <p className="text-[10px] text-slate-400 font-bold italic">No split allocations configured.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--line)]">
                    <button className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase tracking-wider text-[9px] transition-all flex items-center justify-center gap-2 shadow-3xs cursor-pointer">
                      <BarChart3 size={12} className="text-slate-300" />
                      Generate Brief
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-100/30 rounded-xl border border-dashed border-[var(--line)] p-4 md:p-8 text-center h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-[var(--surface)] rounded-lg shadow-3xs flex items-center justify-center text-slate-400 border border-[var(--line)] mx-auto mb-4">
                  <BrainCircuit size={20} />
                </div>
                <h3 className="text-xs font-bold text-[var(--text)] mb-1 uppercase tracking-wider">Select Initiative</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider max-w-[200px] mx-auto leading-relaxed">
                  Select a workflow folder from the left pane to analyze members, expenses, and split tranches.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-xl bg-[var(--ink)] border border-[var(--line)] rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[var(--text)] uppercase italic font-display">Initialize Project</h3>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mt-1">Deploying new objective into ledger matrix</p>
              </div>
              <button 
                onClick={() => setIsNewProjectModalOpen(false)}
                className="p-2 text-slate-500 hover:text-[var(--text)] transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <div className="p-4 md:p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-1">Protocol Name</label>
                <input 
                  type="text"
                  dir="auto"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g., Project Overlord"
                  className="w-full p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-sm font-bold focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Dimensional Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'general', label: 'General', icon: FolderKanban },
                    { id: 'book', label: 'Publication', icon: BookOpen },
                    { id: 'event', label: 'Event', icon: Calendar },
                    { id: 'campaign', label: 'Campaign', icon: Target }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setNewProject({ ...newProject, type: type.id as any })}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-[32px] border transition-all text-left",
                        newProject.type === type.id 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" 
                          : "bg-[var(--surface)] border-[var(--line)] text-[var(--text)] hover:border-indigo-600/50"
                      )}
                    >
                      <type.icon size={18} />
                      <span className="text-sm font-bold">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-1">Strategic Description</label>
                <textarea 
                  dir="auto"
                  value={newProject.description || ''}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Intelligence briefing on project goals..."
                  className="w-full p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-sm font-medium focus:outline-none focus:border-indigo-600 transition-all h-24"
                />
              </div>
            </div>

            <div className="p-4 md:p-8 bg-[var(--ink)]/30 border-t border-[var(--line)] flex items-center justify-end gap-4">
              <button 
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddProject}
                disabled={loading || !newProject.name}
                className="px-8 py-3 bg-indigo-600 text-white rounded-[32px] text-xs font-medium uppercase tracking-wider hover:bg-indigo-600/90 transition-all shadow-xl disabled:opacity-50"
              >
                {loading ? 'PROCESSING...' : 'INITIALIZE PROTOCOL'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-xl bg-[var(--ink)] border border-[var(--line)] rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[var(--text)] uppercase italic font-display">Configure Project</h3>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mt-1">Rule settings for project matrix {editingProject.id.slice(0, 8)}</p>
              </div>
              <button 
                onClick={() => setEditingProject(null)}
                className="p-2 text-slate-500 hover:text-[var(--text)] transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <div className="p-4 md:p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Protocol Name</label>
                <input 
                  type="text"
                  dir="auto"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-sm font-bold focus:outline-none focus:border-indigo-600 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'active', label: 'Active', color: 'ledger-success' },
                    { id: 'completed', label: 'Done', color: 'ledger-accent' },
                    { id: 'archived', label: 'Archived', color: 'ledger-muted' }
                  ].map((status) => (
                    <button
                      key={status.id}
                      onClick={() => setEditingProject({ ...editingProject, status: status.id as any })}
                      className={cn(
                        "p-3 rounded-[32px] border transition-all text-xs font-bold uppercase tracking-wider",
                        editingProject.status === status.id 
                          ? `bg-${status.color} border-${status.color} text-white shadow-lg` 
                          : "bg-[var(--surface)] border-[var(--line)] text-slate-500 hover:border-indigo-600/50"
                      )}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Dimensional Type</label>
                <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'general', label: 'General', icon: FolderKanban },
                      { id: 'book', label: 'Publication', icon: BookOpen },
                      { id: 'event', label: 'Event', icon: Calendar },
                      { id: 'campaign', label: 'Campaign', icon: Target }
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setEditingProject({ ...editingProject, type: type.id as any })}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-[32px] border transition-all text-left",
                          editingProject.type === type.id 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg" 
                            : "bg-[var(--surface)] border-[var(--line)] text-[var(--text)] hover:border-indigo-600/50"
                        )}
                      >
                        <type.icon size={18} />
                        <span className="text-sm font-bold">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Budget Allocation</label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                      type="number"
                      value={editingProject.budgetCents / 100}
                      onChange={(e) => setEditingProject({ ...editingProject, budgetCents: Math.round(Number(e.target.value) * 100) })}
                      className="w-full pl-10 pr-4 py-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-sm font-bold focus:outline-none focus:border-indigo-600 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Strategic Description</label>
                <textarea 
                  dir="auto"
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] text-sm font-medium focus:outline-none focus:border-indigo-600 transition-all h-24"
                />
              </div>
            </div>

            <div className="p-4 md:p-8 bg-[var(--ink)]/30 border-t border-[var(--line)] flex items-center justify-end gap-4">
              <button 
                onClick={() => setEditingProject(null)}
                className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProject}
                disabled={loading || !editingProject.name}
                className="px-8 py-3 bg-indigo-600 text-white rounded-[32px] text-xs font-medium uppercase tracking-wider hover:bg-indigo-600/90 transition-all shadow-xl disabled:opacity-50"
              >
                {loading ? 'COMMITTING...' : 'SAVE MODIFICATIONS'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
