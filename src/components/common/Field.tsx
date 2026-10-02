import React, { useId } from 'react';
import * as Label from '@radix-ui/react-label';

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  error,
  hint,
  required = false,
  htmlFor: customHtmlFor,
  className = '',
  children,
}) => {
  const generatedId = useId();
  const id = customHtmlFor || generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  // Clone single React element to automatically attach id, aria-invalid, and aria-describedby
  const renderChildren = () => {
    if (React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)) {
      const childProps: React.HTMLAttributes<HTMLElement> = {
        id: children.props.id || id,
      };
      if (error) {
        childProps['aria-invalid'] = true;
      }
      if (describedBy) {
        childProps['aria-describedby'] =
          children.props['aria-describedby'] || describedBy;
      }
      return React.cloneElement(children, childProps);
    }
    return children;
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <Label.Root
          htmlFor={id}
          className="text-xs font-semibold text-[var(--text,#171717)] flex items-center gap-1"
        >
          {label}
          {required && <span className="text-red-500 font-bold" aria-hidden="true">*</span>}
        </Label.Root>
      </div>

      {renderChildren()}

      {hint && !error && (
        <span id={hintId} className="text-[11px] text-[var(--text-muted,#737373)]">
          {hint}
        </span>
      )}

      {error && (
        <span
          id={errorId}
          role="alert"
          className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1"
        >
          {error}
        </span>
      )}
    </div>
  );
};
