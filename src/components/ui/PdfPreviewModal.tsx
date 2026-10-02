import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Loader2, AlertCircle, FileText } from 'lucide-react';
import { getIdToken } from '../../firebase';
import { toast } from 'sonner';

export interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentType: 'invoice' | 'estimate' | 'creditNote' | 'payment' | 'statement';
  documentId: string;
  workspaceId: string;
  filename?: string;
}

export async function fetchDocumentPdfBlob(
  type: 'invoice' | 'estimate' | 'creditNote' | 'payment' | 'statement',
  id: string,
  workspaceId: string
): Promise<Blob> {
  if (!workspaceId) throw new Error('Workspace ID is required to generate PDF');
  if (!id) throw new Error('Document ID is required');

  const token = await getIdToken().catch(() => null);
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/v1/documents/${type}/${encodeURIComponent(id)}/pdf?workspaceId=${encodeURIComponent(workspaceId)}`, {
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Server returned ${res.status}: Failed to generate document PDF`);
  }

  return await res.blob();
}

export async function downloadDocumentPdf(
  type: 'invoice' | 'estimate' | 'creditNote' | 'payment' | 'statement',
  id: string,
  workspaceId: string,
  filename?: string
): Promise<void> {
  const toastId = toast.loading('Generating document PDF...');
  try {
    const blob = await fetchDocumentPdfBlob(type, id, workspaceId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${type}_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success('PDF downloaded successfully', { id: toastId });
  } catch (err: any) {
    toast.error(err.message || 'Failed to download PDF', { id: toastId });
  }
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  title,
  documentType,
  documentId,
  workspaceId,
  filename
}: PdfPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId || !workspaceId) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchDocumentPdfBlob(documentType, documentId, workspaceId)
      .then((blob) => {
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load PDF preview');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, documentType, documentId, workspaceId]);

  if (!isOpen) return null;

  const downloadName = filename || `${documentType}_${documentId}.pdf`;

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('PDF downloaded');
    } else {
      downloadDocumentPdf(documentType, documentId, workspaceId, downloadName);
    }
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{title}</h3>
              <p className="text-xs text-[var(--muted)] dark:text-slate-400 font-mono mt-0.5">{downloadName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <>
                <button aria-label="Open in new tab"
                  type="button"
                  onClick={handleOpenNewTab}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink aria-hidden="true" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs"
                >
                  <Download aria-hidden="true" className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-2"
              aria-label="Close"
            >
              <X aria-hidden="true" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-[550px] bg-slate-100 dark:bg-slate-950 p-4 flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-[var(--muted)]">
              <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Generating PDF document...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 max-w-md text-center p-6 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm">
              <AlertCircle aria-hidden="true" className="w-8 h-8 text-rose-500" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Unable to render PDF</p>
              <p className="text-xs text-[var(--muted)] dark:text-slate-400">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  fetchDocumentPdfBlob(documentType, documentId, workspaceId)
                    .then((blob) => {
                      const url = URL.createObjectURL(blob);
                      setBlobUrl(url);
                      setIsLoading(false);
                    })
                    .catch((err) => {
                      setError(err.message || 'Retry failed');
                      setIsLoading(false);
                    });
                }}
                className="mt-2 px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg"
              >
                Retry
              </button>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-full min-h-[550px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white shadow-inner"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
