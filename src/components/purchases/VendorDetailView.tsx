import React from 'react';
import { PartyDetailView } from '../common/PartyDetailView';
import { useLedgerStore } from '../../stores/useLedgerStore';

interface VendorDetailViewProps {
  vendorId: string;
  onBack: () => void;
}

export default function VendorDetailView({ vendorId, onBack }: VendorDetailViewProps) {
  const vendors = useLedgerStore(s => s.vendors) || [];
  const vendor = vendors.find(v => v.id === vendorId);

  if (!vendor) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Vendor not found.</p>
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
          ← Back to Vendors
        </button>
      </div>
      <PartyDetailView
        side="vendor"
        party={vendor}
      />
    </div>
  );
}
