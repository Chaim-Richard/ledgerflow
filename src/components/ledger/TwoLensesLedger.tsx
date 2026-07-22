import React, { useState } from 'react';
import Ledger from './Ledger';
import OwnerLens from './OwnerLens';
import { Briefcase, Calculator } from 'lucide-react';

export default function TwoLensesLedger(props: any) {
  const [lens, setLens] = useState<'owner' | 'accountant'>('owner');

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <div className="bg-[var(--panel)] p-1 rounded-xl inline-flex shadow-sm border border-[var(--line)]">
          <button
            onClick={() => setLens('owner')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center transition-all ${
              lens === 'owner' ? 'bg-[var(--brass)] text-black shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Briefcase className="w-4 h-4 mr-2" /> Owner Lens
          </button>
          <button
            onClick={() => setLens('accountant')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center transition-all ${
              lens === 'accountant' ? 'bg-[var(--brass)] text-black shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'
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
