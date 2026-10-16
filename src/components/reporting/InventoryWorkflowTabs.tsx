import React, { useRef } from 'react';

interface WorkflowTab<T extends string> {
  id: T;
  label: string;
  panelId: string;
}

/** One keyboard stop per tablist; arrow/Home/End keys focus and activate the next tab. */
export default function InventoryWorkflowTabs<T extends string>({
  tabs, value, onChange, label, idPrefix, className = '',
}: {
  tabs: WorkflowTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idPrefix: string;
  className?: string;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = window.getComputedStyle(event.currentTarget).direction === 'rtl';
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + (rtl ? -1 : 1) + tabs.length) % tabs.length; break;
      case 'ArrowLeft': next = (index + (rtl ? 1 : -1) + tabs.length) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onChange(tabs[next].id);
    buttons.current[next]?.focus();
  };

  return <div role="tablist" aria-label={label} aria-orientation="horizontal"
    className={`flex flex-wrap gap-2 border-b border-[var(--line)] ${className}`} data-print-hide>
    {tabs.map((tab, index) => <button key={tab.id} ref={button => { buttons.current[index] = button; }}
      type="button" role="tab" id={`${idPrefix}-tab-${tab.id}`} aria-controls={tab.panelId}
      aria-selected={value === tab.id} tabIndex={value === tab.id ? 0 : -1}
      className={`min-h-11 px-3 border-b-2 ${value === tab.id ? 'border-[var(--brass)] font-semibold' : 'border-transparent text-[var(--muted)]'}`}
      onKeyDown={event => onKeyDown(event, index)} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>;
}
