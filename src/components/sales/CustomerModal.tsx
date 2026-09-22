import React from 'react';
import { Customer } from '../../types';
import PartyModal from '../common/PartyModal';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Partial<Customer>) => void;
}

export default function CustomerModal({ isOpen, onClose, onSave }: CustomerModalProps) {
  return (
    <PartyModal
      side="customer"
      isOpen={isOpen}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
