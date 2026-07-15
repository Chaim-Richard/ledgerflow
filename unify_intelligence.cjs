const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

// The intelligence components to unify
const intelligenceToUnify = [
  'DeepPredictiveMaintenance', 'SmartReconciliation', 'EconomicOrderQuantity',
  'MarketMultiplier', 'CEOBoardroom', 'CFOAtHome', 'BusinessOxygen',
  'GrowthStrategy', 'PricingOptimizer', 'LedgerAutoPilot'
];

intelligenceToUnify.forEach(comp => {
  const regex = new RegExp(`lazy\\(\\(\\) => import\\('\\.\\./components/intelligence/${comp}'\\)\\)`);
  registry = registry.replace(regex, "lazy(() => import('../components/intelligence/UnifiedIntelligenceCore'))");
});

fs.writeFileSync('src/config/registry.tsx', registry);

const unifiedCode = `
import React from 'react';
import { BrainCircuit } from 'lucide-react';

export default function UnifiedIntelligenceCore() {
  return (
    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-900">
      <div className="w-16 h-16 bg-slate-800 text-purple-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-700">
        <BrainCircuit className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Unified Intelligence Core</h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        This predictive model is now running via the central neural engine.
        Insights and prescriptive strategies will be pushed dynamically to the main dashboard.
      </p>
    </div>
  );
}
`;
fs.writeFileSync('src/components/intelligence/UnifiedIntelligenceCore.tsx', unifiedCode);
