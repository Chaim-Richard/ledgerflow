import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClickAction: () => Promise<void>;
}

export function AsyncButton({ onClickAction, children, className, disabled, type = 'button', ...props }: AsyncButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || disabled) return;
    
    setLoading(true);
    try {
      await onClickAction();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type={type}
      className={cn(className, loading && 'opacity-70 cursor-not-allowed')}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2 inline" /> : null}
      {children}
    </button>
  );
}
