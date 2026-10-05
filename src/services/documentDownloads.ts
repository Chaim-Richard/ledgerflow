import { getIdToken } from '../firebase';
import type { PdfDocumentKind } from '../components/ui/PdfPreviewModal';

/** Downloads several documents of one kind as PDFs in one zip file (Y-18). */
export async function downloadDocumentsZip(type: Exclude<PdfDocumentKind, 'statement'>, ids: string[], workspaceId: string): Promise<void> {
  const res = await fetch('/api/v1/documents/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
    body: JSON.stringify({ workspaceId, type, ids }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'The PDFs could not be downloaded');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}s_${ids.length}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
