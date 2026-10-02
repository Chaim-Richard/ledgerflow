import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency, safeConfirm } from '../../lib/utils';
import { ConfirmButton } from '../ui/ConfirmButton';
import AsyncButton from '../ui/AsyncButton';
import { toast } from 'sonner';
import { StrategicEngine } from '../../services/strategicEngine';
import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Plus, 
  Trash2, 
  Search, 
  AlertTriangle,
  Edit2,
  X,
  BarChart3,
  ShieldCheck,
  Info,
  Crown,
  Database,
  Zap,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  ShoppingCart
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTimeout } from '../../hooks/useTimeout';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  updateDoc
} from '../../lib/db/firestore';
import { db } from '../../firebase';
import { InventoryItem } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { isPostable } from '../../lib/txFilters';
import { resolveAccountRole } from '../../lib/accountUtils';
import { Labelled } from '../ui/Labelled';

export default function Inventory() {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  const uid = useAuthStore(s => s.user?.uid);
  const storeTransactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRuleIntel, setShowRuleIntel] = useState(false);
  const [cogsItem, setCogsItem] = useState<InventoryItem | null>(null);
  const [cogsQty, setCogsQty] = useState<number>(1);
  const [isPostingCogs, setIsPostingCogs] = useState(false);
  const { setSafeTimeout } = useTimeout();

  useEffect(() => {
    if (!workspaceId || !uid) {
      setSafeTimeout(() => setLoading(false), 0);
      return;
    }

    const q = query(
      collection(db, 'inventory'),
      where('workspaceId', '==', workspaceId),
      where('uid', '==', uid)
    );

    const unsubInventory = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(data);
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubInventory();
    };
  }, [workspaceId, uid]);

  const activeTransactions = useMemo(() => {
    return storeTransactions.filter(isPostable);
  }, [storeTransactions]);

  const economicItems = useMemo(() => {
    return StrategicEngine.analyzeUnitEconomics(items, activeTransactions, accounts);
  }, [items, activeTransactions, accounts]);

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const handleRecognizeCogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cogsItem || !workspaceId || cogsQty <= 0) return;
    if (cogsQty > cogsItem.quantityAtHand) {
      toast.error(`Cannot sell ${cogsQty} units: only ${cogsItem.quantityAtHand} on hand.`);
      return;
    }

    const inventoryAcc = accounts.find(a => resolveAccountRole(a) === 'inventory' || a.category === 'Inventory') || accounts.find(a => a.type === 'asset');
    const cogsAcc = accounts.find(a => resolveAccountRole(a) === 'cogs' || a.category === 'COGS' || a.category === 'Direct Costs') || accounts.find(a => a.type === 'cost_of_goods' || a.type === 'expense');

    if (!inventoryAcc || !cogsAcc) {
      toast.error('Could not locate Inventory asset and COGS expense accounts in Chart of Accounts.');
      return;
    }

    setIsPostingCogs(true);
    try {
      const user = useAuthStore.getState().user;
      const token = user ? await user.getIdToken() : '';
      const res = await fetch('/api/v1/inventory/cogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          itemId: cogsItem.id,
          quantitySold: cogsQty,
          inventoryAccountId: inventoryAcc.id,
          cogsAccountId: cogsAcc.id
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to record COGS');
      }

      // Update local inventory quantity
      const newQty = Math.max(0, cogsItem.quantityAtHand - cogsQty);
      await updateDoc(doc(db, 'inventory', cogsItem.id), {
        quantityAtHand: newQty,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Recognized COGS for ${cogsQty} units (${formatCurrency(data.totalCogsCents)})`);
      setCogsItem(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to recognize COGS');
    } finally {
      setIsPostingCogs(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingItem) return;

    const formData = new FormData(e.currentTarget);
    const updates: Partial<InventoryItem> = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      description: formData.get('description') as string,
      unitPriceCents: TruthEngine.parseAmountToCents(formData.get('unitPrice') as string),
      unitCostCents: TruthEngine.parseAmountToCents(formData.get('unitCost') as string),
      quantityAtHand: parseInt(formData.get('quantity') as string, 10) || 0,
      reorderPoint: parseInt(formData.get('reorderPoint') as string, 10) || 0,
      measurementUnit: formData.get('measurementUnit') as string || undefined,
      unitsPerPackage: formData.get('unitsPerPackage') ? parseInt(formData.get('unitsPerPackage') as string, 10) || 1 : undefined,
      category: formData.get('category') as string,
    };

    try {
      await updateDoc(doc(db, 'inventory', editingItem.id), updates);
      setEditingItem(null);
      toast.success('Inventory item updated');
    } catch {
      toast.error('Failed to update item');
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newItem: Omit<InventoryItem, 'id'> = {
      uid: uid || "",
      workspaceId: workspaceId || "",
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      description: formData.get('description') as string,
      unitPriceCents: TruthEngine.parseAmountToCents(formData.get('unitPrice') as string),
      unitCostCents: TruthEngine.parseAmountToCents(formData.get('unitCost') as string),
      quantityAtHand: parseInt(formData.get('quantity') as string, 10) || 0,
      reorderPoint: parseInt(formData.get('reorderPoint') as string, 10) || 0,
      measurementUnit: formData.get('measurementUnit') as string || undefined,
      unitsPerPackage: formData.get('unitsPerPackage') ? parseInt(formData.get('unitsPerPackage') as string, 10) || 1 : undefined,
      category: formData.get('category') as string,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'inventory'), newItem);
      setIsAdding(false);
      toast.success('Inventory item added');
    } catch {
      toast.error('Failed to add item');
    }
  };

  const handleDelete = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (item && item.quantityAtHand > 0) {
      if (!safeConfirm(`WARNING: "${item.name}" currently has ${item.quantityAtHand} units on hand representing active asset value. Are you sure you want to delete this inventory record?`)) {
        return;
      }
    } else {
      if (!safeConfirm('Are you sure you want to delete this inventory item?')) {
        return;
      }
    }

    try {
      await deleteDoc(doc(db, 'inventory', id));
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayItems = showRuleIntel ? economicItems.filter((i: any) => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ) : filteredItems;


  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 py-6 px-4 border-b border-[var(--line)]/30 mb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-[32px] bg-slate-900 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] border border-white/5 group hover:scale-110 transition-transform">
               <Package aria-hidden="true" size={32} className="animate-pulse" />
             </div>
             <div>
                <h1 className="text-4xl md:text-6xl font-display font-black text-[var(--text)] tracking-tight flex items-baseline gap-3">
                  Inventory 
                </h1>
                <div className="flex items-center gap-3">
                   <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                   <p className="text-[12px] font-black text-[var(--muted)] uppercase tracking-[0.5em] font-mono">Real-time stock management.</p>
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-8">
           <div className="relative group">
              <Search aria-hidden="true" className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--muted)] opacity-40 group-focus-within:text-emerald-500 group-focus-within:opacity-100 transition-all" size={20} />
              <input aria-label="Search inventory by SKU or item"
                type="text"
                placeholder="Scan sku or entity DNA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-14 pr-8 py-4 bg-[var(--surface)] border-2 border-[var(--line)] rounded-[32px] focus:outline-none focus:border-slate-800 focus:shadow-2xl transition-all font-black text-sm uppercase tracking-tight w-full sm:w-[320px] placeholder:text-slate-500/20"
              />
           </div>
           
           <button 
             onClick={() => setShowRuleIntel(!showRuleIntel)}
             className={cn(
               "px-8 py-4 rounded-[32px] font-black text-xs uppercase tracking-widest transition-all border-2 flex items-center gap-3",
               showRuleIntel 
                 ? "bg-slate-900 text-emerald-400 border-slate-800 shadow-2xl scale-105" 
                 : "bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:border-slate-800"
             )}
           >
             <BarChart3 aria-hidden="true" size={18} />
             {showRuleIntel ? "LedgerFlow AI Active" : "Rule Intel"}
           </button>

           <div className="h-12 w-px bg-slate-200 opacity-20 hidden xl:block" />

           <button 
             onClick={() => setIsAdding(true)}
             className="px-10 py-4 bg-slate-900 text-white rounded-[32px] text-[12px] font-medium uppercase tracking-wider shadow-3xl hover:scale-105 transition-all flex items-center gap-3 border border-white/5 active:scale-95"
           >
              <Plus aria-hidden="true" size={20} />
              Enlist Asset
           </button>
        </div>
      </div>

      {/* Data Chain Integrity Monitor */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-12">
        <div className="xl:col-span-3 bg-zinc-950 p-12 rounded-[32px] text-white flex flex-col md:flex-row items-center justify-between gap-10 border border-white/5 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:scale-110 transition-transform pointer-events-none">
              <Database aria-hidden="true" size={240} />
           </div>
           <div className="relative z-10 w-full md:w-2/3">
              <div className="flex items-center gap-6 mb-6">
                 <div className="w-16 h-16 bg-[var(--surface)]/10 rounded-[32px] flex items-center justify-center text-white border border-white/5 shadow-2xl">
                    <Zap aria-hidden="true" size={32} />
                 </div>
                 <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter">Rule Inventory Core</h3>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest truncate italic font-mono">Real-time Data Chain Synthesis Enabled</p>
                 </div>
              </div>
              <p className="text-sm text-white/50 leading-relaxed font-medium">
                 Synthesizing <span className="text-white font-black">{activeTransactions.length}</span> transaction nodes for <span className="text-white font-black">{items.length}</span> SKUs. 
                 The "Core Integrity" engine has cross-referenced historical sourcing, overhead vectors, and market arbitrage with weighted recency bias.
              </p>
           </div>
           <div className="relative z-10 flex flex-col items-center md:items-end w-full md:w-1/3">
              <div className="flex flex-col items-center">
                 <div className="flex items-baseline gap-3">
                    <span className="text-7xl font-black tracking-tighter text-white">
                       {economicItems.length > 0 
                          ? Math.round(economicItems.reduce((acc: number, i: any) => acc + i.integrityScore, 0) / (economicItems.length || 1)) 
                          : 0}
                    </span>
                    <div className="flex flex-col">
                       <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Avg. Integrity</span>
                       <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">Confidence Index</span>
                    </div>
                 </div>
                 <div className="w-48 h-1.5 bg-[var(--surface)]/10 rounded-full mt-6 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${economicItems.length > 0 ? Math.round(economicItems.reduce((acc: number, i: any) => acc + i.integrityScore, 0) / (economicItems.length || 1)) : 0}%` }}
                      className="h-full bg-indigo-600 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                      transition={{ duration: 2, ease: "easeOut" }}
                    />
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-[var(--surface)] p-12 rounded-[32px] border border-[var(--line)] flex flex-col justify-between shadow-sm group hover:border-rose-400 transition-all">
           <div>
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-rose-50 rounded-[32px] flex items-center justify-center text-rose-500 border border-rose-100">
                    <ShieldAlert aria-hidden="true" size={24} />
                 </div>
                 <span className="text-xs font-black text-[var(--muted)] uppercase tracking-[0.2em]">Asset Risk</span>
              </div>
              <div className="flex items-baseline gap-3">
                 <span className="text-3xl md:text-5xl font-black text-[var(--text)]">
                    {economicItems.filter((i: any) => i.anomaly || i.resilience === 'Critical').length}
                 </span>
                 <span className="text-xs font-black text-rose-500 uppercase tracking-widest">At Risk</span>
              </div>
           </div>
           <div className="pt-6 border-t border-ledge-line/50">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Primary Risk Vector</p>
              <div className="flex items-center gap-2">
                 <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    economicItems.some((i: any) => i.anomaly) ? "bg-rose-500" : "bg-emerald-500"
                 )} />
                 <span className="text-[10px] font-black text-[var(--text)] uppercase">
                    {economicItems.some((i: any) => i.anomaly) ? "Anomalous Price Drift" : "Optimal Sourcing"}
                 </span>
              </div>
           </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-[40px] border border-[var(--line)] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--ink)] border-b border-[var(--line)]">
              <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Item / SKU</th>
              <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</th>
              <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Stock Level</th>
              <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{showRuleIntel ? "Rule True Cost" : "Unit Cost"}</th>
              <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{showRuleIntel ? "Net Margin %" : "Unit Price"}</th>
              <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {displayItems.map((item: any) => (
              <tr key={item.id} className="hover:bg-[var(--ink)]/50 transition-colors group">
                <td className="px-8 py-5">
                  <div>
                    <p className="text-sm font-black text-[var(--text)]">{item.name}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{item.sku}</p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-2 py-1 bg-zinc-100 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {item.category || 'General'}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-black font-mono",
                      item.quantityAtHand <= item.reorderPoint ? "text-rose-600" : "text-[var(--text)]"
                    )}>
                      {item.quantityAtHand}
                    </span>
                    {item.quantityAtHand <= item.reorderPoint && (
                      <AlertTriangle aria-hidden="true" size={14} className="text-rose-500 animate-pulse" />
                    )}
                  </div>
                </td>
                <td className="px-8 py-5">
                  {showRuleIntel ? (
                    <div className={cn(!item.isAnalysisAccurate && "opacity-30 grayscale")}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn(
                          "text-sm font-black font-mono",
                          item.anomaly ? "text-rose-600" : "text-[var(--text)]"
                        )}>{formatCurrency(item.trueCostCents)}</span>
                        {item.integrityScore > 75 && <ShieldCheck aria-hidden="true" size={12} className="text-emerald-500" />}
                        {item.anomaly && <AlertTriangle aria-hidden="true" size={10} className="text-rose-500" />}
                        {!item.isAnalysisAccurate && <Info aria-hidden="true" size={10} className="text-zinc-400" />}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter tabular-nums">
                          Base (Pack): {formatCurrency(item.landedCostStructure.base)}
                        </p>
                        {item.unitsPerPackage && item.unitsPerPackage > 1 && (
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter tabular-nums">
                            {formatCurrency(Math.round(item.trueCostCents / item.unitsPerPackage))} / {item.measurementUnit || 'unit'}
                          </p>
                        )}
                        <p className={cn(
                          "text-[8px] font-bold uppercase tracking-tighter",
                          item.landedCostStructure.direct > 0 ? "text-indigo-600" : "text-zinc-300"
                        , "tabular-nums")}>
                          Direct: +{formatCurrency(item.landedCostStructure.direct)}
                        </p>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter tabular-nums">
                          Indirect: +{formatCurrency(item.landedCostStructure.indirect)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-500 font-mono tabular-nums">{formatCurrency(item.unitCostCents)}</span>
                      {item.unitsPerPackage && item.unitsPerPackage > 1 && (
                        <span className="text-[10px] font-black text-emerald-600 tracking-widest mt-0.5 uppercase tabular-nums">
                          {formatCurrency(Math.round(item.unitCostCents / item.unitsPerPackage))} / {item.measurementUnit || 'unit'}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-8 py-5">
                  {showRuleIntel ? (
                    <div className={cn("flex flex-col gap-1.5", !item.isAnalysisAccurate && "opacity-30")}>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Efficiency</span>
                            {item.isCoreDriver && <Crown aria-hidden="true" size={8} className="text-amber-500" />}
                            {item.anomaly && <AlertTriangle aria-hidden="true" size={8} className="text-rose-500 animate-pulse" />}
                            {item.trajectory > 0 && <TrendingUp aria-hidden="true" size={8} className="text-rose-500" />}
                            {item.trajectory < 0 && <TrendingDown aria-hidden="true" size={8} className="text-emerald-500" />}
                         </div>
                         {item.arbitrage.saving > 0 && item.isAnalysisAccurate && (
                            <span className="text-[8px] font-black text-emerald-600 animate-pulse bg-emerald-50 px-1 rounded tabular-nums">-{formatCurrency(item.arbitrage.saving)} Saving</span>
                         )}
                      </div>
                      <div className={cn(
                        "p-2 rounded-lg border transition-all",
                        item.arbitrage.saving > 0 ? "bg-emerald-50/50 border-emerald-100" : 
                        item.anomaly ? "bg-rose-50/50 border-rose-100" : "bg-zinc-100/50 border-[var(--line)]/50"
                      )}>
                         <div className="flex items-center justify-between gap-4">
                            <span className="text-[9px] font-bold text-zinc-500 truncate max-w-[80px]">{item.arbitrage.bestVendor}</span>
                            <span className="text-xs font-black text-[var(--text)] font-mono italic tabular-nums">
                               {item.arbitrage.bestPrice > 0 ? formatCurrency(item.arbitrage.bestPrice) : "---"}
                            </span>
                         </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1 flex-1 bg-zinc-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              item.integrityScore > 75 ? "bg-emerald-500" : item.integrityScore > 40 ? "bg-amber-500" : "bg-zinc-300"
                            )}
                            style={{ width: `${item.integrityScore}%` }}
                          />
                        </div>
                        <span className="text-[8px] font-black text-zinc-400 uppercase">{item.confidence}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[var(--line)]">
                         <div className="flex flex-col">
                            <span className="text-[7px] font-bold text-zinc-400 uppercase">Strategic Value</span>
                            <span className="text-[9px] font-black text-[var(--text)] font-mono">{item.strategicValue.toFixed(1)}</span>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-[7px] font-bold text-zinc-400 uppercase">EOQ</span>
                            <span className="text-[9px] font-black text-indigo-600 font-mono">{item.eoq > 0 ? item.eoq : '---'} units</span>
                         </div>
                         <div className="text-right">
                            <span className="text-[7px] font-bold text-zinc-400 uppercase">Maturity</span>
                            <div className="flex items-center gap-1">
                               <div className="w-12 h-1 bg-zinc-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-600 transition-all duration-1000" 
                                    style={{ width: `${item.maturityIndex}%` }} 
                                  />
                               </div>
                               <span className="text-[8px] font-black font-mono">{item.maturityIndex}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-emerald-600 font-mono tabular-nums">{formatCurrency(item.unitPriceCents)}</span>
                      {item.unitsPerPackage && item.unitsPerPackage > 1 && (
                        <span className="text-[10px] font-bold text-amber-600 tracking-widest mt-0.5 uppercase tabular-nums">
                          {formatCurrency(Math.round(item.unitPriceCents / item.unitsPerPackage))} / {item.measurementUnit || 'unit'}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {item.quantityAtHand > 0 && (
                      <button 
                        onClick={() => {
                          setCogsItem(item);
                          setCogsQty(1);
                        }}
                        title="Recognize COGS / Record Sale"
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <ShoppingCart aria-hidden="true" size={12} />
                        <span className="hidden lg:inline">COGS</span>
                      </button>
                    )}
                    <button aria-label={`Edit item ${item.name}`}
                      onClick={() => setEditingItem(item)}
                      className="p-2 hover:bg-[var(--surface)] rounded-xl border border-transparent hover:border-[var(--line)] transition-all"
                    >
                      <Edit2 aria-hidden="true" size={14} className="text-zinc-400" />
                    </button>
                    <ConfirmButton 
                      onConfirm={async () => handleDelete(item.id)}
                      confirmMessage="Are you sure you want to delete this inventory item?"
                      className="p-2 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-all text-rose-400"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </ConfirmButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 && !loading && (
          <div className="py-20 text-center">
            <Package aria-hidden="true" size={40} className="text-zinc-200 mx-auto mb-4" />
            <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">No inventory items found</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(isAdding || editingItem) && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                setEditingItem(null);
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--surface)] rounded-[40px] shadow-2xl border border-[var(--line)] overflow-hidden"
            >
              <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between">
                <h3 className="text-xl font-black text-[var(--text)] tracking-tighter">
                  {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
                </h3>
                <button aria-label="Close item dialog"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingItem(null);
                  }} 
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X aria-hidden="true" size={20} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={editingItem ? handleUpdate : handleAdd} className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="col-span-2 space-y-2">
                  <label htmlFor="inv-item-name" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Item Name</label>
                  <input 
                    id="inv-item-name"
                    name="name" 
                    defaultValue={editingItem?.name}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-sku" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">SKU</label>
                  <input 
                    id="inv-sku"
                    name="sku" 
                    defaultValue={editingItem?.sku}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-category" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</label>
                  <input 
                    id="inv-category"
                    name="category" 
                    defaultValue={editingItem?.category}
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-unit-cost" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Unit Cost ($)</label>
                  <input 
                    id="inv-unit-cost"
                    name="unitCost" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingItem ? editingItem.unitCostCents / 100 : undefined}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-unit-price" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Unit Price ($)</label>
                  <input 
                    id="inv-unit-price"
                    name="unitPrice" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingItem ? editingItem.unitPriceCents / 100 : undefined}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-quantity" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Quantity at Hand</label>
                  <input 
                    id="inv-quantity"
                    name="quantity" 
                    type="number" 
                    defaultValue={editingItem?.quantityAtHand}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-reorder-point" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reorder Point</label>
                  <input 
                    id="inv-reorder-point"
                    name="reorderPoint" 
                    type="number" 
                    defaultValue={editingItem?.reorderPoint}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-uom" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">UOM (e.g. pack, kg)</label>
                  <input 
                    id="inv-uom"
                    name="measurementUnit" 
                    type="text" 
                    defaultValue={editingItem?.measurementUnit}
                    placeholder="Optional"
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-units-per-pkg" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Units per Package</label>
                  <input 
                    id="inv-units-per-pkg"
                    name="unitsPerPackage" 
                    type="number" 
                    defaultValue={editingItem?.unitsPerPackage}
                    placeholder="1"
                    min="1"
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="col-span-2 pt-4">
                  <AsyncButton 
                    type="submit" 
                    loadingText={editingItem ? 'Updating...' : 'Adding...'}
                    className="w-full py-5 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
                  >
                    {editingItem ? 'Update Item' : 'Add to Inventory'}
                  </AsyncButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {cogsItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCogsItem(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[var(--surface)] rounded-[32px] shadow-2xl border border-[var(--line)] overflow-hidden"
            >
              <div className="p-6 border-b border-[var(--line)] flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-[var(--text)] tracking-tight">
                    Recognize COGS / Record Sale
                  </h3>
                  <p className="text-xs text-[var(--muted)] font-mono mt-0.5">{cogsItem.name} ({cogsItem.sku})</p>
                </div>
                <button aria-label="Close cost of goods sold dialog"
                  onClick={() => setCogsItem(null)} 
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X aria-hidden="true" size={18} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={handleRecognizeCogs} className="p-6 space-y-4">
                <div className="p-4 bg-[var(--ink)] rounded-2xl border border-[var(--line)] text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Available Stock:</span>
                    <span className="font-bold text-[var(--text)]">{cogsItem.quantityAtHand} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Blended Unit Cost:</span>
                    <span className="font-bold text-[var(--text)] tabular-nums">{formatCurrency(cogsItem.unitCostCents || 5000)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Estimated Total COGS:</span>
                    <span className="font-bold text-emerald-600 font-mono tabular-nums">
                      {formatCurrency(cogsQty * (cogsItem.unitCostCents || 5000))}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Labelled labelClassName="text-[10px] font-bold text-zinc-400 uppercase tracking-widest" label="Units Sold / Dispatched">
                    <input 
                      type="number" 
                      min="1" 
                      max={cogsItem.quantityAtHand}
                      value={cogsQty} 
                      onChange={(e) => setCogsQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      required 
                      className="w-full px-5 py-3 bg-[var(--ink)] border border-[var(--line)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 font-bold" 
                    />
                  </Labelled>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isPostingCogs}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                  >
                    {isPostingCogs ? 'Posting to Ledger...' : `Post ${cogsQty} Units COGS to Ledger`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
