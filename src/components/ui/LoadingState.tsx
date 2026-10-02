import React from 'react';
import { Loader2 } from 'lucide-react';

/** Shown instead of "nothing here" while a screen's data is still loading (I-01). */
export function LoadingState({ what }: { what: string }) {
  return (
    <div role="status" className="p-8 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      Loading {what}…
    </div>
  );
}
