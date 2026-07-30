import React, { useState } from 'react';
import { cn, safeConfirm } from '../../lib/utils';
import { AsyncButton } from './AsyncButton';

interface ConfirmButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onConfirm: () => Promise<void>;
  confirmMessage?: string;
}

export function ConfirmButton({ onConfirm, confirmMessage = "Are you sure?", children, className, ...props }: ConfirmButtonProps) {
  const handleConfirm = async () => {
    if (safeConfirm(confirmMessage)) {
      await onConfirm();
    }
  };

  return (
    <AsyncButton onClickAction={handleConfirm} className={className} {...props}>
      {children}
    </AsyncButton>
  );
}
