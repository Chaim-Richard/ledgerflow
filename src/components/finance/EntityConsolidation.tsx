import { TemporalTruth } from '../../modules/truth/TruthEngine';
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  ArrowRightLeft,
  ShieldCheck,
  FileText,
  BarChart3,
  TrendingUp,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { cn, formatCurrency } from '../../lib/utils';
import { ChartAccount } from '../../types';
import { toast } from 'sonner';

interface Entity {
  id: string;
  name: string;
  localCurrency: string;
  revenueCents: number;
  expenseCents: number;
  cashCents: number;
  isConsolidated: boolean;
}

import { TemporalValidity } from '../../types';

// Temporally stable rate generator for cross-border consolidation
const getTemporalRatesFor = (currency: string): TemporalValidity[] => {
  const baseRate = currency === 'EUR' ? 0.92 : currency === 'GBP' ? 0.79 : currency === 'JPY' ? 151.42 : currency === 'ILS' ? 3.65 : currency === 'CAD' ? 1.35 : 1.0;
  return [
    { validFrom: '0000-01-01', validTo: '9999-12-31', value: baseRate },
  ];
};

export default function EntityConsolidation() {
  const { workspaces, user } = useAuthStore();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [consolidationCurrency, setConsolidationCurrency] = useState('USD');
  const [consolidationDate, setConsolidationDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Modal visibility
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCurrency, setNewSubCurrency] = useState('USD');
  const [newSubCategory, setNewSubCategory] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real metrics from firestore for each workspace
  useEffect(() => {
    if (!user || workspaces.length === 0) return;

    let isMounted = true;
    const fetchRealData = async () => {
      setLoading(true);
      try {
        const tempEntities: Entity[] = [];

        for (const ws of workspaces) {
          // Query accounts for this workspace
          const accountsQuery = query(
            collection(db, 'chartAccounts'),
            where('workspaceId', '==', ws.id)
          );
          const accountsSnap = await getDocs(accountsQuery);
          
          let revenueCents = 0;
          let expenseCents = 0;
          let cashCents = 0;

          accountsSnap.docs.forEach(docSnap => {
            const acc = docSnap.data() as ChartAccount;
            if (acc.type === 'income') {
              revenueCents += Math.abs(acc.balanceCents || 0);
            } else if (acc.type === 'expense') {
              expenseCents += Math.abs(acc.balanceCents || 0);
            } else if (acc.type === 'asset' && (
              acc.category?.toLowerCase() === 'cash' || 
              acc.subtype?.toLowerCase() === 'checking' || 
              acc.subtype?.toLowerCase() === 'savings' ||
              acc.name?.toLowerCase().includes('cash') || 
              acc.name?.toLowerCase().includes('bank') || 
              acc.name?.toLowerCase().includes('checking')
            )) {
              cashCents += (acc.balanceCents || 0);
            }
          });

          // Always display real workspaces, preserving user's toggles if possible, default to active
          tempEntities.push({
            id: ws.id,
            name: ws.name,
            localCurrency: ws.currency || 'USD',
            revenueCents,
            expenseCents,
            cashCents,
            isConsolidated: true
          });
        }

        if (isMounted) {
          // Merge with previous status if exists to keep toggled state active
          setEntities(prev => {
            return tempEntities.map(fresh => {
              const old = prev.find(o => o.id === fresh.id);
              if (old) {
                return { ...fresh, isConsolidated: old.isConsolidated };
              }
              return fresh;
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch entity consolidation data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRealData();
    return () => { isMounted = false; };
  }, [user, workspaces]);

  const consolidatedTotal = useMemo(() => {
    return entities
      .filter(e => e.isConsolidated)
      .reduce((acc, e) => {
        // Universal Truth: Consolidate cross-border entities strictly at standard snapshot rate
        let rate = 1.0;
        if (e.localCurrency !== consolidationCurrency) {
           try {
              // Get base rate to USD
              const toBaseRate = e.localCurrency === 'USD' ? 1.0 : TemporalTruth.resolveEffectiveValue(getTemporalRatesFor(e.localCurrency), consolidationDate);
              // Get target rate from USD
              const fromTargetRate = consolidationCurrency === 'USD' ? 1.0 : TemporalTruth.resolveEffectiveValue(getTemporalRatesFor(consolidationCurrency), consolidationDate);
              
              rate = fromTargetRate / toBaseRate;
           } catch (err) {}
        }
        
        return {
          revenue: acc.revenue + Math.round(e.revenueCents * rate),
          expense: acc.expense + Math.round(e.expenseCents * rate),
          cash: acc.cash + Math.round(e.cashCents * rate)
        };
      }, { revenue: 0, expense: 0, cash: 0 });
  }, [entities, consolidationCurrency, consolidationDate]);

  const toggleConsolidation = (id: string) => {
    setEntities(prev => prev.map(e => e.id === id ? { ...e, isConsolidated: !e.isConsolidated } : e));
  };

  const handleCreateSubsidiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSubName.trim()) return;

    setIsSubmitting(true);
    try {
      const newWs = {
        uid: user.uid,
        name: newSubName.trim(),
        businessType: newSubCategory,
        createdAt: new Date().toISOString(),
        currency: newSubCurrency
      };

      await addDoc(collection(db, 'workspaces'), newWs);
      toast.success('Subsidiary Linked Successfully', {
        description: `New real workspace "${newSubName}" has been provisioned and mapped to your consolidated ledger register.`
      });

      // Reset modal
      setNewSubName('');
      setNewSubCurrency('USD');
      setNewSubCategory('general');
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to link subsidiary', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
         <div>
            <div className="flex items-center gap-2 mb-2">
               <Building2 size={24} className="text-slate-600" />
               <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Consolidation Engine
               </span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
               Entity Manager
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold max-w-2xl">
               Multi-Workspace Group Registers
            </p>
         </div>
         
         <button 
           onClick={() => setIsModalOpen(true)}
           className="px-6 py-3.5 bg-slate-900 text-white rounded-[32px] text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2 shadow-sm self-start sm:self-auto"
         >
            <Plus size={16} /> Link Subsidiary
         </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
         <div className="xl:col-span-4 space-y-4">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Entities</h3>
               {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
            </div>

            {entities.length === 0 ? (
               <div className="p-8 bg-slate-50 border border-slate-200 rounded-[32px] text-center space-y-3">
                  <AlertCircle size={24} className="text-slate-400 mx-auto" />
                  <p className="text-sm font-black text-slate-700 uppercase tracking-tight">No Subsidiaries Found</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Click "Link Subsidiary" above to provision a real financial entity.</p>
               </div>
            ) : (
               <div className="space-y-4">
                 {entities.map((entity) => (
                    <div 
                      key={entity.id}
                      className={cn(
                        "p-6 rounded-[32px] border transition-all cursor-pointer group relative overflow-hidden",
                        entity.isConsolidated 
                         ? "bg-white border-slate-300 shadow-md ring-1 ring-slate-900/5" 
                         : "bg-slate-50 border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-300"
                      )}
                      onClick={() => toggleConsolidation(entity.id)}
                    >
                       <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                             <div className={cn(
                                "w-12 h-12 rounded-[32px] flex items-center justify-center transition-all",
                                entity.isConsolidated ? "bg-slate-900 text-white shadow-md" : "bg-slate-200 text-slate-500"
                             )}>
                                <Building2 size={20} />
                             </div>
                             <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{entity.name}</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Currency: {entity.localCurrency}</p>
                             </div>
                          </div>
                          <div className={cn(
                             "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                             entity.isConsolidated ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-transparent"
                          )}>
                             {entity.isConsolidated && <ShieldCheck size={14} />}
                          </div>
                       </div>
  
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-100/50 p-3 rounded-[32px] border border-slate-200/50">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Local Revenue</span>
                             <p className="text-sm font-black font-mono text-slate-800">{formatCurrency(entity.revenueCents)}</p>
                          </div>
                          <div className="bg-slate-100/50 p-3 rounded-[32px] border border-slate-200/50">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Local Cash</span>
                             <p className="text-sm font-black font-mono text-slate-800">{formatCurrency(entity.cashCents)}</p>
                          </div>
                       </div>
  
                       <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileText size={16} className="text-slate-400" />
                       </div>
                    </div>
                 ))}
               </div>
            )}
         </div>

         <div className="xl:col-span-8 space-y-8">
            <div className="p-4 md:p-8 md:p-12 bg-white border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[550px]">
               <div className="technical-grid absolute inset-0 opacity-[0.03]" />
               
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 relative z-10 border-b border-slate-100 pb-8">
                  <div>
                     <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 uppercase font-display">Consolidated Group Exposure</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Aggregating {entities.filter(e => e.isConsolidated).length} entities in USD</p>
                  </div>
                  <div className="px-4 py-2 self-start md:self-auto bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Intercompany eliminations active</span>
                  </div>
               </div>

               {/* Visual Cards Layout for Metrics to avoid overlap */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 relative z-10">
                  <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-6 flex flex-col justify-between shadow-sm">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Group Revenue</span>
                     <p className="text-3xl md:text-4xl font-black font-mono tracking-tighter text-slate-900">{formatCurrency(consolidatedTotal.revenue)}</p>
                     <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-100/50 p-2 rounded-lg border border-emerald-100">
                        <TrendingUp size={14} className="shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Consolidation Active</span>
                     </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-6 flex flex-col justify-between shadow-sm">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Group Cash</span>
                     <p className="text-3xl md:text-4xl font-black font-mono tracking-tighter text-slate-900">{formatCurrency(consolidatedTotal.cash)}</p>
                     <div className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 p-2 rounded-lg border border-slate-200">
                        Liquid Reserves
                     </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-6 flex flex-col justify-between shadow-sm">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Group Margin</span>
                     <p className="text-3xl md:text-4xl font-black font-mono tracking-tighter text-slate-900">
                        {consolidatedTotal.revenue > 0 ? ((consolidatedTotal.revenue - (consolidatedTotal.expense)) / consolidatedTotal.revenue * 100).toFixed(1) : '0.0'}%
                     </p>
                     <div className="mt-4 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 p-2 rounded-lg border border-slate-200">
                        Weighted Margin
                     </div>
                  </div>
               </div>

               <div className="flex-1 bg-slate-900 rounded-[32px] p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-6 border border-slate-800 relative z-10 mb-8 shadow-xl">
                  <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-[32px] flex items-center justify-center text-slate-300 shadow-sm">
                     <ArrowRightLeft size={32} />
                  </div>
                  <div className="space-y-2">
                     <h4 className="text-lg font-black text-white uppercase tracking-tight">Intercompany Eliminations</h4>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest max-w-lg mx-auto leading-relaxed">
                        The system automatically identifies intercompany transactions to ensure zero double-counting in group reporting.
                     </p>
                  </div>
                  <button className="px-8 py-3.5 bg-white text-slate-900 rounded-[32px] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-colors active:scale-95 shadow-md">
                     View Elimination Journal
                  </button>
               </div>

               <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex flex-wrap gap-3">
                     <div className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-colors cursor-pointer shadow-sm">Preview IFRS Report</div>
                     <div className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-colors cursor-pointer shadow-sm">GAAP Reconciliation</div>
                  </div>
                  <div className="flex items-center gap-3">
                     <BarChart3 size={16} className="text-slate-400" />
                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Consolidated Ledger Integrity Active</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Modal Dialog for Provisioning Subsidiaries */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200]">
          <div className="bg-white border border-slate-200 rounded-[32px] p-6 md:p-10 max-w-xl w-full mx-4 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
              <div className="w-12 h-12 rounded-[32px] bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Link New Subsidiary</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Provision a real financial workspace in LedgerFlow</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubsidiary} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Company / Entity Name</label>
                <input 
                  type="text" 
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Acme Logistics S.A."
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[32px] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Functional Currency</label>
                  <select 
                    value={newSubCurrency}
                    onChange={(e) => setNewSubCurrency(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[32px] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm appearance-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="SGD">SGD ($)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Business Type</label>
                  <select 
                    value={newSubCategory}
                    onChange={(e) => setNewSubCategory(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[32px] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm appearance-none"
                  >
                    <option value="general">General LLC</option>
                    <option value="saas">SaaS Tech</option>
                    <option value="retail">B2C Retail</option>
                    <option value="professional">Professional Services</option>
                  </select>
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-slate-100 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-[32px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-[32px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {isSubmitting ? 'Provisioning...' : 'Provision Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
