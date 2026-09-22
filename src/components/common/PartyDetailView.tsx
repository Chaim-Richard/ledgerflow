import React from 'react';
import { Customer, Vendor } from '../../types';
import { PartySide } from '../../config/partySides';

export interface PartyDetailViewProps {
  party: Customer | Vendor;
  side: PartySide;
}

export const PartyDetailView: React.FC<PartyDetailViewProps> = ({ party, side }) => {
  const partyStatus =
    side === 'customer'
      ? (party as Customer).status
      : (party as Vendor).pipelineStage;

  const isActive =
    side === 'customer'
      ? (party as Customer).status === 'active' || !(party as Customer).status
      : (party as Vendor).pipelineStage === 'Active' || !(party as Vendor).pipelineStage;

  return (
    <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{party.name}</h2>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
            isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {partyStatus || 'Active'}
        </span>
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        <p>Email: {party.email || 'N/A'}</p>
        <p>Phone: {party.phone || 'N/A'}</p>
      </div>
    </div>
  );
};
