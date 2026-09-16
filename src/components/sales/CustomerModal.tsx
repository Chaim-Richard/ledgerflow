import React, { useState } from 'react';
import { Save, User } from 'lucide-react';
import { Customer } from '../../types';
import AsyncButton from '../ui/AsyncButton';
import { RadixModal, FormLabel } from '../ui/RadixModal';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Partial<Customer>) => void;
}

export default function CustomerModal({ isOpen, onClose, onSave }: CustomerModalProps) {
  const [customer, setCustomer] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    balanceCents: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(customer);
  };

  return (
    <RadixModal isOpen={isOpen} onClose={onClose} title="Add Customer" description="Create a new client profile for invoicing and receivables">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FormLabel htmlFor="customer-name" required>Customer / Organization Name</FormLabel>
          <input
            id="customer-name"
            type="text"
            required
            value={customer.name || ''}
            onChange={e => setCustomer({ ...customer, name: e.target.value })}
            placeholder="Acme Corp"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <FormLabel htmlFor="customer-email">Email Address</FormLabel>
          <input
            id="customer-email"
            type="email"
            value={customer.email || ''}
            onChange={e => setCustomer({ ...customer, email: e.target.value })}
            placeholder="billing@acme.com"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <FormLabel htmlFor="customer-phone">Phone Number</FormLabel>
          <input
            id="customer-phone"
            type="tel"
            value={customer.phone || ''}
            onChange={e => setCustomer({ ...customer, phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <AsyncButton
            type="submit"
            icon={Save as any}
            variant="primary"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
          >
            Save Customer Profile
          </AsyncButton>
        </div>
      </form>
    </RadixModal>
  );
}
