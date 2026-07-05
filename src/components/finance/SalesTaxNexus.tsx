import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  MapPin, 
  AlertTriangle, 
  ShieldCheck, 
  Plus,
  X,
  Trash2,
  Loader2
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { toast } from 'sonner';

interface Jurisdiction {
  id: string;
  state: string;
  rate: number;
  thresholdCents: number;
  currentSalesCents: number;
  lastFilingDate: string;
}

interface SalesTaxNexusProps {
  isEmbedded?: boolean;
}

export default function SalesTaxNexus({ isEmbedded = false }: SalesTaxNexusProps) {
  const { user, currentWorkspaceId } = useAuthStore();
  const { transactions } = useLedgerStore();
  const [nexus, setNexus] = useState<Jurisdiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [stateName, setStateName] = useState('');
  const [rate, setRate] = useState('6.25');
  const [threshold, setThreshold] = useState('100000');
  const [currentSales, setCurrentSales] = useState('0');
  const [lastFilingDate, setLastFilingDate] = useState(new Date().toISOString().slice(0, 10));

  // Load real tax jurisdictions from Firestore
  useEffect(() => {
    if (!user || !currentWorkspaceId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'taxJurisdictions'),
      where('workspaceId', '==', currentWorkspaceId),
      where('uid', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Jurisdiction[];
      setNexus(data);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load tax jurisdictions:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, currentWorkspaceId]);

  const handleRegisterNexus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentWorkspaceId) {
      toast.error("Auth context missing");
      return;
    }

    const rateVal = parseFloat(rate);
    const thresholdCents = TruthEngine.parseAmountToCents(threshold);
    const salesCents = TruthEngine.parseAmountToCents(currentSales || '0');

    if (isNaN(rateVal) || rateVal <= 0) {
      toast.error("Invalid tax rate value");
      return;
    }
    if (isNaN(thresholdCents) || thresholdCents <= 0) {
      toast.error("Invalid volume threshold target");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        state: stateName.trim(),
        rate: rateVal,
        thresholdCents,
        currentSalesCents: salesCents,
        lastFilingDate,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'taxJurisdictions'), payload);
      toast.success("Jurisdiction registered successfully", {
        description: `Permanently tracked "${stateName}" sales thresholds.`
      });

      // Reset
      setStateName('');
      setRate('6.25');
      setThreshold('100000');
      setCurrentSales('0');
      setLastFilingDate(new Date().toISOString().slice(0, 10));
      setIsAdding(false);
    } catch (err: any) {
      toast.error("Registration failed", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNexus = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'taxJurisdictions', id));
      toast.success(`Removed tax jurisdiction: ${name}`);
    } catch (err: any) {
      toast.error("Failed to delete", { description: err.message });
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-white overflow-hidden",
      isEmbedded ? "p-0" : "border border-slate-200 rounded-[32px] shadow-2xl"
    )}>
      {/* Header Panel */}
      <div className="p-4 md:p-6 lg:p-8 border-b border-slate-200 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-650 rounded-xl flex items-center justify-center text-white">
                 <Globe size={20} />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-lg font-bold tracking-tight text-slate-800">Tax & Nexus Tracker</h2>
                 <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Multi-Jurisdictional compliance matrices</p>
              </div>
           </div>
           
           <button 
             onClick={() => setIsAdding(true)}
             className="px-4 py-2.5 bg-slate-950 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
           >
              <Plus size={14} /> Register Jurisdiction
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
               <Loader2 className="w-6 h-6 text-indigo-600 animate-spin shrink-0" />
               <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Accessing regional tax matrices...</p>
            </div>
          ) : nexus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-slate-50/50 border border-dashed border-slate-200 rounded-[32px] text-center space-y-4">
               <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-3xs">
                  <Globe size={22} />
               </div>
               <div className="max-w-xs space-y-1">
                 <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Zero Tax Jurisdictions</h3>
                 <p className="text-xs text-slate-400">Add local, state, or international tax rules to automatically check regulatory thresholds.</p>
               </div>
               <button 
                 onClick={() => setIsAdding(true)}
                 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
               >
                 Log First Nexus
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {nexus.map((state, idx) => {
                  // Real-time local transactions auto-tracking logic
                  const stateCodeMatch = state.state.match(/\b([A-Z]{2})\b/);
                  const stateCode = stateCodeMatch ? stateCodeMatch[1].toLowerCase() : "";
                  const stateFullName = state.state.split("(")[0].trim().toLowerCase();

                  const safeTransactionsRef = Array.isArray(transactions) ? transactions : [];
                  const dynamicSalesCents = safeTransactionsRef.reduce((sum, tx) => {
                    if (!tx || tx.deletedAt) return sum;
                    const desc = tx.description || "";
                    const payee = tx.payee || "";
                    const proj = tx.project || "";
                    const tagsStr = Array.isArray(tx.tags) ? tx.tags.join(" ") : "";
                    const searchStr = `${desc} ${payee} ${proj} ${tagsStr}`.toLowerCase();
                    const hasStateCode = stateCode ? (
                      searchStr.includes(` ${stateCode} `) || 
                      searchStr.startsWith(`${stateCode} `) || 
                      searchStr.endsWith(` ${stateCode}`) || 
                      searchStr.includes(`,${stateCode}`) ||
                      searchStr.includes(`(${stateCode})`)
                    ) : false;
                    const hasStateName = searchStr.includes(stateFullName);

                    if (hasStateCode || hasStateName) {
                      const txLines = Array.isArray(tx.lines) ? tx.lines : [];
                      const incomeLines = txLines.filter(l => {
                        const accountName = (l?.accountName || "").toLowerCase();
                        return accountName.includes("income") || accountName.includes("revenue") || accountName.includes("sale");
                      });
                      const lineSum = incomeLines.reduce((accStr, l) => accStr + Math.abs(l?.amountCents || 0), 0);
                      if (lineSum > 0) return sum + lineSum;
                      
                      const totalAmt = typeof tx.totalAmountCents === 'number' ? tx.totalAmountCents : 0;
                      if (totalAmt > 0) return sum + totalAmt;
                    }
                    return sum;
                  }, 0);

                  const totalSalesCents = (state.currentSalesCents || 0) + dynamicSalesCents;
                  const progress = Math.min(100, (totalSalesCents / state.thresholdCents) * 100);
                  const hasNexus = totalSalesCents >= state.thresholdCents;
                  
                  return (
                    <motion.div 
                      key={state.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-5 bg-white border border-slate-200/85 rounded-[32px] shadow-3xs hover:border-slate-350 transition-all group flex flex-col justify-between"
                    >
                       <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                             <MapPin size={14} className="text-slate-400" />
                             <h3 className="text-sm font-bold text-slate-800 tracking-tight leading-none">{state.state}</h3>
                          </div>
                          {hasNexus ? (
                             <div className="flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-100 rounded-md">
                                <AlertTriangle size={10} className="text-rose-500" />
                                <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Nexus Active</span>
                             </div>
                          ) : (
                             <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">
                                <ShieldCheck size={10} className="text-emerald-500" />
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Below Target</span>
                             </div>
                          )}
                       </div>

                       <div className="space-y-3 pt-3 border-t border-slate-100">
                          <div className="flex justify-between items-baseline text-xs pb-1.5">
                             <span className="text-[10px] text-slate-400">Statutory Tax Rate</span>
                             <span className="font-semibold text-slate-800">{state.rate}%</span>
                          </div>
                          <div className="flex justify-between items-baseline text-xs pb-1.5">
                             <span className="text-[10px] text-slate-400">Trigger Threshold</span>
                             <span className="font-semibold text-slate-700">{formatCurrency(state.thresholdCents)}</span>
                          </div>
                          <div className="flex flex-col gap-1 p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                             <div className="flex justify-between items-baseline text-xs">
                                <span className="text-[10px] font-medium text-slate-600">Total Local Volume</span>
                                <span className="font-bold text-slate-950 text-right">{formatCurrency(totalSalesCents)}</span>
                             </div>
                             {dynamicSalesCents > 0 && (
                                <div className="flex justify-between items-center text-[9px] text-indigo-600 font-bold border-t border-slate-200/50 pt-1 mt-0.5">
                                   <span>• Dynamic Ledger Contribution</span>
                                   <span>+{formatCurrency(dynamicSalesCents)}</span>
                                </div>
                             )}
                          </div>
                       </div>

                       <div className="mt-4 space-y-1.5 pt-1.5 border-t border-slate-100/50 flex flex-col">
                          <div className="flex justify-between text-[8px] font-extrabold uppercase text-slate-400">
                             <span>Sellers Volume Progress</span>
                             <span>{progress.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div 
                               className={cn("h-full transition-all rounded-full", hasNexus ? "bg-rose-500" : "bg-indigo-600")}
                               style={{ width: `${progress}%` }}
                             />
                          </div>
                       </div>

                       <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9px] font-medium text-slate-400">Filing: {state.lastFilingDate}</span>
                          <button 
                            onClick={() => handleDeleteNexus(state.id, state.state)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-rose-50"
                            title="Deregister"
                          >
                            <Trash2 size={12} />
                          </button>
                       </div>
                    </motion.div>
                  );
               })}
            </div>
          )}
      </div>

      {/* Modal entry form dialog */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[200]">
          <div className="bg-white border border-slate-200 rounded-[32px] p-4 md:p-6 lg:p-8 max-w-sm w-full mx-4 shadow-xl relative">
            <button 
              onClick={() => setIsAdding(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center font-bold">
                <Plus size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 leading-tight">Register Tax Jurisdiction</h3>
                <p className="text-xs text-slate-400">Audit sales thresholds across geographical lines.</p>
              </div>
            </div>

            <form onSubmit={handleRegisterNexus} className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">State / Jurisdiction Name</label>
                <input 
                  type="text" 
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="e.g. California (CA), United Kingdom"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Tax Rate (%)</label>
                    <button
                      type="button"
                      disabled={!stateName || stateName.length < 2}
                      onClick={async () => {
                         try {
                           const token = await user?.getIdToken();
                           if (!token) return;
                           const map: Record<string, string> = { 'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'};
                           const upper = stateName.trim().toUpperCase();
                           const stateCode = map[upper] || stateName.match(/\b([A-Za-z]{2})\b/)?.[1] || stateName.substring(0,2);
                           const res = await fetch(`/api/v1/tax/us_rate_list?state=${stateCode.toUpperCase()}&per_page=1`, {
                             headers: { 'Authorization': `Bearer ${token}` }
                           });
                           const data = await res.json();
                           if (data && data.data && data.data.length > 0) {
                              const fetchedRate = data.data[0].state_rate * 100;
                              setRate(fetchedRate.toFixed(2));
                              toast.success(`Matched rate for ${stateCode.toUpperCase()}`);
                           } else {
                              toast.error("No statutory rate found for this zone");
                           }
                         } catch (e: any) {
                           toast.error("Failed to query statutory matrix", { description: e.message });
                         }
                      }}
                      className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 uppercase tracking-widest"
                    >
                      Sync Rate
                    </button>
                  </div>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Threshold Volume ($)</label>
                  <input 
                    type="number"
                    min="1"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Local Sales Volume ($)</label>
                  <input 
                    type="number"
                    min="0"
                    value={currentSales}
                    onChange={(e) => setCurrentSales(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Last Filed At</label>
                  <input 
                    type="date"
                    value={lastFilingDate}
                    onChange={(e) => setLastFilingDate(e.target.value)}
                    className="w-full text-[11px] px-2.5 py-[7px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-650 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                  {isSubmitting ? 'Logging...' : 'Register Nexus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
