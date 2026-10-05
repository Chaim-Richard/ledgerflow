import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { downloadDocumentsZip } from '../../services/documentDownloads';
import type { PdfDocumentKind } from './PdfPreviewModal';

interface DocumentBulkBarProps {
  type: Exclude<PdfDocumentKind, 'statement'>;
  /** e.g. "invoice" */
  noun: string;
  ids: string[];
  workspaceId: string;
  onClear: () => void;
}

/** Acting on the documents ticked in a list (K-06): download them all as PDFs in one zip (Y-18). */
export default function DocumentBulkBar({ type, noun, ids, workspaceId, onClear }: DocumentBulkBarProps) {
  const [busy, setBusy] = useState(false);
  if (ids.length === 0) return null;
  const download = async () => {
    setBusy(true);
    try {
      await downloadDocumentsZip(type, ids, workspaceId);
      toast.success(`${ids.length} ${noun}${ids.length === 1 ? '' : 's'} downloaded`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="toolbar" aria-label={`Selected ${noun}s`} className="flex flex-wrap items-center gap-3 px-4 py-2 rounded-xl border border-[var(--brass-line)] bg-[var(--brass-soft)] text-sm text-[var(--text)]">
      <span className="font-semibold">{ids.length} {noun}{ids.length === 1 ? '' : 's'} selected</span>
      <button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold disabled:opacity-50">
        <Download aria-hidden="true" className="w-4 h-4" /> {busy ? 'Preparing…' : 'Download PDFs (zip)'}
      </button>
      <button type="button" onClick={onClear} aria-label="Clear selection" className="ml-auto p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]">
        <X aria-hidden="true" className="w-4 h-4" />
      </button>
    </div>
  );
}
