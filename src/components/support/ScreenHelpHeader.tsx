import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useUIStore } from "../../stores/useUIStore";
import { useDialog } from "../../hooks/useDialog";
import {
  currentScreenHelp,
  type ScreenHelpEntry,
} from "../../lib/screenHelpIndex";
function ScreenHelpDialog({
  entry,
  onClose,
}: {
  entry: ScreenHelpEntry;
  onClose: () => void;
}) {
  const { dialogProps, titleId } = useDialog(onClose);
  return createPortal(
    <div {...dialogProps} className="fixed inset-0 z-[180] bg-black/50 p-3 flex items-center justify-center">
      <div
        className="w-full max-w-xl max-h-[85dvh] overflow-y-auto p-5 space-y-4 rounded-xl border bg-[var(--panel)] text-[var(--text)]"
      >
        <h2 id={titleId} className="text-xl font-semibold">
          Help for {entry.label}
        </h2>
        <p>{entry.help}</p>
        <p>
          Related metadata can be edited in the shared side drawer where
          offered. Use the existing header pin control to keep a page handy
          while visiting another screen.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-11 px-4 border rounded"
            onClick={onClose}
          >
            Close help
          </button>
          <button
            type="button"
            className="min-h-11 px-4 border rounded"
            onClick={() => {
              onClose();
              useUIStore.getState().goToPage({ tab: "help" });
            }}
          >
            Open Help & Guide
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
function HelpControl({ entry }: { entry: ScreenHelpEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-end gap-3 px-4 py-1 border-b border-[var(--line)] bg-[var(--surface)]">
      <span className="text-sm text-[var(--muted)]">{entry.label}</span>
      <button
        type="button"
        className="shrink-0 min-h-11 min-w-11 px-3 border rounded-lg"
        aria-label={`Help for ${entry.label}`}
        onClick={() => setOpen(true)}
      >
        ? Help
      </button>
      {open && (
        <ScreenHelpDialog entry={entry} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
export default function ScreenHelpHeader({ activeTab }: { activeTab: string }) {
  const report = useUIStore((state) => state.activeReportTab),
    setting = useUIStore((state) => state.activeSettingsTab),
    intelligence = useUIStore((state) => state.activeIntelChannel);
  const entry = currentScreenHelp(activeTab, report, setting, intelligence);
  return entry ? <HelpControl key={entry.key} entry={entry} /> : null;
}
