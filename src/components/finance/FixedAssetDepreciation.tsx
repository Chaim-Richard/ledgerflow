import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar,
  Plus,
  Trash2,
  X,
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
import { toast } from 'sonner';

interface Asset {
  id: string;
  name: string;
  category: 'Equipment' | 'Vehicles' | 'Buildings' | 'Intangible';
  purchaseDate: string;
  purchaseValue: number;
  usefulLifeYears: number;
  salvageValue: number;
}

interface FixedAssetDepreciationProps {
  isEmbedded?: boolean;
}

export default function FixedAssetDepreciation({ isEmbedded = false }: FixedAssetDepreciationProps) {
  const { user, currentWorkspaceId } = useAuthStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Equipment' | 'Vehicles' | 'Buildings' | 'Intangible'>('Equipment');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseValue, setPurchaseValue] = useState('');
  const [usefulLife, setUsefulLife] = useState('5');
  const [salvageValue, setSalvageValue] = useState('0');

  // Load real assets from Firestore
  useEffect(() => {
    if (!user || !currentWorkspaceId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'fixedAssets'),
      where('workspaceId', '==', currentWorkspaceId),
      where('uid', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Asset[];
      setAssets(data);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load assets:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user, currentWorkspaceId]);

  const calculateDepreciation = (asset: Asset) => {
    const today = new Date();
    const purchaseDate = new Date(asset.purchaseDate);
    const monthsOwned = Math.max(0, (today.getFullYear() - purchaseDate.getFullYear()) * 12 + today.getMonth() - purchaseDate.getMonth());
    const currentPeriodYear = Math.floor(monthsOwned / 12) + 1;
    
    // Straight-line depreciation via Mathematical Truth Engine
    const annualSL = TruthEngine.calculateStraightLineDepreciation(asset.purchaseValue, asset.salvageValue, asset.usefulLifeYears);
    const accumulatedSL = Math.min(asset.purchaseValue - asset.salvageValue, (annualSL / 12) * monthsOwned);
    
    // DDB
    let accumulatedDDB = 0;
    let bookValueDDB = asset.purchaseValue;
    for (let i = 1; i <= Math.min(currentPeriodYear, asset.usefulLifeYears); i++) {
        const dep = TruthEngine.calculateDoubleDecliningBalanceDepreciation(bookValueDDB, asset.usefulLifeYears);
        bookValueDDB -= dep;
        accumulatedDDB += dep;
    }
    
    // We default to Straight-Line for the main UI display, but expose others in tooltips or details if desired
    const accumulatedDepreciation = accumulatedSL;
    const monthlyDepreciation = annualSL / 12;
    const bookValue = asset.purchaseValue - accumulatedDepreciation;
    
    return {
      monthly: Math.round(monthlyDepreciation),
      accumulated: Math.round(accumulatedDepreciation),
      accumulatedDDB: Math.round(accumulatedDDB),
      bookValue: Math.round(bookValue),
      progress: (asset.purchaseValue - asset.salvageValue) > 0 
        ? (accumulatedDepreciation / (asset.purchaseValue - asset.salvageValue)) * 100 
        : 100
    };
  };

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentWorkspaceId) {
      toast.error("Auth context missing");
      return;
    }

    const valueCents = TruthEngine.parseAmountToCents(purchaseValue);
    const salvageCents = TruthEngine.parseAmountToCents(salvageValue || '0');

    if (isNaN(valueCents) || valueCents <= 0) {
      toast.error("Invalid purchase value provided");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        name: name.trim(),
        category,
        purchaseDate,
        purchaseValue: valueCents,
        usefulLifeYears: parseInt(usefulLife) || 5,
        salvageValue: salvageCents,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'fixedAssets'), payload);
      toast.success("Asset registered successfully", {
        description: `Permanently logged "${name}" in asset registers.`
      });

      // Reset
      setName('');
      setCategory('Equipment');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setPurchaseValue('');
      setUsefulLife('5');
      setSalvageValue('0');
      setIsAdding(false);
    } catch (err: any) {
      toast.error("Registration failed", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAsset = async (id: string, assetName: string) => {
    try {
      await deleteDoc(doc(db, 'fixedAssets', id));
      toast.success(`Removed asset register: ${assetName}`);
    } catch (err: any) {
      toast.error("Failed to delete asset", { description: err.message });
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-white overflow-hidden",
      isEmbedded ? "p-0" : "border border-slate-200 rounded-[32px] shadow-2xl"
    )}>
      {/* Header Bar */}
      <div className="p-4 md:p-6 lg:p-8 border-b border-slate-200 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-650 rounded-xl flex items-center justify-center text-white">
                 <Building2 size={20} />
              </div>
              <div className="flex flex-col">
                 <h2 className="text-lg font-bold tracking-tight text-slate-800">Fixed Asset Ledger</h2>
                 <p className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">Depreciation & Lifecycle registers</p>
              </div>
           </div>
           
           <button 
             onClick={() => setIsAdding(true)}
             className="px-4 py-2.5 bg-slate-950 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto"
           >
              <Plus size={14} /> Register Asset
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-8 custom-scrollbar">
         {loading ? (
           <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin shrink-0" />
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Accessing ledger asset stream...</p>
           </div>
         ) : assets.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-16 bg-slate-50/50 border border-dashed border-slate-200 rounded-[32px] text-center space-y-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-3xs">
                 <Building2 size={22} />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Zero Assets Registered</h3>
                <p className="text-xs text-slate-400">Add capital machinery, property titles, physical systems, or intangible IP to track depreciation.</p>
              </div>
              <button 
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                Log First Asset
              </button>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {assets.map((asset, idx) => {
                 const stats = calculateDepreciation(asset);
                 return (
                   <motion.div 
                     key={asset.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: idx * 0.05 }}
                     className="p-5 bg-white border border-slate-200/80 rounded-[32px] shadow-3xs hover:border-slate-350 transition-all group flex flex-col justify-between"
                   >
                      <div className="flex items-start justify-between mb-4">
                         <span className="px-2 py-1 bg-slate-100 rounded-md text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                            {asset.category}
                         </span>
                         <button 
                           onClick={() => handleDeleteAsset(asset.id, asset.name)}
                           className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                           title="Delete Register"
                         >
                           <Trash2 size={13} />
                         </button>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight leading-none mb-1">{asset.name}</h3>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase tracking-wider mb-5">
                           <Calendar size={11} />
                           Logged: {asset.purchaseDate}
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-slate-100">
                         <div className="flex justify-between items-end pb-1.5 text-xs">
                            <span className="text-[10px] text-slate-400">Purchase Cost</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(asset.purchaseValue)}</span>
                         </div>
                         <div className="flex justify-between items-end pb-1.5 text-xs">
                            <span className="text-[10px] text-slate-400">Total Depr.</span>
                            <span className="font-semibold text-rose-500">-{formatCurrency(stats.accumulated)}</span>
                         </div>
                         <div className="flex justify-between items-end p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                            <span className="text-[10px] font-medium text-slate-600">Residual Net Value</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(stats.bookValue)}</span>
                         </div>
                      </div>

                      <div className="mt-4 space-y-1.5 pt-1.5">
                         <div className="flex justify-between text-[8px] font-extrabold uppercase text-slate-400">
                            <span>Utilization</span>
                            <span>{stats.progress.toFixed(1)}%</span>
                         </div>
                         <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-slate-800 transition-all rounded-full" 
                              style={{ width: `${stats.progress}%` }}
                            />
                         </div>
                      </div>
                   </motion.div>
                 );
              })}
           </div>
         )}

         {/* Consolidated Analytics Panel */}
         {assets.length > 0 && (
           <div className="p-4 md:p-6 lg:p-8 bg-slate-900 text-white rounded-[32px] relative overflow-hidden shadow-sm">
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Cost Base</span>
                    <p className="text-xl font-bold tracking-tight text-white">{formatCurrency(assets.reduce((a, b) => a + b.purchaseValue, 0))}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Amortization</span>
                    <p className="text-xl font-bold tracking-tight text-rose-400">-{formatCurrency(assets.reduce((a, b) => a + calculateDepreciation(b).monthly, 0))}</p>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">True Net Book Value</span>
                    <p className="text-xl font-bold tracking-tight text-emerald-400">{formatCurrency(assets.reduce((a, b) => a + calculateDepreciation(b).bookValue, 0))}</p>
                 </div>
              </div>
           </div>
         )}
      </div>

      {/* Asset register Dialog modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[200]">
          <div className="bg-white border border-slate-200 rounded-[32px] p-4 md:p-6 lg:p-8 max-w-md w-full mx-4 shadow-xl relative">
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
                <h3 className="text-base font-bold text-slate-800 leading-tight">Register New Fixed Asset</h3>
                <p className="text-xs text-slate-400">Add physical capital items to active financial systems.</p>
              </div>
            </div>

            <form onSubmit={handleRegisterAsset} className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Asset Description</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Server Racks R-09 or Delivery Van"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  >
                    <option value="Equipment">Equipment</option>
                    <option value="Vehicles">Vehicles</option>
                    <option value="Buildings">Buildings</option>
                    <option value="Intangible">Intangible</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Acquisition Date</label>
                  <input 
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full text-[11px] px-2.5 py-[7px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium font-sans"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Purchase Value (USD)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                  placeholder="e.g. 52500.00"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Useful Life (Years)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="100"
                    value={usefulLife}
                    onChange={(e) => setUsefulLife(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Salvage Value (USD)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={salvageValue}
                    onChange={(e) => setSalvageValue(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium"
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
                  {isSubmitting ? 'Logging...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
