import React from 'react';
import PartyModal from '../common/PartyModal';
import type { Vendor } from '../../types';

/** Add or edit a vendor (the shared contact form, src/components/common/PartyModal.tsx). */
export default function VendorModal(props: { isOpen: boolean; onClose: () => void; onSave: (vendor: Partial<Vendor>) => void; initial?: Partial<Vendor> | null }) {
  return <PartyModal side="vendor" {...props} />;
}
