import React from 'react';
import { motion } from 'motion/react';
import { FileText, CheckCircle2, ArrowRight, Tag, DollarSign, Calendar, Building2, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DocumentEntanglementProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl?: string;
  parsedData?: {
    vendorName: string;
    date: string;
    totalAmountCents: number;
    taxAmountCents: number;
    currency: string;
    lineItems: Array<{
      description: string;
      amountCents: number;
      categorySuggestion: string;
    }>;
    confidenceScore: number;
  };
  onVerify: () => void;
}

export default function DocumentEntanglement({ isOpen, onClose, receiptUrl, parsedData, onVerify }: DocumentEntanglementProps) {
  if (!isOpen) return null;
  if (!parsedData) return null;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: parsedData.currency || 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-4 md:p-10">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--ink)]/80 backdrop-blur-xl"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        className="relative w-full max-w-7xl h-[85dvh] bg-[var(--surface)] rounded-[48px] shadow-2xl border border-[var(--line)] overflow-hidden flex flex-col md:flex-row"
      >
        {/* Left Side: Receipt Image */}
        <div className="flex-1 bg-[var(--surface)] relative overflow-hidden flex items-center justify-center p-4 md:p-8">
          {receiptUrl ? (
            <img 
              src={receiptUrl} 
              alt="Receipt" 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-[var(--faint)]">
              <FileText size={64} strokeWidth={1} />
              <p className="font-bold">No Image Available</p>
            </div>
          )}
          
          <div className="absolute top-8 left-8 bg-[var(--ink)]/80 backdrop-blur-md text-[var(--panel)] px-4 py-2 rounded-full text-xs font-medium uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Original Document
          </div>
        </div>

        {/* Right Side: AI Verification */}
        <div className="w-full md:w-[480px] flex flex-col bg-[var(--surface)] border-l border-[var(--line)]">
          <div className="p-4 md:p-10 border-b border-zinc-50">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--ink)] rounded-xl flex items-center justify-center text-[var(--panel)]">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-2xl font-black text-[var(--text)] tracking-tight">AI Verification</h2>
              </div>
              <div className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wider border",
                parsedData.confidenceScore > 0.9 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
              )}>
                {Math.round(parsedData.confidenceScore * 100)}% Confidence
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-[var(--ink)] rounded-xl border border-[var(--line)]">
                <Building2 className="text-[var(--faint)]" size={20} />
                <div>
                  <p className="text-[10px] font-bold text-[var(--faint)] uppercase tracking-widest">Vendor</p>
                  <p className="font-bold text-[var(--text)]">{parsedData.vendorName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 bg-[var(--ink)] rounded-xl border border-[var(--line)]">
                  <Calendar className="text-[var(--faint)]" size={20} />
                  <div>
                    <p className="text-[10px] font-bold text-[var(--faint)] uppercase tracking-widest">Date</p>
                    <p className="font-bold text-[var(--text)]">{parsedData.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-[var(--ink)] rounded-xl border border-[var(--line)]">
                  <DollarSign className="text-[var(--faint)]" size={20} />
                  <div>
                    <p className="text-[10px] font-bold text-[var(--faint)] uppercase tracking-widest">Total</p>
                    <p className="font-bold text-[var(--text)]">{formatCurrency(parsedData.totalAmountCents)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6">
            <h3 className="text-xs font-black text-[var(--faint)] uppercase tracking-widest">Line Item Splits</h3>
            <div className="space-y-3">
              {parsedData.lineItems.map((item, idx) => (
                <div key={idx} className="group p-4 bg-[var(--panel)] rounded-2xl hover:border-zinc-900 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-[var(--text)] text-sm leading-tight">{item.description}</p>
                    <p className="font-mono font-bold text-[var(--text)]">{formatCurrency(item.amountCents)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-[var(--faint)]" />
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">{item.categorySuggestion}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Tax Detected</span>
              </div>
              <p className="text-sm text-emerald-800 font-medium">
                AI identified {formatCurrency(parsedData.taxAmountCents)} in sales tax. A tax split will be automatically generated.
              </p>
            </div>
          </div>

          <div className="p-4 md:p-10 bg-[var(--ink)] border-t border-[var(--line)] flex gap-4">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-[var(--panel)] text-[var(--text)] rounded-2xl font-black hover:bg-[var(--surface)] transition-all border border-[var(--line)]"
            >
              Reject
            </button>
            <button 
              onClick={onVerify}
              className="flex-1 py-4 bg-[var(--ink)] text-[var(--panel)] rounded-xl font-black hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 flex items-center justify-center gap-2"
            >
              Commit to Ledger
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
