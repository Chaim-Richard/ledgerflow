import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AsyncButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: React.ReactNode;
}

export default function AsyncButton({
  children,
  onClick,
  loading,
  loadingText,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  icon,
  ...props
}: AsyncButtonProps) {
  const [internalPending, setInternalPending] = useState(false);
  const isPending = loading !== undefined ? loading : internalPending;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isPending || disabled) return;
    
    if (onClick) {
      try {
        setInternalPending(true);
        await onClick(e);
      } finally {
        setInternalPending(false);
      }
    }
  };

  const variants = {
    primary: "bg-[var(--brass)] hover:bg-[#e5be6b] text-black border-[var(--brass-line)] shadow-xs",
    secondary: "bg-[var(--surface)] border border-[var(--line)] text-[var(--text)] hover:bg-[var(--elevated)] hover:text-white",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20",
    ghost: "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--elevated)] border border-transparent",
    outline: "border-2 border-[var(--brass)] text-[var(--brass)] hover:bg-[var(--brass)] hover:text-black"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2"
  };

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={disabled || isPending}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brass)]/30 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {isPending ? (
        <Loader2 size={size === 'sm' || size === 'icon' ? 14 : 16} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      
      {size !== 'icon' && (
        <span>{isPending && loadingText ? loadingText : children}</span>
      )}
    </button>
  );
}
