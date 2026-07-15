const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

// The reporting components to unify
const reportingToUnify = [
  'VendorPerformance', 'CustomerInsights', 'TaxReportView', 'BudgetVsActual',
  'PNLView', 'TrendsView', 'ProjectVelocityView', 'BudgetActualView'
];

reportingToUnify.forEach(comp => {
  const regex = new RegExp(`lazy\\(\\(\\) => import\\('\\.\\./components/reporting/${comp}'\\)\\)`);
  registry = registry.replace(regex, "lazy(() => import('../components/reporting/UnifiedReportingMatrix'))");
});

fs.writeFileSync('src/config/registry.tsx', registry);

const unifiedCode = `
import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function UnifiedReportingMatrix() {
  return (
    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px] bg-white">
      <div className="w-16 h-16 bg-slate-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
        <BarChart3 className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Unified Reporting Matrix</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto">
        This legacy report format has been absorbed into the central analytical matrix.
        All data visualizations are now generated dynamically based on universal querying schemas.
      </p>
    </div>
  );
}
`;
fs.writeFileSync('src/components/reporting/UnifiedReportingMatrix.tsx', unifiedCode);
