import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Transaction, ChartAccount } from '../../types';
import { cn, reportError, OperationType } from '../../lib/utils';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db, getIdToken } from '../../firebase';
import { MatchingEngine } from '../../lib/MatchingEngine';

interface BankFeedImportProps {
  workspaceId: string;
  accounts: ChartAccount[];
  onImport: (transactions: Partial<Transaction>[]) => void;
  onClose: () => void;
}

const BankFeedImport: React.FC<BankFeedImportProps> = ({
  workspaceId,
  accounts,
  onImport,
  onClose
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [mappedTransactions, setMappedTransactions] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const { user, userProfile } = useAuthStore();
  const matchingThreshold = useLedgerStore(state => state.matchingThreshold);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const handleUpload = async () => {
    if (!file || !user) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', workspaceId);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/upload-bank-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRawTransactions(data);
      handleAutoMap(data);
    } catch (err) {
      reportError(err, OperationType.SYNC, 'bank_upload', { fileName: file.name });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAutoMap = async (transactions: any[]) => {
    if (!user) return;
    setIsMapping(true);
    try {
      // Fetch automated rules for local deterministic evaluation
      const qRules = query(
        collection(db, 'autoRules'),
        where('workspaceId', '==', workspaceId),
        where('uid', '==', user.uid)
      );
      const rulesSnap = await getDocs(qRules);
      const activeRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Fetch sample historical fields to train dynamic Bayesian auto-learner
      const qHistory = query(
        collection(db, 'transactions'),
        where('workspaceId', '==', workspaceId),
        where('uid', '==', user.uid),
        limit(1000)
      );
      const historySnap = await getDocs(qHistory);
      const historicalTxs = historySnap.docs.map(d => d.data() as Transaction);

      const localEngine = new MatchingEngine(activeRules, {}, '', Math.max(0.5, matchingThreshold - 0.03), historicalTxs);

      const resolvedBatch: any[] = [];
      const outstandingForAI: any[] = [];

      for (const t of transactions) {
        // Step A: Check if Excel/CSV row already contains a pre-labeled category! (Bypass of AI)
        if (t.category && typeof t.category === 'string' && t.category.trim().length > 0) {
          const rawCat = t.category.trim().toLowerCase();
          
          // Try to map exactly to account name or account code
          const matchedAcct = accounts.find(a => 
            a.name.toLowerCase() === rawCat || 
            a.code === rawCat ||
            a.name.toLowerCase().includes(rawCat)
          );

          if (matchedAcct) {
            resolvedBatch.push({
              ...t,
              accountId: matchedAcct.id,
              category: matchedAcct.name,
              confidence: 1.0,
              matchSource: 'Excel/CSV Labeled'
            });
            continue;
          }
        }

        // Step B: Match with high-efficiency local rule engine OR dynamic Bayesian classification
        const result = localEngine.resolveCategory(t.description);
        if (result && result.accountName !== 'Manual Review') {
          const matchedAcct = accounts.find(a => a.name === result.accountName);
          if (matchedAcct) {
            const dbg = localEngine.debugResolveCategory(t.description);
            const source = dbg.layer.includes('Rule:') ? 'Local Rule Machine' : 'Dynamic Auto-Learner';
            resolvedBatch.push({
              ...t,
              accountId: matchedAcct.id,
              category: matchedAcct.name,
              confidence: Number(dbg.confidence?.toFixed(2)) || 0.95,
              matchSource: source
            });
            continue;
          }
        }

        // Step C: Otherwise, delegate to external analysis
        outstandingForAI.push(t);
      }

      // Step C: Process remaining using fast mathematical model fallback (Bypassing LLMs for speed and strict deterministic mapping)
      let aiMapped: any[] = [];
      if (outstandingForAI.length > 0) {
        outstandingForAI.forEach(t => {
          const fallbackResult = localEngine.resolveCategory(t.description);
          // If the fallback engine resolves exactly to "Manual Review", let it stay as Uncategorized for manual review, otherwise map it
          const matchedAcct = 
            (fallbackResult && fallbackResult.accountName !== 'Manual Review') 
              ? accounts.find(a => a.name === fallbackResult.accountName) 
              : null;
          
          if (matchedAcct) {
            const dbg = localEngine.debugResolveCategory(t.description);
            aiMapped.push({
              id: t.id,
              accountId: matchedAcct.id,
              category: matchedAcct.name,
              confidence: Number(dbg.confidence?.toFixed(2)) || 0.65,
              matchSource: dbg.layer || 'Fast Math Model Fallback'
            });
          } else {
            // Put it into Manual Review
            const uncatAcc = accounts.find(a => a.name === 'Uncategorized');
            aiMapped.push({
              id: t.id,
              accountId: uncatAcc?.id || 'unassigned',
              category: uncatAcc?.name || 'Uncategorized',
              confidence: 0,
              matchSource: 'Classification Insufficient - Manual Review'
            });
          }
        });
      }

      // Combine direct matches with AI/fallback mappings
      const combined = transactions.map(t => {
        const resolvedDirect = resolvedBatch.find(m => m.id === t.id);
        if (resolvedDirect) return resolvedDirect;

        const resolvedAI = aiMapped.find(m => m.id === t.id);
        return { ...t, ...resolvedAI };
      });

      setMappedTransactions(combined);
      setSelectedIndices(new Set(combined.keys()));
    } catch (err) {
      reportError(err, OperationType.SYNC, 'bank_auto_map');
    } finally {
      setIsMapping(false);
    }
  };

  const handleConfirm = () => {
    if (!user) return;
    const toImport = mappedTransactions
      .filter((_, idx) => selectedIndices.has(idx))
      .map(t => {
        const accountId = t.accountId || 'uncategorized';
        const account = accounts.find(a => a.id === accountId);
        
        return {
          uid: user.uid,
          workspaceId,
          date: t.date,
          description: t.description,
          totalAmountCents: t.amountCents,
          type: 'actual' as const,
          status: 'completed' as const,
          isCleared: true,
          lines: [
            {
              accountId: accountId,
              accountName: account?.name || 'Uncategorized',
              amountCents: t.amountCents // For imported expenses, assume debit for the category
            },
            {
              accountId: 'offset-bank', // In a real app, this would be the bank account selected
              accountName: 'Bank Account (Imported)',
              amountCents: -t.amountCents
            }
          ],
          createdAt: new Date().toISOString()
        };
      });
    
    onImport(toImport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-50 rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90dvh] flex flex-col overflow-hidden border border-slate-200"
      >
        <div className="p-4 md:p-8 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Bank Feed Ingestion</h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 opacity-40">Neural CSV parsing & topological mapping</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-50 hover:bg-slate-200 rounded-[32px] flex items-center justify-center text-slate-500 transition-all">
            <AlertCircle className="rotate-45" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
          {!rawTransactions.length ? (
            <div 
              {...getRootProps()} 
              className={cn(
                "border-2 border-dashed rounded-[32px] p-20 flex flex-col items-center justify-center transition-all cursor-pointer group",
                isDragActive ? "border-indigo-600 bg-indigo-600/5" : "border-slate-200 hover:border-indigo-600/30 hover:bg-slate-50/20"
              )}
            >
              <input {...getInputProps()} />
              <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mb-8 border border-slate-200 group-hover:scale-110 transition-transform">
                <Upload className={cn("text-slate-500 group-hover:text-indigo-600 transition-colors", isDragActive && "text-indigo-600")} size={40} />
              </div>
              {file ? (
                <div className="text-center">
                  <p className="text-lg font-black text-slate-900 italic uppercase tracking-tight">{file.name}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{(file.size / 1024).toFixed(1)} KB DATA PACKET</p>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    disabled={isUploading}
                    className="mt-10 px-10 py-3 bg-indigo-600 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-ledger-accent/20"
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
                    Initialize Upload
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Deploy Ledger Source</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2 opacity-40">Drop CSV or click to browse system</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    {isMapping ? "Neural categorizer active..." : `${mappedTransactions.length} NODES DETECTED`}
                  </p>
                </div>
                {!isMapping && (
                  <button 
                    onClick={() => setSelectedIndices(new Set(mappedTransactions.keys()))}
                    className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em] hover:underline"
                  >
                    Mark All Nodes
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-[32px] overflow-hidden bg-white/50">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="px-6 py-4 w-12"></th>
                      <th className="px-4 py-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Timestamp</th>
                      <th className="px-4 py-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Description</th>
                      <th className="px-4 py-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Quantum</th>
                      <th className="px-4 py-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">AI Topology Hint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ledger-line/50">
                    {mappedTransactions.map((tx, idx) => (
                      <tr key={tx.id} className={cn("hover:bg-slate-50/30 transition-all group", !selectedIndices.has(idx) && "opacity-30")}>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => {
                              const next = new Set(selectedIndices);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              setSelectedIndices(next);
                            }}
                            className={cn(
                              "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                              selectedIndices.has(idx) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 bg-slate-50"
                            )}
                          >
                            {selectedIndices.has(idx) && <Check size={14} />}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-[11px] font-mono font-bold text-slate-500">{tx.date}</td>
                        <td className="px-4 py-4 font-black text-slate-900 italic uppercase tracking-tight text-xs">{tx.description}</td>
                        <td className="px-4 py-4 font-mono font-black text-slate-900 text-sm">
                          {(tx.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </td>
                        <td className="px-4 py-4">
                          {isMapping ? (
                            <div className="h-2 w-24 bg-slate-50 animate-pulse rounded-full" />
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-indigo-600/10 text-indigo-600 border border-indigo-600/20 rounded-lg text-[9px] font-medium uppercase tracking-wider">
                                  {tx.category || 'PENDING'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500/40 font-bold uppercase tracking-tighter">
                                  {Math.round((tx.confidence || 0) * 100)}% Match
                                </span>
                              </div>
                              {tx.matchSource && (
                                <span className="text-[8px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-black italic mt-0.5">
                                  {tx.matchSource}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 md:p-8 border-t border-slate-200 flex items-center justify-end gap-5 bg-slate-50/20">
          <button onClick={onClose} className="px-8 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-slate-900 transition-all">
            Abort Mission
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedIndices.size || isMapping}
            className="px-10 py-3 bg-indigo-600 text-white rounded-[32px] font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-ledger-accent/20"
          >
            Import {selectedIndices.size} Vectors
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BankFeedImport;
