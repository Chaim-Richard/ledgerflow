import React, { useState } from 'react';
import { parseNaturalLanguageEntry } from '../../lib/algorithms/nl-parser';
import { Check, Wand2, Receipt, Camera, X } from 'lucide-react';
import { parseReceiptOCR } from '../../lib/algorithms/receipt-capture';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { toast } from 'sonner';

export default function MagicEntry({ isOpen, onClose, onAdd }: any) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<any>(null);
  const [receiptMode, setReceiptMode] = useState(false);
  const { handleQuickAdd } = useTransactionActions();

  // If isOpen is provided and is false, don't render. If undefined, render full page.
  if (isOpen === false) return null;
  const isModal = isOpen !== undefined;

  const handleParse = (val: string) => {
    setText(val);
    if (val.length > 5) {
      const result = parseNaturalLanguageEntry(val);
      setParsed(result);
    } else {
      setParsed(null);
    }
  };

  const handleSimulateReceipt = () => {
    const mockOCR = [
        "HOME DEPOT 123",
        "04/15/2026 14:23",
        "HAMMER      12.99",
        "SUBTOTAL    12.99",
        "TAX          1.52",
        "TOTAL      $14.51",
        "VISA **** 1234"
    ];
    const result = parseReceiptOCR(mockOCR, ['Home Depot', 'Staples']);
    setParsed({
      action: 'expense',
      amount: result.totalCents,
      description: result.merchant,
      method: 'Card',
      dateStr: result.dateStr || new Date().toISOString().split('T')[0]
    });
    setReceiptMode(true);
    setText('Snapped: Home Depot receipt');
  };

  const handleSave = async () => {
    if (!parsed) return;
    if (onAdd) {
       onAdd({
         description: parsed.description,
         amount: parsed.amount,
         date: parsed.dateStr,
         type: parsed.action
       });
    } else {
       await handleQuickAdd({
         description: parsed.description || 'Natural Language Entry',
         totalAmountCents: parsed.amount,
         date: parsed.dateStr || new Date().toISOString().split('T')[0],
         type: parsed.action || 'expense',
         lines: [{
           accountId: 'uncategorized',
           accountName: parsed.description || 'General',
           amountCents: parsed.action === 'expense' ? -Math.abs(parsed.amount) : Math.abs(parsed.amount)
         }]
       });
       toast.success('Transaction saved to General Ledger!');
    }
    setText('');
    setParsed(null);
    setReceiptMode(false);
    if (onClose) onClose();
  };

  const content = (
    <div className="p-6 space-y-6">
      <div className="relative">
        <input 
          autoFocus
          className="w-full text-lg py-6 pl-12 pr-32 rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brass)] focus:border-[var(--brass)] placeholder:text-[var(--faint)]"
          placeholder="e.g., paid $40 gas cash yesterday"
          value={text}
          onChange={(e) => handleParse(e.target.value)}
        />
        <Wand2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--brass)] w-5 h-5" />
        <button 
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--elevated)] px-3 py-2 rounded-lg font-medium text-sm flex items-center transition-colors"
          onClick={handleSimulateReceipt}
        >
          <Camera className="w-4 h-4 mr-2" /> Snap Receipt
        </button>
      </div>

      {parsed && (
        <div className="mt-8 bg-[var(--panel)] border border-[var(--line)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">We understood:</h3>
          <div className="grid grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-xs text-[var(--faint)] mb-1">Amount</p>
              <p className={`text-xl font-bold ${parsed.action === 'expense' ? 'text-[var(--neg)]' : 'text-[var(--pos)]'}`}>
                ${Math.abs(parsed.amount / 100).toFixed(2)} {parsed.action === 'expense' ? 'Out' : 'In'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--faint)] mb-1">Method</p>
              <p className="text-lg font-medium text-[var(--text)]">{parsed.method}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--faint)] mb-1">Description / Category</p>
              <p className="text-lg font-medium text-[var(--text)] capitalize">{parsed.description || 'General'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--faint)] mb-1">Date</p>
              <p className="text-lg font-medium text-[var(--text)]">{parsed.dateStr}</p>
            </div>
          </div>
          
          <button 
            className="w-full mt-6 bg-[var(--brass)] text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-opacity hover:opacity-90 shadow-md"
            onClick={handleSave}
          >
            <Check className="w-4 h-4 mr-2" /> Looks Right - Save It
          </button>
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 justify-center pt-4">
        <span className="text-xs text-[var(--muted)]">Try typing:</span>
        <span className="text-xs bg-[var(--surface)] text-[var(--text)] px-2 py-0.5 rounded cursor-pointer hover:bg-[var(--elevated)]" onClick={() => handleParse("earned $1500 client retainer check today")}>earned $1500 client retainer check today</span>
        <span className="text-xs bg-[var(--surface)] text-[var(--text)] px-2 py-0.5 rounded cursor-pointer hover:bg-[var(--elevated)]" onClick={() => handleParse("paid $80 lunch card yesterday")}>paid $80 lunch card yesterday</span>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[var(--ink)]/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-[var(--surface)] rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-[var(--line)]">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Magic Entry</h2>
              <p className="text-[var(--muted)]">Just type what happened. No debit/credit knowledge required.</p>
            </div>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-[var(--muted)]">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {content}
        </div>
      </div>
    );
  }

  // Full page view
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Magic Entry</h1>
        <p className="text-[var(--muted)]">Just type what happened. No debit/credit knowledge required.</p>
      </div>
      <div className="bg-[var(--panel)] rounded-2xl shadow-sm border border-[var(--line)] overflow-hidden">
        {content}
      </div>
    </div>
  );
}
