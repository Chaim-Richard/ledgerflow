import React from 'react';
import PartyDetailView from '../common/PartyDetailView';

interface CustomerDetailViewProps {
  customerId: string;
  onBack: () => void;
}

export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  return (
    <PartyDetailView
      side="customer"
      partyId={customerId}
      onBack={onBack}
    />
  );
}
