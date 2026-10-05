import { useState } from 'react';
import { Banknote, Download, Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { downloadDocumentsZip } from '../../services/documentDownloads';
import { emailInvoices } from '../../services/bulkDocumentActions';
import { sendPlan, type BulkDocument } from '../../lib/bulkDocuments';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import BulkPaymentDialog from './BulkPaymentDialog';
import type { PdfDocumentKind } from './PdfPreviewModal';

interface DocumentBulkBarProps {
  type: Exclude<PdfDocumentKind, 'statement'>;
  /** e.g. "invoice" */
  noun: string;
  ids: string[];
  workspaceId: string;
  onClear: () => void;
  /** The ticked invoices or bills themselves: adds paying them (and emailing invoices). */
  documents?: BulkDocument[];
}

/**
 * Acting on the documents ticked in a list (K-06): download them all as PDFs in one zip (Y-18);
 * invoices and bills can also be paid in full at once, and invoices emailed (not for viewers).
 */
export default function DocumentBulkBar({ type, noun, ids, workspaceId, onClear, documents }: DocumentBulkBarProps) {
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const role = useCurrentRole();
  if (ids.length === 0) return null;
  const canAct = !!documents?.length && role !== 'viewer' && (type === 'invoice' || type === 'bill');
  const email = async () => {
    const { send, skipped } = sendPlan(documents || []);
    for (const s of skipped) toast.info(`${s.label} not emailed: ${s.reason}`);
    if (send.length === 0) return;
    setSending(true);
    try {
      const { sent, failed } = await emailInvoices(send, workspaceId);
      if (sent.length) toast.success(`${sent.length} invoice${sent.length === 1 ? '' : 's'} emailed`);
      for (const f of failed) toast.error(`${f.label} not emailed: ${f.message}`);
    } finally {
      setSending(false);
    }
  };
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
      {canAct && type === 'invoice' && (
        <button type="button" disabled={sending} onClick={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold disabled:opacity-50">
          <Mail aria-hidden="true" className="w-4 h-4" /> {sending ? 'Sending…' : 'Email to customers'}
        </button>
      )}
      {canAct && (
        <button type="button" onClick={() => setPaying(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-semibold">
          <Banknote aria-hidden="true" className="w-4 h-4" /> {type === 'invoice' ? 'Record payment' : 'Pay bills'}
        </button>
      )}
      {paying && documents && (
        <BulkPaymentDialog side={type === 'bill' ? 'bill' : 'invoice'} documents={documents} onClose={() => setPaying(false)}
          onDone={paid => { if (paid.length) onClear(); }} />
      )}
      <button type="button" onClick={onClear} aria-label="Clear selection" className="ml-auto p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]">
        <X aria-hidden="true" className="w-4 h-4" />
      </button>
    </div>
  );
}
