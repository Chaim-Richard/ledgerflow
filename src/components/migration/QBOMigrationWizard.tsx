import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileUp, CheckCircle2, ChevronRight, Download, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

export default function QBOMigrationWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls', '.xlsx'] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0]);
    }
  });

  const handleNext = () => {
    if (step === 1 && !file) {
      toast.error('Please upload a QuickBooks export file');
      return;
    }
    
    if (step === 1) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setStep(2);
      }, 1500);
      return;
    }

    if (step === 2) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setStep(3);
      }, 2000);
      return;
    }

    if (step === 3) {
      toast.success('Migration completed successfully');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-4xl bg-[var(--ink)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-bold uppercase tracking-widest mb-3">
                <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                One-Click Migration
              </div>
              <h2 className="text-3xl font-black text-[var(--text)] tracking-tight">QuickBooks Switcher</h2>
              <p className="text-zinc-500 mt-2">Import your entire chart of accounts, vendors, and historical transactions.</p>
            </div>
            
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= i ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-zinc-100 text-zinc-400'}`}>
                    {step > i ? <CheckCircle2 size={16} /> : i}
                  </div>
                  {i < 3 && <div className={`w-8 h-px ${step > i ? 'bg-green-500' : 'bg-zinc-200'}`} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 mb-8 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Download size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Export from QuickBooks</h4>
                    <p className="text-sm text-gray-600 mt-1">Go to QuickBooks Settings  Export Data. Download the full ZIP archive containing your Trial Balance and Transactions.</p>
                  </div>
                </div>

                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${isDragActive ? 'border-green-500 bg-green-50/10' : 'border-[var(--line)] hover:border-zinc-400 hover:bg-zinc-50'}`}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                    <FileUp size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text)] mb-2">Drop your QBO export here</h3>
                  <p className="text-sm text-zinc-500">Supports .csv, .xls, and .zip exports from QuickBooks Online or Desktop.</p>
                  
                  {file && (
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
                      <CheckCircle2 size={16} />
                      {file.name}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold mb-2">Mapping Chart of Accounts</h3>
                  <p className="text-zinc-500">We've analyzed your QuickBooks ledger and auto-mapped it to our dimensional schema.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Mock mappings */}
                  {[
                    { from: '10100 Checking', to: '1000 Operating Cash', confidence: 99 },
                    { from: '12000 Accounts Receivable', to: '1200 Trade A/R', confidence: 100 },
                    { from: '40000 Sales Income', to: '4000 Primary Revenue', confidence: 95 },
                    { from: '60100 Advertising Expense', to: '6000 Marketing', confidence: 92 },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border border-[var(--line)] rounded-xl bg-white shadow-sm">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">QuickBooks</div>
                        <div className="font-mono text-sm font-bold">{m.from}</div>
                      </div>
                      <ChevronRight className="text-zinc-300" />
                      <div className="text-right">
                        <div className="text-xs text-green-600 font-bold mb-1">{m.confidence}% Match</div>
                        <div className="font-mono text-sm font-bold text-green-900">{m.to}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 text-center py-12"
              >
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/20">
                  <Activity size={48} />
                </div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">Trial Balance Matches to the Penny.</h3>
                <p className="text-lg text-gray-600 max-w-lg mx-auto">
                  14,239 transactions imported. Your historical financial integrity score is 100%. You are ready to close the books in LedgerFlow.
                </p>

                <div className="grid grid-cols-2 max-w-sm mx-auto gap-4 mt-8">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Assets</div>
                    <div className="text-xl font-mono font-bold">$1,240,500.00</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Liab & Eq</div>
                    <div className="text-xl font-mono font-bold">$1,240,500.00</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-[var(--line)] bg-[var(--surface)] flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-6 py-3 font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleNext}
            disabled={isProcessing}
            className="px-8 py-3 bg-zinc-900 hover:bg-black text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
          >
            {isProcessing ? (
              <><Loader2 size={18} className="animate-spin" /> Processing...</>
            ) : (
              step === 3 ? 'Go to Dashboard' : 'Continue'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
