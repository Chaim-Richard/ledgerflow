import React from 'react';
import { Vendor } from '../../types';
import PartyModal from '../common/PartyModal';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vendor: Partial<Vendor>) => void;
}

export default function VendorModal({ isOpen, onClose, onSave }: VendorModalProps) {
  return (
    <PartyModal
      side="vendor"
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
