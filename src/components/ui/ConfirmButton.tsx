import React, { useState } from 'react';
import { cn, safeConfirm } from '../../lib/utils';
import AsyncButton from './AsyncButton';

interface ConfirmButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onConfirm: () => Promise<void>;
  confirmMessage?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function ConfirmButton({ onConfirm, confirmMessage = "Are you sure?", children, className, variant = 'danger', size, ...props }: ConfirmButtonProps) {
  const handleConfirm = async () => {
    if (safeConfirm(confirmMessage)) {
      await onConfirm();
    }
  };

  return (
    <AsyncButton onClick={handleConfirm} className={className} variant={variant} size={size} {...props}>
      {children}
    </AsyncButton>
  );
}
