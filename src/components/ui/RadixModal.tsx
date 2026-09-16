import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Label from '@radix-ui/react-label';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function RadixModal({ isOpen, onClose, title, description, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in" />
        <Dialog.Content
          className={`fixed left-[50%] top-[50%] z-50 w-full ${maxWidth} translate-x-[-50%] translate-y-[-50%] bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 focus:outline-none max-h-[90vh] overflow-y-auto animate-in zoom-in-95`}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <Dialog.Title className="text-lg font-bold text-slate-900">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-slate-500 mt-0.5">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FormLabel({ htmlFor, children, required, className = '' }: { htmlFor: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <Label.Root htmlFor={htmlFor} className={`block text-xs font-semibold text-slate-700 mb-1 cursor-pointer ${className}`}>
      {children} {required && <span className="text-rose-500">*</span>}
    </Label.Root>
  );
}
