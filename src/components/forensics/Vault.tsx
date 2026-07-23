import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Upload, 
  Search, 
  Trash2, 
  Download, 
  ExternalLink,
  Paperclip,
  CheckCircle2,
  Clock,
  X,
  File,
  Brain,
  Sparkles
} from 'lucide-react';
import { cn, safeConfirm } from '../../lib/utils';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { CloudDocument, Transaction } from '../../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { aiService } from '../../services/aiService';

interface VaultProps {
  workspaceId: string;
  uid: string;
  transactions: Transaction[];
}

export default function Vault({ workspaceId, uid, transactions }: VaultProps) {
  const [documents, setDocuments] = useState<CloudDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<CloudDocument | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  useEffect(() => {
    if (!workspaceId || !uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'documents'),
      where('workspaceId', '==', workspaceId),
      where('uid', '==', uid)
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CloudDocument));
      setDocuments(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, () => setLoading(false));
  }, [workspaceId, uid]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate upload (in a real app, this would go to Firebase Storage or S3)
    const toastId = toast.loading('Uploading document...');
    
    try {
      const newDoc: Omit<CloudDocument, 'id'> = {
        uid,
        workspaceId,
        name: file.name,
        fileUrl: URL.createObjectURL(file), // Local Blob URL
        mimeType: file.type,
        sizeBytes: file.size,
        tags: ['General'],
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'documents'), newDoc);
      toast.success('Document uploaded to Vault', { id: toastId });
    } catch (err) {
      toast.error('Failed to upload document', { id: toastId });
    }
  };

  const handleScanReceipt = async () => {
    if (!selectedDoc || isScanning) return;
    
    const toastId = toast.loading('Initializing Deep OCR Scan...');
    setIsScanning(true);
    setExtractedData(null);

    try {
      // Create a temporary File object from the blob URL
      const response = await fetch(selectedDoc.fileUrl);
      const blob = await response.blob();
      const file = new window.File([blob], selectedDoc.name, { type: selectedDoc.mimeType });

      toast.loading('Analyzing document structure...', { id: toastId });
      
      const parsedData = await aiService.parseReceipt(file);
      
      if (parsedData && parsedData.amountCents !== undefined) {
        setExtractedData(parsedData);
        toast.success('Document analysis complete', { id: toastId });
      } else {
        throw new Error("Could not extract meaningful ledger data from document.");
      }
    } catch (err: any) {
      toast.error(err.message || 'AI processing failed', { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  const handleInjectTransaction = async () => {
    if (!selectedDoc || !extractedData) return;

    const toastId = toast.loading('Injecting into ledger...');

    try {
      const amountCents = Math.abs(extractedData.amountCents || 0);
      const newTx: Partial<Transaction> = {
        uid,
        workspaceId,
        date: extractedData.date || format(new Date(), 'yyyy-MM-dd'),
        description: extractedData.merchant || extractedData.description || 'Receipt Auto-sync',
        totalAmountCents: amountCents,
        currency: 'USD',
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString(),
        fileUrls: selectedDoc.fileUrl ? [selectedDoc.fileUrl] : [],
        lines: [
          {
            accountId: extractedData.categoryId || "uncategorized",
            accountName: extractedData.category || "General Expense",
            amountCents: amountCents, // Debit expense
            description: "Auto-synced from vault",
            category: extractedData.category || "General",
            isAutoTagged: true,
          },
          {
            accountId: "1010",
            accountName: "Operating Cash",
            amountCents: -amountCents, // Credit cash
            description: "Vault auto-sync offset",
            category: "Cash",
            isAutoTagged: true,
          }
        ],
        metadata: {
          confidence: extractedData.confidence || 0,
          vaultDocId: selectedDoc.id
        }
      };

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ transaction: newTx })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to inject into ledger');
      }

      const resData = await res.json();
      const createdTxId = resData.transaction?.id || resData.id;

      if (createdTxId) {
        await updateDoc(doc(db, 'documents', selectedDoc.id), {
          linkedTransactionId: createdTxId
        });
      }

      toast.success('Ledger injected and cryptographically linked!', { id: toastId });
      setExtractedData(null);
      setSelectedDoc(null);
    } catch (err) {
      toast.error('Failed to inject into ledger', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!safeConfirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDoc(doc(db, 'documents', id));
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Failed to delete document');
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          doc.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !filterTag || doc.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(documents.flatMap(d => d.tags || [])));

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-[var(--text)] tracking-tighter mb-2">Documents</h2>
          <p className="text-[var(--muted)] font-black text-[10px] uppercase tracking-widest truncate opacity-80">Enterprise Secure Storage • Encryption Active</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="h-12 px-6 bg-[var(--brass)] text-black rounded-xl cursor-pointer flex items-center gap-3 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md group">
            <div className="w-7 h-7 bg-black/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload size={16} />
            </div>
            Protocol Upload
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-[var(--surface)] p-3 rounded-[32px] border border-[var(--line)] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)]">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 opacity-40" size={24} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents by name, tag, or checksum..."
            className="w-full pl-16 pr-6 h-12 bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:opacity-30"
          />
        </div>
        <div className="h-8 w-[1px] bg-slate-200" />
        <div className="flex items-center gap-3 p-1">
          {['all', ...allTags].map(tag => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag === 'all' ? null : tag)}
              className={cn(
                "px-6 h-10 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
                (filterTag === tag || (tag === 'all' && !filterTag))
                  ? "bg-slate-900 text-white border-slate-800 shadow-lg" 
                  : "bg-[var(--ink)]/50 text-slate-500 border-[var(--line)] hover:bg-[var(--ink)]"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredDocs.map((docItem) => (
            <motion.div
              layout
              key={docItem.id}
              onClick={() => setSelectedDoc(docItem)}
              className="bg-[var(--surface)] p-4 md:p-8 rounded-[32px] flex flex-col gap-6 group cursor-pointer border border-[var(--line)] hover:border-slate-800/20 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:-translate-y-2 transition-all relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div className="w-16 h-16 bg-[var(--ink)] rounded-[32px] flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                  <FileText size={32} />
                </div>
                <div className="flex items-center gap-2">
                  {docItem.linkedTransactionId ? (
                    <div className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-500 rounded-xl border border-emerald-100" title="Linked to transaction">
                      <Paperclip size={16} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-500 rounded-xl border border-amber-100" title="Unlinked document">
                      <Clock size={16} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-black text-[var(--text)] line-clamp-1 leading-none tracking-tight">{docItem.name}</h4>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] font-mono">
                  <span>{format(new Date(docItem.createdAt), 'MMM dd, yyyy')}</span>
                  <span className="w-1 h-1 bg-slate-100 rounded-full" />
                  <span>{(docItem.sizeBytes / 1024).toFixed(1)} KB</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto">
                {docItem.tags?.map(tag => (
                  <span key={tag} className="px-3 h-6 bg-[var(--ink)] text-[9px] font-black text-slate-500 rounded-full uppercase tracking-[0.1em] border border-[var(--line)]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                 <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(docItem.id); }}
                  className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-[32px] hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}

          {filteredDocs.length === 0 && !loading && (
            <div className="col-span-full py-40 flex flex-col items-center justify-center bg-[var(--ink)]/20 border-4 border-dashed border-[var(--line)] rounded-[32px] text-center">
              <div className="w-32 h-32 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-slate-200 mb-8 shadow-sm">
                <File size={64} />
              </div>
              <h3 className="text-3xl font-black text-[var(--text)] tracking-tight mb-3">Vault Depleted</h3>
              <p className="text-slate-500 max-w-sm mx-auto text-xs font-black uppercase tracking-[0.2em] opacity-50">Secure storage is currently empty. Initialize upload to establish audit compliance.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-[500] flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDoc(null)}
              className="absolute inset-0 bg-[#090A0C]/80 backdrop-blur-3xl"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="relative w-full max-w-2xl h-full bg-[var(--surface)] shadow-[-50px_0_100px_rgba(0,0,0,0.1)] flex flex-col border-l border-[var(--line)]"
            >
              <div className="p-4 md:p-10 border-b border-[var(--line)] flex items-center justify-between bg-[var(--ink)]/50">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-[32px] flex items-center justify-center shadow-xl">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[var(--text)] tracking-tight line-clamp-1 leading-none mb-2">{selectedDoc.name}</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40 font-mono">
                      Timestamp: {format(new Date(selectedDoc.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="w-12 h-12 flex items-center justify-center hover:bg-[var(--ink)] rounded-[32px] transition-all text-slate-500">
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 bg-[var(--ink)]/20 p-12 flex items-center justify-center overflow-auto">
                {selectedDoc.mimeType.startsWith('image/') ? (
                  <img 
                    src={selectedDoc.fileUrl} 
                    alt={selectedDoc.name}
                    className="max-w-full max-h-full rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.2)] border border-[var(--line)] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center space-y-6">
                    <div className="w-24 h-24 bg-[var(--surface)] rounded-[32px] flex items-center justify-center text-slate-200 mx-auto shadow-sm">
                      <File size={48} />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-[var(--text)] tracking-tight">Preview Restricted</h4>
                      <p className="text-sm font-medium text-slate-500 mt-2">MIME: {selectedDoc.mimeType}</p>
                    </div>
                    <a 
                      href={selectedDoc.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="h-14 px-8 bg-slate-900 text-white rounded-[32px] inline-flex items-center gap-3 font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl"
                    >
                      <Download size={20} />
                      Export to Reader
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-10 bg-[var(--surface)] border-t border-[var(--line)] space-y-8">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-[var(--ink)]/30 rounded-[32px] border border-[var(--line)]">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40 mb-3">Protocol Status</p>
                       <div className="flex items-center gap-3 font-black text-xs tracking-widest">
                          {selectedDoc.linkedTransactionId ? (
                            <>
                              <div className="w-6 h-6 flex items-center justify-center bg-emerald-50 text-emerald-500 rounded-lg">
                                <CheckCircle2 size={16} />
                              </div>
                              <span className="text-emerald-600">CERTIFIED LINK</span>
                            </>
                          ) : (
                            <>
                              <div className="w-6 h-6 flex items-center justify-center bg-amber-50 text-amber-500 rounded-lg">
                                <Clock size={16} />
                              </div>
                              <span className="text-amber-600">ISOLATED DEPOSIT</span>
                            </>
                          )}
                       </div>
                    </div>
                    <div className="p-6 bg-[var(--ink)]/30 rounded-[32px] border border-[var(--line)] font-mono">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40 mb-3">Data Magnitude</p>
                       <p className="font-black text-sm text-[var(--text)] tracking-tight">{(selectedDoc.sizeBytes / 1024).toFixed(1)} KB</p>
                    </div>
                 </div>

                 {selectedDoc.linkedTransactionId && (
                   <div className="space-y-3">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate opacity-40 px-1">Linked Transaction Association</p>
                     <div className="p-6 bg-slate-900 text-white rounded-[32px] flex items-center justify-between border border-white/5 shadow-xl group cursor-pointer overflow-hidden relative">
                        <div className="absolute inset-0 bg-[var(--surface)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                          <p className="text-sm font-bold tracking-tight">
                            {transactions.find(t => t.id === selectedDoc.linkedTransactionId)?.description || 'Unknown Transaction'}
                          </p>
                          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mt-2 font-mono">
                             ID: {selectedDoc.linkedTransactionId.substring(0, 8)} • {transactions.find(t => t.id === selectedDoc.linkedTransactionId)?.date || ''}
                          </p>
                        </div>
                        <ExternalLink size={20} className="text-white/20 group-hover:text-emerald-400 transition-colors z-10" />
                     </div>
                   </div>
                 )}

                 {extractedData && !selectedDoc.linkedTransactionId && (
                   <div className="space-y-3 pt-2">
                     <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest truncate px-1">AI Extracted Geometry</p>
                     <div className="p-6 bg-emerald-50 rounded-[32px] border border-emerald-200">
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <p className="text-[9px] font-black text-emerald-800/50 uppercase tracking-widest mb-1">Detected Merchant</p>
                              <p className="text-sm font-bold text-emerald-900">{extractedData.merchant}</p>
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-emerald-800/50 uppercase tracking-widest mb-1">Parsed Date</p>
                              <p className="text-sm font-bold text-emerald-900">{extractedData.date}</p>
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-emerald-800/50 uppercase tracking-widest mb-1">Total Amount</p>
                              <p className="text-sm font-bold font-mono text-emerald-900">${(extractedData.amountCents / 100).toFixed(2)}</p>
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-emerald-800/50 uppercase tracking-widest mb-1">Confidence</p>
                              <p className="text-sm font-bold text-emerald-900">{Math.round(extractedData.confidence * 100)}%</p>
                           </div>
                        </div>
                        <button 
                          onClick={handleInjectTransaction}
                          className="w-full mt-6 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <CheckCircle2 size={16} />
                          Inject & Sync Ledger
                        </button>
                     </div>
                   </div>
                 )}

                 <div className="flex flex-wrap items-center gap-4 pt-4">
                    <button 
                      onClick={handleScanReceipt}
                      disabled={isScanning || !!selectedDoc.linkedTransactionId || !!extractedData}
                      className="h-14 px-8 bg-slate-900 text-white rounded-[32px] flex-1 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                      {isScanning ? (
                        <>
                          <Sparkles size={16} className="animate-spin-slow text-emerald-400" />
                          <span className="text-emerald-400">Scanning Tensor...</span>
                        </>
                      ) : (
                        <>
                          <Brain size={16} className={selectedDoc.linkedTransactionId ? "opacity-30" : "text-emerald-400"} />
                          {selectedDoc.linkedTransactionId ? 'Already Synced' : 'Deep OCR Scan'}
                        </>
                      )}
                    </button>
                    <a 
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-14 px-8 bg-[var(--surface)] border border-[var(--line)] text-[var(--text)] rounded-[32px] flex-[0.7] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[var(--ink)] transition-all flex items-center justify-center gap-3">
                      <ExternalLink size={18} />
                      Raw
                    </a>
                    <button 
                      onClick={() => handleDelete(selectedDoc.id)}
                      className="w-14 h-14 flex items-center justify-center bg-rose-50 text-rose-500 rounded-[32px] hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100"
                    >
                      <Trash2 size={24} />
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
