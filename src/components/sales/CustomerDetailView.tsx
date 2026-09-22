import React from 'react';
import { PartyDetailView } from '../common/PartyDetailView';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface CustomerDetailViewProps {
  customerId: string;
  onBack: () => void;
}

export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  const customers = useLedgerStore(s => s.customers) || [];
  const customer = customers.find(c => c.id === customerId);

  if (!customer) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Customer not found.</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 font-semibold hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button onClick={onBack} className="text-sm text-indigo-600 font-semibold hover:underline flex items-center gap-1">
          ← Back to Customers
        </button>
      </div>
      <PartyDetailView
        side="customer"
        party={customer}
      />
    </div>
  );
}
