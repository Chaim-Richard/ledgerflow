import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileUp, 
  CheckCircle2, 
  ChevronRight, 
  Download, 
  Activity, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  Table, 
  ArrowRight,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { ChartAccount, Transaction } from '../../types';
import { formatCurrency, parseLocalDate, getLocalDateISO } from '../../lib/utils';
import { resolveAccountRole } from '../../lib/accountUtils';
import { format } from 'date-fns';

interface ParsedRow {
  date: string;
  num?: string;
  payee?: string;
  memo: string;
  account: string;
  split?: string;
  debitCents: number;
  creditCents: number;
  netCents: number;
  class?: string;
  location?: string;
}

interface AccountMapping {
  qbAccount: string;
  txCount: number;
  detectedType: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  targetAccountId: string; // Existing account ID or '__create_new__'
  targetAccountName: string;
}

export default function QBOMigrationWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [accountMappings, setAccountMappings] = useState<AccountMapping[]>([]);

  const accounts = useLedgerStore(s => s.accounts) || [];
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId) || 'default';
  const user = useAuthStore(s => s.user);
  const { addEntity } = useEntityOperations();

  // Helper to parse file into rows
  const parseSpreadsheetData = (data: ArrayBuffer | string, fileName: string) => {
    try {
      const workbook = typeof data === 'string' 
        ? XLSX.read(data, { type: 'string' })
        : XLSX.read(data, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (json.length === 0) {
        toast.error('The selected file appears to be empty.');
        return;
      }

      // 1. Locate Header Row
      let headerRowIndex = -1;
      let headers: string[] = [];

      for (let r = 0; r < Math.min(json.length, 15); r++) {
        const row = json[r].map(c => String(c).trim().toLowerCase());
        const hasDate = row.some(c => c.includes('date'));
        const hasAmountOrDebit = row.some(c => c.includes('amount') || c.includes('debit') || c.includes('total') || c.includes('balance'));
        const hasAccountOrMemo = row.some(c => c.includes('account') || c.includes('memo') || c.includes('description') || c.includes('name') || c.includes('payee'));

        if (hasDate && (hasAmountOrDebit || hasAccountOrMemo)) {
          headerRowIndex = r;
          headers = row;
          break;
        }
      }

      if (headerRowIndex === -1) {
        // Default to row 0 if no clear header was detected
        headerRowIndex = 0;
        headers = json[0].map(c => String(c).trim().toLowerCase());
      }

      // Header index lookup
      const findCol = (keywords: string[]) => {
        return headers.findIndex(h => keywords.some(k => h.includes(k)));
      };

      const dateIdx = findCol(['date', 'txn date', 'tx_date']);
      const numIdx = findCol(['num', 'no.', 'ref', 'check', 'doc']);
      const payeeIdx = findCol(['name', 'payee', 'vendor', 'customer', 'entity']);
      const memoIdx = findCol(['memo', 'description', 'desc', 'line description']);
      const accountIdx = findCol(['account', 'posting account', 'bank account', 'source']);
      const splitIdx = findCol(['split', 'category', 'expense account', 'offset']);
      const debitIdx = findCol(['debit']);
      const creditIdx = findCol(['credit']);
      const amountIdx = findCol(['amount', 'total', 'net']);
      const classIdx = findCol(['class']);
      const locationIdx = findCol(['location', 'site']);

      const rows: ParsedRow[] = [];
      const accountCounts: Record<string, number> = {};

      for (let r = headerRowIndex + 1; r < json.length; r++) {
        const row = json[r];
        if (!row || row.length === 0 || row.every((c: any) => !c || String(c).trim() === '')) {
          continue;
        }

        // Parse Date using local calendar safe formatting
        const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
        let dateStr = getLocalDateISO();
        if (rawDate) {
          if (typeof rawDate === 'number') {
            // Excel serial date (days since Dec 30, 1899)
            const jsDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(jsDate.getTime())) {
              const y = jsDate.getUTCFullYear();
              const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
              const d = String(jsDate.getUTCDate()).padStart(2, '0');
              dateStr = `${y}-${m}-${d}`;
            }
          } else {
            const s = String(rawDate).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
              dateStr = s;
            } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
              const parts = s.split('/');
              const m = parts[0].padStart(2, '0');
              const d = parts[1].padStart(2, '0');
              let y = parts[2];
              if (y.length === 2) y = '20' + y;
              dateStr = `${y}-${m}-${d}`;
            } else {
              const parsed = new Date(s);
              if (!isNaN(parsed.getTime())) {
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const d = String(parsed.getDate()).padStart(2, '0');
                dateStr = `${y}-${m}-${d}`;
              }
            }
          }
        }

        const payee = payeeIdx >= 0 ? String(row[payeeIdx] || '').trim() : '';
        const memo = memoIdx >= 0 ? String(row[memoIdx] || '').trim() : (payee || 'QuickBooks Imported Transaction');
        const num = numIdx >= 0 ? String(row[numIdx] || '').trim() : undefined;
        let account = accountIdx >= 0 ? String(row[accountIdx] || '').trim() : 'Operating Cash';
        if (!account) account = 'Operating Cash';

        const split = splitIdx >= 0 ? String(row[splitIdx] || '').trim() : undefined;
        const cls = classIdx >= 0 ? String(row[classIdx] || '').trim() : undefined;
        const loc = locationIdx >= 0 ? String(row[locationIdx] || '').trim() : undefined;

        // Amounts with support for standard accounting negatives (500.00), 500.00 CR, and 500.00 DR
        let debitCents = 0;
        let creditCents = 0;

        const parseMoney = (val: any): number => {
          if (typeof val === 'number') return Math.round(val * 100);
          if (!val) return 0;
          const str = String(val).trim();
          const isParenNegative = /^\(.*\)$/.test(str);
          const isCr = /\bcr\b|cr$/i.test(str);
          const isDr = /\bdr\b|dr$/i.test(str);
          const cleaned = str.replace(/[^0-9.-]/g, '');
          const numVal = parseFloat(cleaned);
          if (isNaN(numVal)) return 0;
          let cents = Math.round(numVal * 100);
          if (isParenNegative || isCr) {
            cents = -Math.abs(cents);
          } else if (isDr) {
            cents = Math.abs(cents);
          }
          return cents;
        };

        if (debitIdx >= 0 || creditIdx >= 0) {
          debitCents = debitIdx >= 0 ? Math.abs(parseMoney(row[debitIdx])) : 0;
          creditCents = creditIdx >= 0 ? Math.abs(parseMoney(row[creditIdx])) : 0;
        } else if (amountIdx >= 0) {
          const amt = parseMoney(row[amountIdx]);
          if (amt >= 0) {
            debitCents = amt;
          } else {
            creditCents = Math.abs(amt);
          }
        } else {
          debitCents = 0;
          creditCents = 0;
        }

        if (debitCents === 0 && creditCents === 0) {
          continue; // Skip summary or total rows
        }

        const netCents = debitCents - creditCents;
        rows.push({
          date: dateStr,
          num,
          payee,
          memo,
          account,
          split,
          debitCents,
          creditCents,
          netCents,
          class: cls,
          location: loc
        });

        accountCounts[account] = (accountCounts[account] || 0) + 1;
        if (split && split !== '-Split-' && split !== account) {
          accountCounts[split] = (accountCounts[split] || 0) + 1;
        }
      }

      if (rows.length === 0) {
        toast.error('No valid transaction rows found in file.');
        return;
      }

      setParsedRows(rows);

      // 2. Generate Account Mappings
      const mappings: AccountMapping[] = Object.keys(accountCounts).map(qbAcc => {
        const lower = qbAcc.toLowerCase();
        let detectedType: 'asset' | 'liability' | 'equity' | 'income' | 'expense' = 'expense';
        if (lower.includes('cash') || lower.includes('checking') || lower.includes('bank') || lower.includes('asset') || lower.includes('receivable') || lower.includes('inventory')) {
          detectedType = 'asset';
        } else if (lower.includes('payable') || lower.includes('credit card') || lower.includes('loan') || lower.includes('tax') || lower.includes('liability')) {
          detectedType = 'liability';
        } else if (lower.includes('equity') || lower.includes('retained') || lower.includes('capital') || lower.includes('drawing')) {
          detectedType = 'equity';
        } else if (lower.includes('sales') || lower.includes('revenue') || lower.includes('income') || lower.includes('fees')) {
          detectedType = 'income';
        }

        // Try to find matching account in existing store
        const exactMatch = accounts.find(a => 
          a.name.toLowerCase() === lower || 
          lower.includes(a.name.toLowerCase()) || 
          (a.code && lower.includes(a.code.toLowerCase()))
        );

        return {
          qbAccount: qbAcc,
          txCount: accountCounts[qbAcc],
          detectedType,
          targetAccountId: exactMatch ? exactMatch.id : '__create_new__',
          targetAccountName: exactMatch ? exactMatch.name : qbAcc
        };
      });

      setAccountMappings(mappings);
      toast.success(`Parsed ${rows.length} transactions and ${mappings.length} accounts.`);
    } catch (err: any) {
      console.error('File parsing error:', err);
      toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 
      'text/csv': ['.csv'], 
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] 
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            parseSpreadsheetData(e.target.result as ArrayBuffer, selectedFile.name);
          }
        };
        reader.readAsArrayBuffer(selectedFile);
      }
    }
  });

  // Sample data generator for quick test
  const handleLoadSampleQBO = () => {
    const sampleCSV = `Date,Transaction Type,Num,Name,Memo/Description,Account,Split,Debit,Credit,Amount
2026-01-05,Check,1042,Apex Office Supplies,Desk monitors and furniture,Operating Cash,Office Expenses,,2450.00,-2450.00
2026-01-08,Deposit,DEP-01,Acme Corp,Monthly Consulting Retainer,Operating Cash,Primary Revenue,15000.00,,15000.00
2026-01-12,Bill Payment,BP-88,AWS Cloud Hosting,Monthly Cloud Cluster,Operating Cash,Hosting & Cloud Ops,,3240.50,-3240.50
2026-01-15,Deposit,DEP-02,Starlight Media,Campaign Design Project,Operating Cash,Primary Revenue,8500.00,,8500.00
2026-01-18,Expense,CC-901,Delta Airlines,Executive travel summit,Credit Card,Travel & Lodging,,1120.00,-1120.00
2026-01-22,Check,1043,WeWork Global,Office rent Q1,Operating Cash,Rent & Facilities,,4500.00,-4500.00
2026-01-25,Deposit,DEP-03,Vortex AI,Algorithm License,Operating Cash,Software Licenses,12000.00,,12000.00
2026-01-28,Expense,CC-902,Google Ads,Search engine acquisition,Credit Card,Marketing,,2800.00,-2800.00
2026-02-02,Deposit,DEP-04,Summit Partners,Quarterly Advisory,Operating Cash,Primary Revenue,18000.00,,18000.00
2026-02-08,Check,1044,Gusto Payroll,Bi-weekly payroll settlement,Operating Cash,Payroll & Salaries,,9800.00,-9800.00`;

    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const sampleFile = new File([blob], 'QuickBooks_General_Ledger_Export.csv', { type: 'text/csv' });
    setFile(sampleFile);
    parseSpreadsheetData(sampleCSV, sampleFile.name);
  };

  // Summary Metrics for Step 3
  const metrics = useMemo(() => {
    let totalDebitCents = 0;
    let totalCreditCents = 0;
    parsedRows.forEach(r => {
      totalDebitCents += r.debitCents;
      totalCreditCents += r.creditCents;
    });

    return {
      txCount: parsedRows.length,
      accountCount: accountMappings.length,
      totalDebitCents,
      totalCreditCents,
      netCents: totalDebitCents - totalCreditCents,
      isBalanced: Math.abs(totalDebitCents - totalCreditCents) === 0
    };
  }, [parsedRows, accountMappings]);

  const handleNext = async () => {
    if (step === 1) {
      if (parsedRows.length === 0) {
        toast.error('Please upload a valid QuickBooks export or use the sample file.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      setIsProcessing(true);
      try {
        // 1. Create missing accounts in chartAccounts with type-based GAAP numbering
        const createdAccountMap: Record<string, string> = {};
        const updatedAccounts = [...accounts];
        const assignedCodes = new Set<string>();

        const getNextCode = (type: string): string => {
          let base = 5000;
          if (type === 'asset') base = 1000;
          else if (type === 'liability') base = 2000;
          else if (type === 'equity') base = 3000;
          else if (type === 'income') base = 4000;
          else base = 5000;

          const used = new Set(
            updatedAccounts
              .map(a => parseInt(a.code, 10))
              .concat(Array.from(assignedCodes).map(c => parseInt(c, 10)))
              .filter(n => !isNaN(n))
          );
          let candidate = base;
          while (used.has(candidate)) {
            candidate += 10;
          }
          assignedCodes.add(String(candidate));
          return String(candidate);
        };

        for (const mapping of accountMappings) {
          if (mapping.targetAccountId === '__create_new__') {
            const newAccCode = getNextCode(mapping.detectedType);
            const newAcc: Omit<ChartAccount, 'id'> = {
              uid: user?.uid || 'system',
              workspaceId: currentWorkspaceId,
              code: newAccCode,
              name: mapping.qbAccount,
              type: mapping.detectedType,
              balanceCents: 0
            };
            const created = await addEntity('chartAccounts', newAcc);
            if (created && created.id) {
              createdAccountMap[mapping.qbAccount] = created.id;
              updatedAccounts.push({ ...newAcc, id: created.id } as ChartAccount);
            }
          } else {
            createdAccountMap[mapping.qbAccount] = mapping.targetAccountId;
          }
        }

        // Cache fallback accounts for split offsets
        const cashAccount = updatedAccounts.find(a => resolveAccountRole(a) === 'cash') || 
          updatedAccounts.find(a => a.type === 'asset') || 
          updatedAccounts[0];
        const defaultRevenueAccount = updatedAccounts.find(a => resolveAccountRole(a) === 'revenue') ||
          updatedAccounts.find(a => a.type === 'income');
        const defaultExpenseAccount = updatedAccounts.find(a => resolveAccountRole(a) === 'expense') ||
          updatedAccounts.find(a => a.type === 'expense');

        // 2. Prepare atomic double-entry transactions
        const txList: any[] = [];

        for (const row of parsedRows) {
          const primaryAccId = createdAccountMap[row.account] || cashAccount?.id || updatedAccounts[0]?.id || '';
          const primaryAcc = updatedAccounts.find(a => a.id === primaryAccId);
          const primaryAccName = primaryAcc?.name || row.account;

          let splitAccId = row.split && createdAccountMap[row.split] ? createdAccountMap[row.split] : undefined;

          // Prevent self-canceling lines: if split is undefined or matches primary account, resolve offset via role
          if (!splitAccId || splitAccId === primaryAccId) {
            const primaryRole = resolveAccountRole(primaryAcc);
            if (primaryRole === 'cash' || primaryAcc?.type === 'asset') {
              splitAccId = row.netCents >= 0 
                ? (defaultRevenueAccount?.id || primaryAccId) 
                : (defaultExpenseAccount?.id || primaryAccId);
            } else if (primaryRole === 'revenue' || primaryAcc?.type === 'income') {
              splitAccId = cashAccount?.id || primaryAccId;
            } else {
              splitAccId = cashAccount?.id || primaryAccId;
            }
          }

          const splitAcc = updatedAccounts.find(a => a.id === splitAccId);
          const splitAccName = splitAcc?.name || row.split || 'Uncategorized Offset';

          const totalAmount = Math.max(row.debitCents, row.creditCents);
          const primaryAmt = row.netCents >= 0 ? row.debitCents : -row.creditCents;
          const splitAmt = -primaryAmt;

          const lines = [
            {
              accountId: primaryAccId,
              accountName: primaryAccName,
              amountCents: primaryAmt,
              description: row.memo
            },
            {
              accountId: splitAccId,
              accountName: splitAccName,
              amountCents: splitAmt,
              description: row.memo
            }
          ];

          const newTx = {
            id: `tx-qbo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            uid: user?.uid || 'system',
            workspaceId: currentWorkspaceId,
            date: row.date,
            description: row.memo || 'QuickBooks Import',
            payee: row.payee,
            totalAmountCents: totalAmount,
            currency: 'USD',
            status: 'completed',
            type: 'actual',
            lines,
            classId: row.class,
            locationId: row.location,
            createdAt: new Date().toISOString(),
            metadata: {
              importedFrom: 'quickbooks',
              originalRef: row.num
            }
          };

          txList.push(newTx);
        }

        // 3. Batch import via API endpoint with chunking
        const token = await user?.getIdToken();
        const BATCH_SIZE = 50;

        for (let i = 0; i < txList.length; i += BATCH_SIZE) {
          const chunk = txList.slice(i, i + BATCH_SIZE);
          let posted = false;

          if (token) {
            try {
              const res = await fetch('/api/v1/transactions/bulk', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  transactions: chunk,
                  workspaceId: currentWorkspaceId
                })
              });
              if (res.ok) {
                posted = true;
              }
            } catch (postErr) {
              console.warn('Bulk API write deferred to client fallback', postErr);
            }
          }

          if (!posted) {
            for (const tx of chunk) {
              await addEntity('transactions', tx);
            }
          }
        }

        toast.success(`Successfully migrated ${parsedRows.length} transactions into LedgerFlow!`);
        setIsProcessing(false);
        onClose();
      } catch (err: any) {
        console.error('Migration commit error:', err);
        toast.error('Failed to commit migration: ' + (err.message || 'Unknown error'));
        setIsProcessing(false);
      }
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
        className="relative w-full max-w-4xl bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-widest mb-2">
                <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                QuickBooks Migration Engine
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[var(--text)] tracking-tight">QuickBooks Switcher</h2>
              <p className="text-sm text-[var(--muted)] mt-1">Import your historical general ledger, chart of accounts, and transactions with double-entry integrity.</p>
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-center">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step >= i ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>
                    {step > i ? <CheckCircle2 size={16} /> : i}
                  </div>
                  {i < 3 && <div className={`w-6 h-0.5 ${step > i ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                    <Download size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-[var(--text)] text-sm">QuickBooks Export Instructions</h4>
                    <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                      In QuickBooks Online or Desktop, navigate to <strong>Reports &rarr; General Ledger / Transaction Detail</strong> or <strong>Chart of Accounts</strong>. Export as <strong>.CSV</strong> or <strong>.XLSX</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSampleQBO}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                   aria-label="Try with Sample Export">
                    <Sparkles size={14} /> Try with Sample Export
                  </button>
                </div>

                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                    isDragActive ? 'border-emerald-500 bg-emerald-50/10' : 'border-[var(--line)] hover:border-indigo-400 hover:bg-slate-50/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <FileUp size={32} />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text)] mb-1">
                    {file ? file.name : 'Drop your QuickBooks file here, or browse'}
                  </h3>
                  <p className="text-xs text-[var(--muted)]">Supports .csv, .xlsx, and .xls exports.</p>
                  
                  {file && (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold border border-emerald-500/20">
                      <CheckCircle2 size={14} />
                      {parsedRows.length} transactions parsed ready for mapping
                    </div>
                  )}
                </div>

                {parsedRows.length > 0 && (
                  <div className="p-4 bg-[var(--panel)] rounded-xl border border-[var(--line)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Preview of Parsed Data (First 3 Records)</span>
                      <span className="text-xs font-mono font-bold text-indigo-600">{parsedRows.length} Total Rows</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                            <th className="p-2 font-semibold">Date</th>
                            <th className="p-2 font-semibold">Payee/Memo</th>
                            <th className="p-2 font-semibold">Source Account</th>
                            <th className="p-2 font-semibold">Split</th>
                            <th className="p-2 font-semibold text-right">Debit ($)</th>
                            <th className="p-2 font-semibold text-right">Credit ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)]">
                          {parsedRows.slice(0, 3).map((r, i) => (
                            <tr key={i}>
                              <td className="p-2 font-mono">{r.date}</td>
                              <td className="p-2 truncate max-w-[200px]">{r.payee || r.memo}</td>
                              <td className="p-2 font-medium">{r.account}</td>
                              <td className="p-2 text-[var(--muted)]">{r.split || '—'}</td>
                              <td className="p-2 text-right font-mono">{r.debitCents > 0 ? (r.debitCents / 100).toFixed(2) : '—'}</td>
                              <td className="p-2 text-right font-mono">{r.creditCents > 0 ? (r.creditCents / 100).toFixed(2) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-bold text-[var(--text)]">Chart of Accounts Mapping</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Match accounts from your QuickBooks export to your LedgerFlow Chart of Accounts.
                  </p>
                </div>

                <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--panel)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]">
                        <th className="p-3 font-bold uppercase tracking-wider">QuickBooks Account</th>
                        <th className="p-3 font-bold uppercase tracking-wider">Category Type</th>
                        <th className="p-3 font-bold uppercase tracking-wider text-center">Tx Count</th>
                        <th className="p-3 font-bold uppercase tracking-wider">Target LedgerFlow Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {accountMappings.map((m, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface)] transition-colors">
                          <td className="p-3 font-bold text-[var(--text)]">
                            {m.qbAccount}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {m.detectedType}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-[var(--muted)]">
                            {m.txCount}
                          </td>
                          <td className="p-3">
                            <select
                              value={m.targetAccountId}
                              onChange={(e) => {
                                const newMappings = [...accountMappings];
                                newMappings[idx].targetAccountId = e.target.value;
                                setAccountMappings(newMappings);
                              }}
                              className="w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-1.5 text-xs text-[var(--text)] focus:outline-none focus:border-indigo-500 font-medium"
                            >
                              <option value="__create_new__">+ Create New Account ({m.qbAccount})</option>
                              <optgroup label="Existing Accounts">
                                {accounts.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.code ? `[${a.code}] ` : ''}{a.name} ({a.type})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 text-center py-4"
              >
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <Activity size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Integrity Verification Complete</h3>
                  <p className="text-sm text-[var(--muted)] max-w-md mx-auto mt-1">
                    We parsed <strong>{metrics.txCount} transactions</strong> spanning <strong>{metrics.accountCount} accounts</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 max-w-lg mx-auto gap-3 text-left">
                  <div className="p-4 bg-[var(--panel)] rounded-xl border border-[var(--line)]">
                    <div className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Total Debits</div>
                    <div className="text-lg font-mono font-bold text-[var(--text)]">
                      {formatCurrency(metrics.totalDebitCents)}
                    </div>
                  </div>
                  <div className="p-4 bg-[var(--panel)] rounded-xl border border-[var(--line)]">
                    <div className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Total Credits</div>
                    <div className="text-lg font-mono font-bold text-[var(--text)]">
                      {formatCurrency(metrics.totalCreditCents)}
                    </div>
                  </div>
                  <div className="p-4 bg-[var(--panel)] rounded-xl border border-[var(--line)]">
                    <div className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider mb-1">Trial Balance Net</div>
                    <div className={`text-lg font-mono font-bold ${metrics.isBalanced ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {formatCurrency(metrics.netCents)}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl max-w-lg mx-auto text-left flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs text-[var(--text)] font-medium">
                    Ready to commit transactions into the double-entry matrix. Historical balances will synchronize automatically.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Controls */}
        <div className="p-5 border-t border-[var(--line)] bg-[var(--panel)] flex justify-between items-center">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="px-5 py-2.5 font-bold text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          <button
            type="button"
            onClick={handleNext}
            disabled={isProcessing || (step === 1 && parsedRows.length === 0)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
           aria-label="Loader2 action">
            {isProcessing ? (
              <><Loader2 size={16} className="animate-spin" /> Importing Transactions...</>
            ) : (
              step === 3 ? 'Commit & Import to Ledger' : 'Continue'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
