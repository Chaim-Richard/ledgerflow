import React, { useState, useMemo } from 'react';
import { FixedAsset, Transaction } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { calculateStraightLineDepreciation, generateDepreciationLedgerEntry, DepreciationPeriodEntry } from '../../lib/depreciationEngine';
import { formatCurrency, formatDate, formatTzDate } from '../../lib/utils';
import { toast } from 'sonner';
import { useTimeout } from '../../hooks/useTimeout';
import { 
  Building, 
  Plus, 
  CheckCircle2, 
  X,
  Check
} from 'lucide-react';

export const FixedAssetsView: React.FC = () => {
  const assets = useLedgerStore(s => (s.assets || []) as FixedAsset[]);
  const setAssets = useLedgerStore(s => s.setAssets);
  const transactions = useLedgerStore(s => s.transactions);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const user = useAuthStore(s => s.user);
  const currentWorkspace = getCurrentWorkspace();

  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { setSafeTimeout } = useTimeout();

  // Form State
  const [assetName, setAssetName] = useState('');
  const [assetCost, setAssetCost] = useState('');
  const [salvageValue, setSalvageValue] = useState('0');
  const [usefulLifeYears, setUsefulLifeYears] = useState('5');
  const [purchaseDate, setPurchaseDate] = useState(() => formatTzDate(new Date(), currentWorkspace?.timezone));

  // Register Metrics
  const registerMetrics = useMemo(() => {
    const todayStr = formatTzDate(new Date(), currentWorkspace?.timezone);

    const enhancedAssets = assets.map(asset => {
      const schedule = calculateStraightLineDepreciation(asset, todayStr);
      const effectiveAccum = asset.accumulatedDepreciationCents || 0;
      const effectiveBookValue = Math.max(asset.salvageValueCents || 0, (asset.purchasePriceCents || 0) - effectiveAccum);

      return {
        ...asset,
        schedule,
        effectiveAccum,
        effectiveBookValue
      };
    });

    const totalCostCents = enhancedAssets.reduce((sum, a) => sum + (a.purchasePriceCents || 0), 0);
    const totalAccumulatedDepreciationCents = enhancedAssets.reduce((sum, a) => sum + a.effectiveAccum, 0);
    const totalBookValueCents = enhancedAssets.reduce((sum, a) => sum + a.effectiveBookValue, 0);

    return {
      enhancedAssets,
      totalCostCents,
      totalAccumulatedDepreciationCents,
      totalBookValueCents
    };
  }, [assets, currentWorkspace?.timezone]);

  const handleSaveAsset = () => {
    if (!assetName || !assetCost) return;

    const purchasePriceCents = Math.round(parseFloat(assetCost) * 100);
    const salvageCents = Math.round((parseFloat(salvageValue) || 0) * 100);
    const years = parseFloat(usefulLifeYears) || 5;

    const newAsset: FixedAsset = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      name: assetName,
      purchaseDate,
      purchasePriceCents,
      salvageValueCents: salvageCents,
      usefulLifeYears: years,
      depreciationMethod: 'straight-line',
      accumulatedDepreciationCents: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setAssets([...assets, newAsset]);
    setIsAddingAsset(false);
    setAssetName('');
    setAssetCost('');
    setSalvageValue('0');
    setUsefulLifeYears('5');
    setSuccessMessage(`Capitalized asset "${assetName}" into register.`);
    setSafeTimeout(() => setSuccessMessage(null), 4000);
  };

  const handlePostMonthlyDepreciation = (asset: FixedAsset) => {
    const todayStr = formatTzDate(new Date(), currentWorkspace?.timezone);
    const schedule = calculateStraightLineDepreciation(asset, todayStr);
    
    if (!schedule || schedule.length === 0) {
      toast.error('No depreciation schedule available for this asset.');
      return;
    }

    const firstPeriod = schedule[0];
    const monthlyDepAmount = firstPeriod.depreciationAmountCents;

    if (monthlyDepAmount <= 0 || (asset.accumulatedDepreciationCents >= (asset.purchasePriceCents - asset.salvageValueCents))) {
      toast.error('Asset is already fully depreciated.');
      return;
    }

    const periodEntry: DepreciationPeriodEntry = {
      periodDate: todayStr,
      depreciationAmountCents: monthlyDepAmount,
      accumulatedDepreciationCents: asset.accumulatedDepreciationCents + monthlyDepAmount,
      bookValueCents: Math.max(asset.salvageValueCents, (asset.purchasePriceCents - (asset.accumulatedDepreciationCents + monthlyDepAmount)))
    };

    const partialTx = generateDepreciationLedgerEntry(asset, periodEntry);

    const fullTx: Transaction = {
      id: `tx_dep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid: user?.uid || 'system',
      workspaceId: currentWorkspace?.id || 'default',
      date: periodEntry.periodDate,
      description: partialTx.description || `Depreciation Expense - ${asset.name}`,
      totalAmountCents: periodEntry.depreciationAmountCents,
      currency: currentWorkspace?.currency || 'USD',
      status: 'completed',
      type: 'journal',
      lines: partialTx.lines || [],
      createdAt: new Date().toISOString()
    };

    setTransactions([...transactions, fullTx]);

    // Update asset accumulated depreciation
    const updated = assets.map(a => a.id === asset.id ? {
      ...a,
      accumulatedDepreciationCents: Math.min(a.purchasePriceCents - (a.salvageValueCents || 0), a.accumulatedDepreciationCents + monthlyDepAmount)
    } : a);

    setAssets(updated);
    setSuccessMessage(`Posted monthly depreciation of ${formatCurrency(monthlyDepAmount)} for "${asset.name}" to ledger.`);
    setSafeTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="fixed-assets-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-neutral-800" />
            Fixed Asset Register & Depreciation Schedule
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Track capital expenditures, amortization schedules, book values, and auto-post depreciation journal entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingAsset(true)}
            className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            id="add-asset-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            Capitalize Asset
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase">Gross Capitalized Cost</div>
          <div className="text-xl font-mono font-bold text-neutral-900 mt-1.5">
            {formatCurrency(registerMetrics.totalCostCents)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">{assets.length} capitalized assets</div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase">Accumulated Depreciation</div>
          <div className="text-xl font-mono font-bold text-rose-600 mt-1.5">
            {formatCurrency(registerMetrics.totalAccumulatedDepreciationCents)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">Cumulative written-off value</div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-neutral-200 shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase">Net Carrying Book Value</div>
          <div className="text-xl font-mono font-bold text-emerald-600 mt-1.5">
            {formatCurrency(registerMetrics.totalBookValueCents)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">Balance sheet carrying amount</div>
        </div>
      </div>

      {/* Asset Table */}
      {assets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 p-6">
          <Building className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-800">No Fixed Assets Capitalized</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            Record physical equipment, leasehold improvements, vehicles, and technology hardware to automate monthly depreciation postings.
          </p>
          <button
            onClick={() => setIsAddingAsset(true)}
            className="mt-4 px-4 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Capitalize First Asset
          </button>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Asset Description</th>
                <th className="py-3 px-4">Acquisition Date</th>
                <th className="py-3 px-4 text-right">Cost Basis</th>
                <th className="py-3 px-4 text-right">Useful Life</th>
                <th className="py-3 px-4 text-right">Accum. Dep.</th>
                <th className="py-3 px-4 text-right">Net Book Value</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {registerMetrics.enhancedAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-neutral-900">
                    <div>{asset.name}</div>
                    <div className="text-[11px] text-neutral-400 font-normal">Straight-Line Method</div>
                  </td>
                  <td className="py-3 px-4 text-neutral-600 font-mono">
                    {formatDate(asset.purchaseDate)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-900 font-medium">
                    {formatCurrency(asset.purchasePriceCents)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-600">
                    {asset.usefulLifeYears || 5} Years
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-600">
                    {formatCurrency(asset.effectiveAccum)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                    {formatCurrency(asset.effectiveBookValue)}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handlePostMonthlyDepreciation(asset)}
                      className="px-2.5 py-1 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-md transition-colors border border-neutral-300 cursor-pointer"
                      title="Post 1-Month Depreciation Journal"
                    >
                      Post Period Dep.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Asset Modal */}
      {isAddingAsset && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-neutral-200">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <h3 className="text-sm font-bold text-neutral-900">Capitalize Fixed Asset</h3>
              <button onClick={() => setIsAddingAsset(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Asset Name / Model</label>
                <input
                  type="text"
                  placeholder="e.g. MacBook Pro M3 Max Server Lab"
                  value={assetName}
                  onChange={e => setAssetName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Cost Basis ($)</label>
                  <input
                    type="number"
                    placeholder="4500.00"
                    value={assetCost}
                    onChange={e => setAssetCost(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Salvage Value ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={salvageValue}
                    onChange={e => setSalvageValue(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Useful Life (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    placeholder="5"
                    value={usefulLifeYears}
                    onChange={e => setUsefulLifeYears(e.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Acquisition Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full p-2 bg-white border border-neutral-300 rounded-lg focus:ring-1 focus:ring-neutral-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAsset(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsset}
                  disabled={!assetName || !assetCost}
                  className="px-4 py-2 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save & Capitalize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedAssetsView;
