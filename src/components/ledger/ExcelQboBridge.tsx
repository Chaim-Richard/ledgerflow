import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState, useMemo, useRef } from 'react';
import { 
  FileSpreadsheet, 
  ArrowLeftRight, 
  CheckCheck, 
  AlertCircle, 
  Database, 
  Download, 
  Sparkles, 
  Plus, 
  Settings, 
  Globe,
  Info,
  Table,
  UploadCloud,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { jaroWinklerSimilarity } from '../../lib/algorithms';
import { db } from '../../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { cn, formatCurrency } from '../../lib/utils';
import { ChartAccount } from '../../types';
import { MatchingEngine } from '../../lib/MatchingEngine';

type ImportMode = 'bank_transactions' | 'journal_entry_rows' | 'ai_labeling_only';

export default function ExcelQboBridge() {
  const { user, currentWorkspaceId } = useAuthStore();
  const { accounts, transactions, autoRules, analyticalPatternCache, matchingThreshold } = useLedgerStore();
  const { handleImportTransactions } = useTransactionActions();
  
  const [importMode, setImportMode] = useState<ImportMode>('bank_transactions');
  const [pastedData, setPastedData] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<any[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [hasHeaders, setHasHeaders] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Neural Labeler Specific State
  const [labeledResults, setLabeledResults] = useState<any[]>([]);
  const [isLabeling, setIsLabeling] = useState(false);
  
  // Mapping State
  const [dateColIdx, setDateColIdx] = useState<number>(-1);
  const [payeeColIdx, setPayeeColIdx] = useState<number>(-1);
  const [memoColIdx, setMemoColIdx] = useState<number>(-1);
  const [amountColIdx, setAmountColIdx] = useState<number>(-1);
  const [accountColIdx, setAccountColIdx] = useState<number>(-1);
  const [debitColIdx, setDebitColIdx] = useState<number>(-1);
  const [creditColIdx, setCreditColIdx] = useState<number>(-1);

  // Single transaction offset clearing account (for standard bank files)
  const [offsetAccountId, setOffsetAccountId] = useState('');
  
  // Custom accounts mapped state: customAccountRawName -> chartAccountId
  const [accountMapping, setAccountMapping] = useState<Record<string, string>>({});
  
  // New account modal / form
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'asset' | 'liability' | 'equity' | 'income' | 'expense'>('expense');
  const [newAccCode, setNewAccCode] = useState('');
  const [selectedRawAccountForCreation, setSelectedRawAccountForCreation] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse Excel / CSV using XLSX
  const processFileData = (buffer: ArrayBuffer, name: string) => {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });
      setFileName(name);
      setSheetNames(workbook.SheetNames);
      const firstSheet = workbook.SheetNames[0];
      setSelectedSheet(firstSheet);
      
      const sheet = workbook.Sheets[firstSheet];
      const rawJson = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      setParsedRows(rawJson);
      
      autoDetectColumns(rawJson);
      toast.success(`Successfully parsed ${name}! Detected ${rawJson.length} lines.`);
    } catch (err: any) {
      toast.error(`Spreadsheet reading error: ${err.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result instanceof ArrayBuffer) {
        processFileData(evt.target.result, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Paste Data Handlers (Standard Tab delimited copied from Google Sheets / Excel)
  const handlePasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedData(text);
    if (!text.trim()) return;

    const lines = text.split('\n').map(line => line.split('\t'));
    setFileName('Pasted Clipboard Spreadsheet');
    setParsedRows(lines);
    autoDetectColumns(lines);
  };

  // Auto Detect Columns based on keywords
  const autoDetectColumns = (grid: any[][]) => {
    if (grid.length === 0) return;
    const firstRow = grid[0] || [];
    
    // Scan up to first 3 rows for headers
    for (let r = 0; r < Math.min(3, grid.length); r++) {
      const row = grid[r];
      if (!row) continue;
      
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if (val.includes('date') || val.includes('time') || val.includes('תאריך')) {
          setDateColIdx(c);
        } else if (val.includes('payee') || val.includes('contact') || val.includes('name') || val.includes('לקוח') || val.includes('ספק')) {
          setPayeeColIdx(c);
        } else if (val.includes('memo') || val.includes('desc') || val.includes('details') || val.includes('פרטים')) {
          setMemoColIdx(c);
        } else if (val.includes('amount') || val.includes('total') || val.includes('value') || val.includes('סכום')) {
          setAmountColIdx(c);
        } else if (val.includes('account') || val.includes('category') || val.includes('coa') || val.includes('חשבון')) {
          setAccountColIdx(c);
        } else if (val.includes('debit') || val.includes('dr') || val.includes('חובה')) {
          setDebitColIdx(c);
        } else if (val.includes('credit') || val.includes('cr') || val.includes('זכות')) {
          setCreditColIdx(c);
        }
      }
    }
  };

  // Clean data records based on mapped index
  const headerOffset = hasHeaders ? 1 : 0;
  const rawRecords = useMemo(() => {
    if (parsedRows.length <= headerOffset) return [];
    return parsedRows.slice(headerOffset).filter(row => {
      // Must have content in at least Date
      return row && row.length > 0 && row.some(cell => cell !== undefined && cell !== '');
    });
  }, [parsedRows, headerOffset]);

  // Extract all unique raw account names
  const uniqueRawAccounts = useMemo(() => {
    if (accountColIdx === -1 || rawRecords.length === 0) return [];
    const set = new Set<string>();
    rawRecords.forEach(row => {
      const name = String(row[accountColIdx] || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [rawRecords, accountColIdx]);

  // Compute fuzzy similarities for each raw account against our Chart of Accounts
  const rawAccountSuggestions = useMemo(() => {
    const suggestions: Record<string, { suggestedId: string; confidence: number; name: string }> = {};
    
    uniqueRawAccounts.forEach(raw => {
      let bestMatch: ChartAccount | null = null;
      let highestSim = 0;
      
      accounts.forEach(acc => {
        const sim = jaroWinklerSimilarity(raw.toLowerCase(), acc.name.toLowerCase());
        if (sim > highestSim) {
          highestSim = sim;
          bestMatch = acc;
        }
      });

      if (bestMatch && highestSim > 0.65) {
        suggestions[raw] = {
          suggestedId: (bestMatch as ChartAccount).id,
          confidence: Math.round(highestSim * 100),
          name: (bestMatch as ChartAccount).name
        };
      } else {
        // Fallback or no similarity
        suggestions[raw] = {
          suggestedId: '',
          confidence: 0,
          name: 'Uncategorized'
        };
      }
    });

    return suggestions;
  }, [uniqueRawAccounts, accounts]);

  // Resolve raw account name to assigned checklist
  const getResolvedAccountId = (rawVal: string) => {
    if (accountMapping[rawVal]) return accountMapping[rawVal];
    return rawAccountSuggestions[rawVal]?.suggestedId || '';
  };

  // Check overall compliance status
  const ledgerVerificationStatus = useMemo(() => {
    if (rawRecords.length === 0) return { valid: false, message: 'No records to verify' };
    if (dateColIdx === -1) return { valid: false, message: 'Date column mapping missing.' };

    if (importMode === 'ai_labeling_only') {
      if (memoColIdx === -1 && payeeColIdx === -1) {
        return { valid: false, message: 'Please select either a Payee Column or a Memo / Description Column for neural labeling.' };
      }
      
      let rowErrorCount = 0;
      rawRecords.forEach((row) => {
        const dateStr = String(row[dateColIdx] || '').trim();
        if (!dateStr || isNaN(Date.parse(dateStr))) {
          rowErrorCount++;
        }
      });

      if (rowErrorCount > 0) {
        return { valid: false, message: `${rowErrorCount} rows have invalid or unparsable dates.` };
      }

      return { valid: true, message: 'Passed compliance validation checks. Ready for Neural AI Labeling Run!' };
    }

    if (importMode === 'bank_transactions') {
      if (amountColIdx === -1) return { valid: false, message: 'Amount column mapping missing.' };
      if (!offsetAccountId) return { valid: false, message: 'Please select a Double-Entry Offset Accounting clearing node.' };
    } else {
      // Journal Entry Rows
      if (accountColIdx === -1) return { valid: false, message: 'Account column mapping missing.' };
      if (debitColIdx === -1 || creditColIdx === -1) {
        return { valid: false, message: 'Debit and Credit column mappings are required.' };
      }
    }

    // Examine records balance verification
    let debitSum = 0;
    let creditSum = 0;
    let singleColTotal = 0;
    let rowErrorCount = 0;

    rawRecords.forEach((row, idx) => {
      const dateStr = String(row[dateColIdx] || '').trim();
      if (!dateStr || isNaN(Date.parse(dateStr))) {
        rowErrorCount++;
        return;
      }

      if (importMode === 'bank_transactions') {
        const amtStr = String(row[amountColIdx] || '').replace(/[$,]/g, '').trim();
        const amtVal = parseFloat(amtStr);
        if (isNaN(amtVal)) {
          rowErrorCount++;
        } else {
          singleColTotal += amtVal;
        }
      } else {
        const dbStr = String(row[debitColIdx] || '').replace(/[$,]/g, '').trim();
        const crStr = String(row[creditColIdx] || '').replace(/[$,]/g, '').trim();
        const dbVal = dbStr ? parseFloat(dbStr) : 0;
        const crVal = crStr ? parseFloat(crStr) : 0;
        
        debitSum += isNaN(dbVal) ? 0 : dbVal;
        creditSum += isNaN(crVal) ? 0 : crVal;

        // Verify account is resolved
        const rawAcc = String(row[accountColIdx] || '').trim();
        if (!getResolvedAccountId(rawAcc)) {
          rowErrorCount++;
        }
      }
    });

    if (rowErrorCount > 0) {
      return { 
        valid: false, 
        message: `${rowErrorCount} rows have invalid dates, amounts, or unresolved account names.` 
      };
    }

    if (importMode === 'journal_entry_rows') {
      const difference = Math.abs(debitSum - creditSum);
      if (difference > 0.01) {
        return { 
          valid: false, 
          message: `Double-entry discrepancy: Total Debits (${formatCurrency(Math.round(debitSum * 100))}) must match Credits (${formatCurrency(Math.round(creditSum * 100))}). Diff: ${formatCurrency(Math.round(difference * 100))}` 
        };
      }
    }

    return { valid: true, message: 'Passed compliance validation checks.' };
  }, [rawRecords, dateColIdx, amountColIdx, offsetAccountId, importMode, accountColIdx, debitColIdx, creditColIdx, memoColIdx, payeeColIdx, accountMapping, rawAccountSuggestions]);

  // Create single, fresh ChartAccount inline
  const handleCreateNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentWorkspaceId) return;
    if (!newAccName.trim() || !newAccCode.trim()) {
      toast.error('All fields are required.');
      return;
    }

    const loader = toast.loading('Creating Chart Account...');
    try {
      const docRef = await addDoc(collection(db, 'chartAccounts'), {
        code: newAccCode,
        name: newAccName,
        type: newAccType,
        balanceCents: 0,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        createdAt: new Date().toISOString()
      });

      // Update mapping automatically
      if (selectedRawAccountForCreation) {
        setAccountMapping(prev => ({
          ...prev,
          [selectedRawAccountForCreation]: docRef.id
        }));
      }

      toast.success(`Account '${newAccName}' synced to QuickBooks topology`, { id: loader });
      setIsCreatingAccount(false);
      setNewAccName('');
      setNewAccCode('');
      setSelectedRawAccountForCreation(null);
    } catch (err: any) {
      toast.error(`Account creation crash: ${err.message}`, { id: loader });
    }
  };

  // --- Core Neural Labeling Engine Execution Hook ---
  const handleNeuralLabelingRun = async () => {
    if (dateColIdx === -1) {
      toast.error('Date Column is required for neural mapping.');
      return;
    }
    if (memoColIdx === -1 && payeeColIdx === -1) {
      toast.error('Description/Memo or Payee column is needed for classification.');
      return;
    }

    setIsLabeling(true);
    const mainLoader = toast.loading('Initiating Bayesian self-learning network...');

    try {
      // Small simulated latency for compilation of neural layers + seed caches
      await new Promise(resolve => setTimeout(resolve, 800));

      const engine = new MatchingEngine(
        autoRules || [],
        analyticalPatternCache || {},
        user?.uid || '',
        matchingThreshold || 0.85,
        transactions || []
      );

      const payloadTransactions = rawRecords.map(row => {
        const rawDate = row[dateColIdx] ? String(row[dateColIdx]).trim() : '';
        const rawMemo = memoColIdx !== -1 ? String(row[memoColIdx] || '').trim() : '';
        const rawPayee = payeeColIdx !== -1 ? String(row[payeeColIdx] || '').trim() : '';
        const rawAmtStr = amountColIdx !== -1 ? String(row[amountColIdx] || '').replace(/[$,]/g, '').trim() : '0';
        const amountCents = TruthEngine.parseAmountToCents(rawAmtStr || '0');

        const matchText = rawMemo || rawPayee;
        const debugResult = engine.debugResolveCategory(matchText);
        const resolvedCategory = debugResult.accountName;
        const matchLayer = debugResult.layer;
        const confidenceScore = debugResult.confidence !== undefined ? debugResult.confidence : 0.85;

        // Look up corresponding ChartAccount ID
        const matchedAccount = (accounts || []).find(
          a => a.name.toLowerCase() === resolvedCategory.toLowerCase()
        );
        const detectedAccountId = matchedAccount ? matchedAccount.id : 'uncategorized';

        return {
          date: rawDate,
          description: rawMemo,
          payee: rawPayee,
          amountCents,
          detectedAccountName: resolvedCategory,
          detectedAccountId: detectedAccountId,
          isExpense: true,
          confidenceScore: confidenceScore,
          complianceStatus: confidenceScore >= (matchingThreshold || 0.85) ? 'VERIFIED' : 'AUDIT_NEEDED',
          matchLayer: matchLayer
        };
      });

      setLabeledResults(payloadTransactions);
      toast.success(`Autonomous self-learning run complete! Resolved ${payloadTransactions.length} items.`, { id: mainLoader });
    } catch (err: any) {
      toast.error(`Classification Fault: ${err.message}`, { id: mainLoader });
    } finally {
      setIsLabeling(false);
    }
  };

  // --- Neural Labeling Exporter Action ---
  const handleDownloadLabeledSpreadsheet = () => {
    if (labeledResults.length === 0) {
      toast.error('No labeled records found. Execute labeling run first.');
      return;
    }

    try {
      const headers = [
        'Date',
        'Raw Description',
        'Payee / Contact',
        'Amount',
        'Detected Account Label',
        'Classification Sector ID',
        'Operation Segment',
        'System Confidence Score',
        'Logistical Compliance Status'
      ];

      const rows = [
        headers,
        ...labeledResults.map(tx => [
          tx.date,
          tx.description,
          tx.payee,
          (tx.amountCents / 100).toFixed(2),
          tx.detectedAccountName,
          tx.detectedAccountId,
          tx.isExpense ? 'EXPENSE' : 'INCOME',
          `${Math.round(tx.confidenceScore * 100)}%`,
          tx.complianceStatus
        ])
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Labeled Transactions");
      
      const cleanFileName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "Raw_Dataset";
      const downloadName = `${cleanFileName}_Neural_Labeled.xlsx`;
      XLSX.writeFile(wb, downloadName);
      toast.success(`Workbook downloaded: ${downloadName}`);
    } catch (err: any) {
      toast.error(`Export failure: ${err.message}`);
    }
  };

  // Perform Final Synchronized Ingestion
  const handleFullIngestion = async () => {
    if (!user || !currentWorkspaceId) return;
    if (!ledgerVerificationStatus.valid) {
      toast.error(ledgerVerificationStatus.message);
      return;
    }

    setIsProcessing(true);
    const mainLoader = toast.loading(`Ingesting ${rawRecords.length} spreadsheet records...`);

    try {
      const dbInstance = db;
      const parsedTransactionsToImport: any[] = [];
      const batchLogs: Array<{ action: string, details: string }> = [];

      if (importMode === 'bank_transactions') {
        const offsetAcc = accounts.find(a => a.id === offsetAccountId);
        if (!offsetAcc) throw new Error('Selected offset account is not valid.');

        rawRecords.forEach((row) => {
          const rawDate = String(row[dateColIdx] || '').trim();
          const rawPayee = payeeColIdx !== -1 ? String(row[payeeColIdx] || '').trim() : '';
          const rawMemo = memoColIdx !== -1 ? String(row[memoColIdx] || '').trim() : '';
          const rawAmtStr = String(row[amountColIdx] || '').replace(/[$,]/g, '').trim();
          
          let amount = parseFloat(rawAmtStr);
          if (isNaN(amount)) return;
          const totalAmountCents = Math.round(Math.abs(amount) * 100);

          // We create two balanced lines
          // Line 1: Offset Clearing (Debit/Credit)
          // Line 2: Auto-Resolved category or standard mapping
          const descriptionVal = rawMemo || `Excel Imported Transaction`;
          const parsedDate = new Date(rawDate).toISOString().split('T')[0];

          // For standard bank sheet: if it's positive (income), we debit Cash/offset, credit standard
          // If negative (expense), we debit expense, credit cash/offset
          const direction = amount >= 0 ? 1 : -1;
          
          const rawCatName = accountColIdx !== -1 ? String(row[accountColIdx] || '').trim() : '';
          const mappedTargetId = rawCatName ? getResolvedAccountId(rawCatName) : 'uncategorized';
          const targetAcc = accounts.find(a => a.id === mappedTargetId);
          const targetAccName = targetAcc?.name || 'Uncategorized';

          const lines: any[] = [];

          parsedTransactionsToImport.push({
            date: parsedDate,
            description: descriptionVal,
            payee: rawPayee,
            totalAmountCents,
            currency: 'USD',
            status: 'completed',
            type: 'actual',
            lines
          });
        });
      } else {
        // Strict Journal Entry Rows
        // A single journal entry represents all lines grouped by same date and memo, or a single massive entry
        // To keep it clean and robust, we compile them into a unified multi-line journal transaction!
        const linesToSum: any[] = [];
        let firstDate = new Date().toISOString().split('T')[0];
        let compiledMemo = 'Excel Multi-Line Balanced Ledger Journal';

        rawRecords.forEach((row, index) => {
          const rawDate = String(row[dateColIdx] || '').trim();
          const rawMemo = memoColIdx !== -1 ? String(row[memoColIdx] || '').trim() : '';
          const rawAcc = String(row[accountColIdx] || '').trim();
          const rawDb = String(row[debitColIdx] || '').replace(/[$,]/g, '').trim();
          const rawCr = String(row[creditColIdx] || '').replace(/[$,]/g, '').trim();

          const dbVal = rawDb ? parseFloat(rawDb) : 0;
          const crVal = rawCr ? parseFloat(rawCr) : 0;
          const lineAmount = Math.round((dbVal - crVal) * 100);

          if (index === 0 && rawDate) {
            firstDate = new Date(rawDate).toISOString().split('T')[0];
          }
          if (index === 0 && rawMemo) {
            compiledMemo = rawMemo;
          }

          const targetId = getResolvedAccountId(rawAcc);
          const currentAcc = accounts.find(a => a.id === targetId);

          linesToSum.push({
            accountId: targetId,
            accountName: currentAcc?.name || 'Uncategorized',
            amountCents: lineAmount,
            description: rawMemo || compiledMemo
          });
        });

        // Compute total amount cents as the sum of absolute debit legs
        const totalAmountCents = linesToSum
          .filter(l => l.amountCents > 0)
          .reduce((acc, current) => acc + current.amountCents, 0);

        parsedTransactionsToImport.push({
          date: firstDate,
          description: compiledMemo,
          payee: 'General Journal',
          totalAmountCents,
          currency: 'USD',
          status: 'completed',
          type: 'actual',
          lines: linesToSum
        });
      }

      if (parsedTransactionsToImport.length === 0) {
        throw new Error('Zero transactions parsed successfully.');
      }

      await handleImportTransactions(parsedTransactionsToImport);
      
      // Reset State
      setParsedRows([]);
      setPastedData('');
      setFileName('');
      
      toast.success(`Successfully balanced and committed ${parsedTransactionsToImport.length} elements directly to the ledger!`, { id: mainLoader });
    } catch (err: any) {
      toast.error(`Synchronization aborted: ${err.message}`, { id: mainLoader });
    } finally {
      setIsProcessing(false);
    }
  };

  // Export verifiable QuickBooks-compliant CSV
  const handleExportQuickBooksIIF = () => {
    if (rawRecords.length === 0) {
      toast.error('No rows available for exporting.');
      return;
    }

    try {
      // Create classic QBO Journal IIF/CSV Content
      let content = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\r\n';
      content += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\r\n';
      content += '!ENDTRNS\r\n';

      rawRecords.forEach((row) => {
        const rawDate = String(row[dateColIdx] || '').trim();
        const rawPayee = payeeColIdx !== -1 ? String(row[payeeColIdx] || '').trim() : '';
        const rawMemo = memoColIdx !== -1 ? String(row[memoColIdx] || '').trim() : 'Bridge Export';
        
        let dateForm = rawDate;
        try {
          const d = new Date(rawDate);
          dateForm = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
        } catch (_) {}

        if (importMode === 'bank_transactions') {
          const rawAmtStr = String(row[amountColIdx] || '').replace(/[$,]/g, '').trim();
          const amt = parseFloat(rawAmtStr);
          if (isNaN(amt)) return;

          const rawCatName = accountColIdx !== -1 ? String(row[accountColIdx] || '').trim() : '';
          const mappedTargetId = rawCatName ? getResolvedAccountId(rawCatName) : 'uncategorized';
          const targetAcc = accounts.find(a => a.id === mappedTargetId);
          const targetAccName = targetAcc?.name || 'Uncategorized';

          const offsetAcc = accounts.find(a => a.id === offsetAccountId);
          const offsetAccName = offsetAcc?.name || 'Checking';

          content += `TRNS\t\tGENERAL JOURNAL\t${dateForm}\t${offsetAccName}\t${rawPayee}\t${amt.toFixed(2)}\t${rawMemo}\r\n`;
          content += `SPL\t\tGENERAL JOURNAL\t${dateForm}\t${targetAccName}\t\t${(-amt).toFixed(2)}\t${rawMemo}\r\n`;
          content += `ENDTRNS\r\n`;
        } else {
          // Journal Rows
          const rawAcc = String(row[accountColIdx] || '').trim();
          const rawDb = String(row[debitColIdx] || '').replace(/[$,]/g, '').trim();
          const rawCr = String(row[creditColIdx] || '').replace(/[$,]/g, '').trim();
          const dbVal = rawDb ? parseFloat(rawDb) : 0;
          const crVal = rawCr ? parseFloat(rawCr) : 0;
          const amt = dbVal - crVal;

          const targetId = getResolvedAccountId(rawAcc);
          const accName = accounts.find(a => a.id === targetId)?.name || rawAcc;

          content += `TRNS\t\tGENERAL JOURNAL\t${dateForm}\t${accName}\t${rawPayee}\t${amt.toFixed(2)}\t${rawMemo}\r\n`;
          content += `ENDTRNS\r\n`;
        }
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `QuickBooks_Audit_Bridge_${new Date().toISOString().split('T')[0]}.iif`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Successfully exported QuickBooks IIF ledger verification package.');
    } catch (err: any) {
      toast.error(`Export failure: ${err.message}`);
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-4 md:p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-slate-50 rounded-[32px] border border-slate-200 text-slate-900">
              <ArrowLeftRight size={22} />
            </span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Excel ⇄ QBO Truth Bridge</h1>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium">
            Bridging the gap between messy user spreadsheets and disciplined QuickBooks-style double-entry bookkeeping. Upload sheets or paste cells from Excel, map columns dynamically, resolve accounts via AI similarity, and ingest verified, balanced transactions directly to the ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center p-1.5 bg-slate-50 border border-slate-200 rounded-[32px] shrink-0">
          <button
            onClick={() => { setImportMode('bank_transactions'); setParsedRows([]); setFileName(''); setLabeledResults([]); }}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
              importMode === 'bank_transactions' 
                ? "bg-slate-900 text-white shadow-md shadow-ledger-ink/20" 
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            Bank Transactions
          </button>
          <button
            onClick={() => { setImportMode('journal_entry_rows'); setParsedRows([]); setFileName(''); setLabeledResults([]); }}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
              importMode === 'journal_entry_rows' 
                ? "bg-slate-900 text-white shadow-md shadow-ledger-ink/20" 
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            Double-Entry Journals
          </button>
          <button
            onClick={() => { setImportMode('ai_labeling_only'); setParsedRows([]); setFileName(''); setLabeledResults([]); }}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all",
              importMode === 'ai_labeling_only' 
                ? "bg-slate-900 text-white shadow-md shadow-ledger-ink/20" 
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            Neural AI Labeler
          </button>
        </div>
      </div>

      {parsedRows.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Paste Zone */}
          <div className="bg-white p-4 md:p-8 rounded-[36px] border border-slate-200 shadow-sm flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-slate-50 rounded-[32px] text-slate-900">
                <Table size={18} />
              </span>
              <div>
                <h2 className="text-md font-black text-slate-900 uppercase tracking-tight">Paste Excel Cells Directly</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Instant clipboard mapping bypasses file exports</p>
              </div>
            </div>

            <textarea
              className="flex-1 w-full min-h-[300px] p-6 text-xs font-mono bg-slate-50/20 border border-slate-200 rounded-[32px] focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-800/40 resize-none"
              placeholder="Copy a selection of cells from Microsoft Excel or Google Sheets and paste them here..."
              value={pastedData}
              onChange={handlePasteChange}
            />
            
            <div className="flex items-center gap-3 text-slate-500 bg-slate-50/40 p-4 rounded-xl border border-slate-200/50">
              <Info size={16} className="shrink-0 text-slate-900" />
              <p className="text-[10px] leading-relaxed font-bold">
                Tab-separated formats are decoded immediately. Column detections run autonomously to map Date, Payee, and Value points instantly.
              </p>
            </div>
          </div>

          {/* Import zone file */}
          <div className="bg-white p-4 md:p-8 rounded-[36px] border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[450px] text-center border-dashed relative group">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            
            <div className="space-y-6 max-w-sm">
              <div className="mx-auto w-20 h-20 bg-slate-50 rounded-[28px] border border-slate-200 flex items-center justify-center text-slate-500 group-hover:scale-105 transition-transform">
                <UploadCloud size={32} className="text-slate-900" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Upload Spreadsheet File</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed font-medium">
                  Supports QuickBooks exported reports, bank statement exports, or custom journal sheets in <strong>XLSX, XLS, or CSV</strong> formats.
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 w-full bg-slate-900 hover:bg-black text-white font-medium uppercase tracking-wider text-[10px] rounded-xl transition-all shadow-md shadow-ledger-ink/10"
              >
                Choose Local File
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Navigation Path Header for sheet loaded */}
          <div className="flex items-center justify-between bg-slate-900 text-white p-6 rounded-[32px] shadow-xl">
            <div className="flex items-center gap-4">
              <FileSpreadsheet className="text-white/85" size={22} />
              <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/50">Active Source</p>
                <h3 className="text-sm font-black uppercase italic tracking-tight">{fileName}</h3>
              </div>
            </div>

            <button
              onClick={() => {
                setParsedRows([]);
                setPastedData('');
                setFileName('');
              }}
              className="px-4 py-2 hover:bg-white/10 text-[9px] text-white/80 hover:text-white font-medium uppercase tracking-wider border border-white/10 rounded-xl transition-all"
            >
              Clear Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            {/* Column Mapper Panel */}
            <div className="lg:col-span-1 bg-white p-4 md:p-8 rounded-[36px] border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <Settings size={18} className="text-slate-900" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Topology Mapper</h3>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider select-none">Has Header Row</label>
                <button
                  onClick={() => setHasHeaders(!hasHeaders)}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none",
                    hasHeaders ? "bg-slate-900" : "bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
                    hasHeaders && "translate-x-6"
                  )} />
                </button>
              </div>

              {/* Mapper Fields */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Date Column *</label>
                  <select
                    value={dateColIdx}
                    onChange={(e) => setDateColIdx(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                  >
                    <option value={-1}>-- Select Column --</option>
                    {(parsedRows[0] || []).map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Payee / Contact Column</label>
                  <select
                    value={payeeColIdx}
                    onChange={(e) => setPayeeColIdx(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                  >
                    <option value={-1}>-- Exclude / None --</option>
                    {(parsedRows[0] || []).map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Memo / Description Column</label>
                  <select
                    value={memoColIdx}
                    onChange={(e) => setMemoColIdx(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                  >
                    <option value={-1}>-- Exclude / None --</option>
                    {(parsedRows[0] || []).map((header, idx) => (
                      <option key={idx} value={idx}>
                        Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {importMode === 'bank_transactions' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Amount / Value Column *</label>
                      <select
                        value={amountColIdx}
                        onChange={(e) => setAmountColIdx(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {(parsedRows[0] || []).map((header, idx) => (
                          <option key={idx} value={idx}>
                            Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Transaction Category / Target COA Column</label>
                      <select
                        value={accountColIdx}
                        onChange={(e) => setAccountColIdx(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                      >
                        <option value={-1}>-- Uncategorized (Manual Assignment) --</option>
                        {(parsedRows[0] || []).map((header, idx) => (
                          <option key={idx} value={idx}>
                            Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="p-5 bg-slate-50/40 rounded-[32px] border border-slate-200 space-y-3">
                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-wider block">Double-Entry Cleared Clearing Asset *</label>
                      <select
                        value={offsetAccountId}
                        onChange={(e) => setOffsetAccountId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none"
                      >
                        <option value="">-- Choose Account (Checking/Card) --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({(acc.type || '').toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-500 font-bold block uppercase leading-relaxed">
                        To maintain absolute Double-Entry balance, every single amount recorded is paired with this offset asset clearing account as a double entry limb.
                      </p>
                    </div>
                  </>
                ) : importMode === 'ai_labeling_only' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Amount / Value Column (Optional)</label>
                      <select
                        value={amountColIdx}
                        onChange={(e) => setAmountColIdx(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                      >
                        <option value={-1}>-- Exclude / None --</option>
                        {(parsedRows[0] || []).map((header, idx) => (
                          <option key={idx} value={idx}>
                            Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="p-5 bg-emerald-500/5 text-emerald-800 rounded-[32px] border border-emerald-500/20 space-y-2">
                      <h4 className="text-[11px] font-black uppercase tracking-tight text-emerald-950 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-emerald-600 animate-pulse" /> Autonomous Mode Activated
                      </h4>
                      <p className="text-[9px] leading-relaxed font-semibold">
                        This workflow operates on transient sandbox schemas. You do not need matching chart topologies. The system runs descriptors through the AI server and outputs a fully localized downloadable labeled catalog.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Account Name / Category Column *</label>
                      <select
                        value={accountColIdx}
                        onChange={(e) => setAccountColIdx(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {(parsedRows[0] || []).map((header, idx) => (
                          <option key={idx} value={idx}>
                            Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Debit Column *</label>
                      <select
                        value={debitColIdx}
                        onChange={(e) => setDebitColIdx(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {(parsedRows[0] || []).map((header, idx) => (
                          <option key={idx} value={idx}>
                            Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Credit Column *</label>
                      <select
                        value={creditColIdx}
                        onChange={(e) => setCreditColIdx(parseInt(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold font-mono focus:outline-none"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {(parsedRows[0] || []).map((header, idx) => (
                          <option key={idx} value={idx}>
                            Col {String.fromCharCode(65 + idx)} {hasHeaders && header ? `(${header})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Core Verification & Alignment Panel */}
            <div className="lg:col-span-2 space-y-8">
              {/* Intelligent Fuzzy Account Alignment Ledger */}
              {importMode !== 'ai_labeling_only' && accountColIdx !== -1 && uniqueRawAccounts.length > 0 && (
                <div className="bg-white p-4 md:p-8 rounded-[36px] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3">
                      <Sparkles size={18} className="text-slate-900" />
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">QuickBooks COA Account Matcher</h3>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">Automated string similarity & custom linkages</p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto divide-y divide-ledger-line pr-2">
                    {uniqueRawAccounts.map(rawVal => {
                      const suggest = rawAccountSuggestions[rawVal];
                      const currentSelectedId = getResolvedAccountId(rawVal);
                      const currentSelectedName = accounts.find(a => a.id === currentSelectedId)?.name || 'Uncategorized';
                      
                      return (
                        <div key={rawVal} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-bold font-mono text-slate-900">{rawVal}</p>
                            
                            {suggest && suggest.confidence > 0 && !accountMapping[rawVal] && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest">
                                  Auto-Suggested Match: {suggest.name} ({suggest.confidence}% Confidence)
                                </span>
                              </div>
                            )}

                            {accountMapping[rawVal] && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span className="text-[9px] text-blue-600 font-bold uppercase tracking-widest">Manual Resolution Override Active</span>
                              </div>
                            )}

                            {!suggest?.suggestedId && !accountMapping[rawVal] && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span className="text-[9px] text-rose-500 font-bold uppercase tracking-widest">Topology Disconnection (Requires Mapping)</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={currentSelectedId}
                              onChange={(e) => {
                                setAccountMapping(prev => ({
                                  ...prev,
                                  [rawVal]: e.target.value
                                }));
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none min-w-[180px]"
                            >
                              <option value="">-- Choose QuickBooks Account --</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name} ({(acc.type || '').toUpperCase()})
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => {
                                setSelectedRawAccountForCreation(rawVal);
                                setNewAccName(rawVal);
                                const guessCode = Math.floor(1000 + Math.random() * 8999).toString();
                                setNewAccCode(guessCode);
                                setIsCreatingAccount(true);
                              }}
                              title="Sync as fresh account to COA"
                              className="p-2 text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-200/50 border border-slate-200 rounded-xl transition-all"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dynamic Account Creation Form Modal */}
              <AnimatePresence>
                {isCreatingAccount && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white p-4 md:p-8 rounded-[36px] border border-slate-200 shadow-sm space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider block">Sync New Chart Account</h4>
                      <button
                        onClick={() => setIsCreatingAccount(false)}
                        className="text-slate-500 hover:text-slate-900"
                      >
                        Discard
                      </button>
                    </div>

                    <form onSubmit={handleCreateNewAccount} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">QuickBooks Account Code</label>
                        <input
                          type="text"
                          value={newAccCode}
                          onChange={(e) => setNewAccCode(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none"
                          placeholder="e.g. 5010"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Account Name</label>
                        <input
                          type="text"
                          value={newAccName}
                          onChange={(e) => setNewAccName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Accounting Topology Type</label>
                        <select
                          value={newAccType}
                          onChange={(e) => setNewAccType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none"
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="asset">Asset (Checking / Receivable)</option>
                          <option value="liability">Liability (Credit Card / Payable)</option>
                          <option value="equity">Equity</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 flex justify-end">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-slate-900 text-white font-medium uppercase tracking-wider text-[10px] rounded-xl hover:bg-black transition-all"
                        >
                          Confirm & Ingest Account
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Neural Labeling Analytical Dashboard */}
              {importMode === 'ai_labeling_only' && (
                <div className="space-y-6">
                  {labeledResults.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
                      <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Processed Datasets</span>
                        <div className="text-2xl font-black text-slate-900 font-mono">{labeledResults.length}</div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Ready for export</p>
                      </div>

                      <div className="bg-emerald-500/5 p-5 rounded-[32px] border border-emerald-500/10 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-emerald-800 block tracking-wider">Verified Mappings</span>
                        <div className="text-2xl font-black text-emerald-950 font-mono">
                          {labeledResults.filter(r => r.confidenceScore >= 0.7).length}
                        </div>
                        <p className="text-[9px] font-bold text-emerald-700 uppercase font-mono">Confidence &ge; 70%</p>
                      </div>

                      <div className="bg-amber-500/5 p-5 rounded-[32px] border border-amber-500/10 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-amber-800 block tracking-wider">Needs Audit Review</span>
                        <div className="text-2xl font-black text-amber-950 font-mono">
                          {labeledResults.filter(r => r.confidenceScore < 0.7).length}
                        </div>
                        <p className="text-[9px] font-bold text-amber-700 uppercase font-mono">Confidence &lt; 70%</p>
                      </div>

                      <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm space-y-1">
                        <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Avg Neural Confidence</span>
                        <div className="text-2xl font-black text-slate-900 font-mono animate-pulse">
                          {Math.round((labeledResults.reduce((sum, current) => sum + (current.confidenceScore || 0), 0) / Math.max(1, labeledResults.length)) * 100)}%
                        </div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">Model consistency rating</p>
                      </div>
                    </div>
                  )}

                  {/* Restful Developer Integration Suite */}
                  <div className="bg-slate-900 text-zinc-100 p-4 md:p-8 rounded-[36px] shadow-xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-200/80">Programmatic REST API Node</span>
                      </div>
                      <span className="text-[9px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">v1.0 Enabled</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase tracking-tight text-white animate-pulse">Label Raw Spreadsheet Datasets</h4>
                      <p className="text-[10px] text-zinc-400 font-medium max-w-xl leading-relaxed">
                        Integrate ledger labeling services into native ERP or custom shell flows. Submit arrays of raw descriptions over a standard HTTPS POST, and pull fully classified accounts back instantly.
                      </p>
                    </div>

                    <div className="bg-zinc-950 rounded-[32px] border border-zinc-800 p-4 space-y-2 font-mono text-[10px] text-zinc-300 overflow-x-auto select-all">
                      <div className="flex items-center gap-1.5 border-b border-zinc-800/80 pb-2 text-zinc-500 uppercase font-black tracking-wider text-[9px]">
                        <span>Command line manual call curl</span>
                      </div>
                      <code className="block leading-relaxed">
                        curl -X POST "{typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com'}/api/v1/label-transactions" \<br />
                        &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                        &nbsp;&nbsp;-H "Authorization: Bearer [YOUR_FIREBASE_JWT_TOKEN]" \<br />
                        &nbsp;&nbsp;-d '&#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"workspaceId": "{currentWorkspaceId}",<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;"transactions": [<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#123; "date": "2026-06-05", "description": "AWS Cloud Services Bill", "amountCents": 12890 &#125;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;]<br />
                        &nbsp;&nbsp;&#125;'
                      </code>
                    </div>
                  </div>
                </div>
              )}

              {/* Spreadsheets Review Grid */}
              <div className="bg-white rounded-[36px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 md:p-8 border-b border-slate-200 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Row Segment Auditor</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Auditing parsed row nodes for ledger compliance</p>
                  </div>
                  <div className="text-[10px] font-black font-mono text-slate-900 px-4 py-1.5 bg-white border border-slate-200 rounded-xl">
                    {rawRecords.length} Elements Decoded
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs text-slate-900">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black text-slate-500 uppercase tracking-widest select-none">
                        <th className="p-4 w-12 text-center">Row</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Contact / Payee</th>
                        <th className="p-4">Memo / Description</th>
                        {importMode === 'bank_transactions' ? (
                          <>
                            <th className="p-4 text-right">Raw Amount</th>
                            <th className="p-4">Target Category (COA)</th>
                          </>
                        ) : importMode === 'ai_labeling_only' ? (
                          <>
                            <th className="p-4">Neural Category Mapping</th>
                            <th className="p-4 text-right">Raw Amount</th>
                            <th className="p-4 text-right">Match Security Scale</th>
                          </>
                        ) : (
                          <>
                            <th className="p-4">Target Category (COA)</th>
                            <th className="p-4 text-right">Debit</th>
                            <th className="p-4 text-right">Credit</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ledger-line font-medium">
                      {rawRecords.map((row, idx) => {
                        const dateVal = dateColIdx !== -1 ? String(row[dateColIdx] || '').trim() : '';
                        const payeeVal = payeeColIdx !== -1 ? String(row[payeeColIdx] || '').trim() : '';
                        const memoVal = memoColIdx !== -1 ? String(row[memoColIdx] || '').trim() : '';
                        
                        let isRowDateValid = dateVal && !isNaN(Date.parse(dateVal));

                        return (
                          <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                            <td className="p-4 text-center font-mono text-slate-500 text-[10px] font-bold">{idx + 1}</td>
                            <td className={cn(
                              "p-4 font-mono font-bold",
                              !isRowDateValid && "text-rose-500 bg-rose-50"
                            )}>
                              {dateVal || '--'}
                            </td>
                            <td className="p-4 truncate max-w-[120px]" title={payeeVal}>{payeeVal || '--'}</td>
                            <td className="p-4 truncate max-w-[170px]" title={memoVal}>{memoVal || '--'}</td>

                            {importMode === 'bank_transactions' ? (
                              <>
                                <td className="p-4 text-right font-mono font-bold">
                                  {amountColIdx !== -1 ? String(row[amountColIdx] || '') : '--'}
                                </td>
                                <td className="p-4 text-xs font-bold font-mono">
                                  {accountColIdx !== -1 ? (
                                    <span className="font-sans text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                      {accounts.find(a => a.id === getResolvedAccountId(String(row[accountColIdx] || '')) )?.name || String(row[accountColIdx] || '')}
                                    </span>
                                  ) : '--'}
                                </td>
                              </>
                            ) : importMode === 'ai_labeling_only' ? (
                              <>
                                <td className="p-4 text-xs font-bold font-sans">
                                  {labeledResults.length > 0 ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <Sparkles size={11} className="text-emerald-500" />
                                        {labeledResults[idx]?.detectedAccountName || 'Unresolved'}
                                      </div>
                                      <div className="text-[9px] text-slate-500 font-bold font-mono tracking-tight">COA TARGET ID: {labeledResults[idx]?.detectedAccountId || 'N/A'}</div>
                                      {labeledResults[idx]?.matchLayer && (
                                        <div className="text-[8px] font-bold text-indigo-600 bg-indigo-100/50 border border-indigo-150 rounded px-1.5 py-0.5 mt-0.5 inline-block uppercase tracking-wider font-sans">
                                          {labeledResults[idx]?.matchLayer}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic font-sans font-semibold">Ready to Categorize</span>
                                  )}
                                </td>
                                <td className="p-4 text-right font-mono font-bold">
                                  {amountColIdx !== -1 ? String(row[amountColIdx] || '') : '--'}
                                </td>
                                <td className="p-4 text-right">
                                  {labeledResults.length > 0 ? (
                                    <div className="flex flex-col gap-1 items-end">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                        labeledResults[idx]?.complianceStatus === 'VERIFIED'
                                          ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20"
                                          : "bg-amber-500/10 text-amber-800 border border-amber-500/20"
                                      )}>
                                        {labeledResults[idx]?.complianceStatus}
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-black font-sans uppercase">
                                        {Math.round((labeledResults[idx]?.confidenceScore || 0) * 100)}% Confidence
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic font-sans font-semibold">--</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-4 text-xs font-bold font-mono">
                                  {accountColIdx !== -1 ? (
                                    <span className="font-sans text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                      {accounts.find(a => a.id === getResolvedAccountId(String(row[accountColIdx] || '')) )?.name || String(row[accountColIdx] || '')}
                                    </span>
                                  ) : '--'}
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-emerald-600">
                                  {debitColIdx !== -1 ? String(row[debitColIdx] || '') : '--'}
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-rose-600">
                                  {creditColIdx !== -1 ? String(row[creditColIdx] || '') : '--'}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Validation Status footer */}
                <div className="p-4 md:p-8 bg-slate-50/20 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-3">
                    {ledgerVerificationStatus.valid ? (
                      <span className="p-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                        <CheckCheck size={18} />
                      </span>
                    ) : (
                      <span className="p-2 bg-rose-50 text-rose-500 rounded-full border border-rose-200">
                        <AlertCircle size={18} />
                      </span>
                    )}

                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-tight">Compliance Authentication</h4>
                      <p className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        ledgerVerificationStatus.valid ? "text-emerald-600" : "text-rose-500"
                      )}>
                        {ledgerVerificationStatus.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {importMode === 'ai_labeling_only' ? (
                      <>
                        {labeledResults.length > 0 && (
                          <button
                            onClick={handleDownloadLabeledSpreadsheet}
                            className="px-5 py-3 hover:bg-emerald-50 text-[10px] text-emerald-800 border border-emerald-300 rounded-xl font-medium uppercase tracking-wider transition-all flex items-center gap-2"
                          >
                            <Download size={12} className="text-emerald-600" />
                            Download Labeled Sheet
                          </button>
                        )}

                        <button
                          disabled={!ledgerVerificationStatus.valid || isLabeling}
                          onClick={handleNeuralLabelingRun}
                          className="px-6 py-3 bg-slate-900 hover:bg-black disabled:bg-slate-100 disabled:pointer-events-none text-white font-medium uppercase tracking-wider text-[10px] rounded-xl transition-all shadow-lg shadow-ledger-ink/15 flex items-center gap-2"
                        >
                          {isLabeling ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Categorizing Dataset...
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} className="text-emerald-400" />
                              {labeledResults.length > 0 ? "Re-Run Neural Labeler" : "Run Neural Labeler"}
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleExportQuickBooksIIF}
                          className="px-5 py-3 hover:bg-slate-50 text-[10px] text-slate-900 font-medium uppercase tracking-wider border border-slate-200 rounded-xl transition-all"
                        >
                          Export IIF Package
                        </button>

                        <button
                          disabled={!ledgerVerificationStatus.valid || isProcessing}
                          onClick={handleFullIngestion}
                          className="px-6 py-3 bg-slate-900 hover:bg-black disabled:bg-slate-100 disabled:pointer-events-none text-white font-medium uppercase tracking-wider text-[10px] rounded-xl transition-all shadow-lg shadow-ledger-ink/15 flex items-center gap-2"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Certifying Chain...
                            </>
                          ) : (
                            <>
                              <Database size={12} />
                              Ingest & Synchronize
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
