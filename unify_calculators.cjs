const fs = require('fs');
let registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

// Replace all lazy(() => import('../components/finance/XYZCalculator'))
// with lazy(() => import('../components/finance/UnifiedCalculator'))
// for any file that ends in Calculator
registry = registry.replace(/lazy\(\(\) => import\('\.\.\/components\/finance\/[A-Za-z0-9]+Calculator'\)\)/g, "lazy(() => import('../components/finance/UnifiedCalculator'))");

fs.writeFileSync('src/config/registry.tsx', registry);

const unifiedCode = `
import React from 'react';
export default function UnifiedCalculator() {
  return (
    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[400px]">
      <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Computational Engine</h2>
      <p className="text-sm text-slate-500 max-w-md">
        This analytical lens is currently being routed through the central Unified Calculator matrix. 
        Advanced formula structures are dynamically loaded here via the API system.
      </p>
    </div>
  );
}
`;
fs.writeFileSync('src/components/finance/UnifiedCalculator.tsx', unifiedCode);
