
import React from 'react';
import { Target } from 'lucide-react';

export default function UnifiedPlanningEngine() {
  return (
    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-50">
      <div className="w-16 h-16 bg-white border border-slate-200 text-sky-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <Target className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Unified Planning Engine</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        This planning module has been migrated to the central strategic forecaster.
        Scenarios are now simulated dynamically using the universal ledger state.
      </p>
    </div>
  );
}
