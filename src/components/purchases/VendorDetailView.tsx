import React from 'react';
import PartyDetailView from '../common/PartyDetailView';

interface VendorDetailViewProps {
  vendorId: string;
  onBack: () => void;
}

export default function VendorDetailView({ vendorId, onBack }: VendorDetailViewProps) {
  return (
    <PartyDetailView
      side="vendor"
      partyId={vendorId}
      onBack={onBack}
    />
  );
}
