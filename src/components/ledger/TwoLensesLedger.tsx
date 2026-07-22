import React, { useState } from 'react';
import Ledger from './Ledger';
import OwnerLens from './OwnerLens';
import { Briefcase, Calculator } from 'lucide-react';

export default function TwoLensesLedger(props: any) {
  const [lens, setLens] = useState<'owner' | 'accountant'>('owner');

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <div className="bg-slate-100 p-1 rounded-xl inline-flex shadow-sm border border-[var(--line)]">
          <button
            onClick={() => setLens('owner')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center transition-all ${
              lens === 'owner' ? 'bg-[var(--surface)] text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Briefcase className="w-4 h-4 mr-2" /> Owner Lens
          </button>
          <button
            onClick={() => setLens('accountant')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center transition-all ${
              lens === 'accountant' ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calculator className="w-4 h-4 mr-2" /> Accountant Lens
          </button>
        </div>
      </div>

      {lens === 'owner' ? <OwnerLens /> : <Ledger {...props} />}
    </div>
  );
}
