import { resolveAccountRole } from '../lib/accountUtils';
import { isPostable, lineAmount } from '../lib/txFilters';
import { validateReceiptPayload, mapReceiptToCoordinates } from '../lib/receiptIngestion';
import { matchDeepLabel, decomposeHierarchicalLabel, setLineDimension, normalizeLabel } from '../lib/dimensionUtils';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  addDoc as firestoreAddDoc,
  writeBatch,
  runTransaction,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { MatchingEngine } from '../lib/MatchingEngine';
import { Transaction, BankStatementLine, AutoRule, TransactionLine } from '../types';
import { toast } from 'sonner';
import { formatDecimal, parseLocalDate, sanitizeCsvCell } from '../lib/utils';
import { aiService } from '../services/aiService';
import { DoubleEntryAuditor } from '../services/auditor';
import { 
  findGlobalOptimalMatch, 
  AhoCorasick, 
  kMeans,
  MinHash,
  jaroWinklerSimilarity
} from '../lib/algorithms';
import { safeAsync, safeConfirm, getLocalDateISO } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { useBillingStore } from '../modules/billing/BillingService';
import { TruthEngine } from '../modules/integrity/TruthEngine';
import { retryWithBackoff } from '../lib/retryUtils';
import { checkVersionConflict, resolveConflictLWW } from '../lib/conflictEngine';
import { addComment, getCommentsForEntity } from '../lib/commentService';

export function useTransactionActions() {
  const user = useAuthStore(s => s.user);
  const userProfile = useAuthStore(s => s.userProfile);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  const setAccounts = useLedgerStore(s => s.setAccounts);
  const accounts = useLedgerStore(s => s.accounts);
  const analyticalPatternCache = useLedgerStore(s => s.analyticalPatternCache);
  const matchingThreshold = useLedgerStore(s => s.matchingThreshold);
  const dimensionNodes = useLedgerStore(s => s.dimensionNodes);
  
  const userKey = userProfile?.geminiApiKey;
  const { setIsSyncing } = useUIStore.getState();

  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const recordAudit = async (action: string, entityType: string, entityId: string, details: any) => {
    if (!user || !currentWorkspaceId) return;
    try {
      setIsSyncing(true);
      await retryWithBackoff(() => addDoc(collection(db, 'auditLogs'), {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        email: user.email,
        action,
        entityType,
        entityId,
        details,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'auditLogs');
    }
  };

  const isPeriodLocked = (date: string) => {
    const workspace = getCurrentWorkspace();
    if (!workspace?.lockDate) return false;
    return date <= workspace.lockDate;
  };

  const handleVoidTransaction = async (id: string) => {
    const originalTransactions = useLedgerStore.getState().transactions;
    const tx = originalTransactions.find(t => t.id === id);
    if (!tx) return;

    if (isPeriodLocked(tx.date)) {
      toast.error("Security alert: This period is locked for historical integrity.");
      return;
    }

    const [data, err] = await safeAsync(
      fetch(`/api/v1/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
      body: JSON.stringify({ partialUpdate: { status: 'failed', deletedAt: new Date().toISOString() } })
    }),
      OperationType.UPDATE,
      `transactions/${id}`,
      { action: 'VOID_TRANSACTION' }
    );

    if (!err) {
      await recordAudit('VOID_TRANSACTION', 'transaction', id, { description: tx.description });
      toast.success('Transaction voided', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const token = await user?.getIdToken();
              await fetch(`/api/v1/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ transaction: { ...tx, status: tx.status, deletedAt: tx.deletedAt || null, updatedAt: new Date().toISOString() } })
              });
            } catch (err) {
              console.warn('Undo void failed', err);
            }
          }
        }
      });
    } else {
      // No optimistic update rollback needed
      const message = err?.error || 'Unknown network error';
      toast.error('Could not void transaction.', {
        description: `Please try again. (${message})`
      });
      throw err;
    }
  };

  const handleImportTransactions = async (newTransactions: any[]) => {
    if (!user || !currentWorkspaceId) return;

    const existingTransactions = useLedgerStore.getState().transactions;
    // Fast deduplication via hash and date
    const existingIds = new Set(existingTransactions.map(t => t.bankTransactionId || t.id));
    
    setIsSyncing(true);
    const loader = toast.loading(`Synchronizing ${newTransactions.length} transactions...`);

    try {
      const txsToMatch = newTransactions.filter(tx => !existingIds.has(tx.bankTransactionId) && !existingIds.has(tx.id) && !isPeriodLocked(tx.date));

      // Fetch rules once for the import batch
      const qRules = query(
        collection(db, 'autoRules'), 
        where('workspaceId', '==', currentWorkspaceId),
        where('uid', '==', user.uid)
      );
      const rulesSnap = await getDocs(qRules);
      const activeRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const engine = new MatchingEngine(activeRules, analyticalPatternCache, user.uid, matchingThreshold, existingTransactions, dimensionNodes, accounts);

      const accountsByName = new Map<string, any>();
      const accountsById = new Map<string, any>();
      accounts.forEach(a => {
        accountsByName.set(a.name, a);
        accountsById.set(a.id, a);
      });
      let ccAccountPrecomputed = accounts.find(a => (a.type === 'liability' || a.type === 'asset') && (a.subtype === 'Credit Card' || (a.name || '').toLowerCase().includes('card')));

      const processedTxs: Transaction[] = [];
      const bankLineRecords: any[] = [];

      txsToMatch.forEach(tx => {
        const defaultAccId = accounts.find(a => a.type === 'expense' || a.category === 'Operations')?.id || accounts[0]?.id || '';
        let lines = tx.lines && tx.lines.length > 0 ? tx.lines : [{ accountId: defaultAccId, accountName: 'Uncategorized Expense', amountCents: tx.amountCents }];
        
        const isPreCategorized = lines.length > 0 && 
          Boolean(lines[0].accountId) &&
          lines[0].accountId !== 'uncategorized' && 
          lines[0].accountId !== 'unassigned' &&
          lines[0].accountName !== 'Uncategorized' && 
          lines[0].accountName !== 'Manual Review';

        if (!isPreCategorized) {
          // Priority 1: Deterministic Integrity (Rules and Local Engine) over AI
          let targetCategoryResult = engine.resolveCategory(tx.description);
          let usedAI = false;
          let isSmartTransfer = false;

          // Priority 1.5: Deep Economic Transfer/Payment Detection
          // If the user pays a credit card, it isn't an expense, it's a transfer to a liability account.
          const descLower = (tx.description || '').toLowerCase();
          if (!targetCategoryResult && (
              descLower.includes('payment to credit card') || 
              descLower.includes('thank you for your payment') ||
              descLower.includes('payment thank you') ||
              descLower.includes('tfr to') ||
              descLower.includes('transfer to') ||
              descLower.match(/to\s+.*card/) ||
              descLower.match(/from\s+checking/) ||
              (descLower.includes('payment') && descLower.includes('card'))
          )) {
              // Find a liability account (credit card)
              let ccAccount = ccAccountPrecomputed;
              if (!ccAccount) {
                 const newAccId = 'auto_cc_' + crypto.randomUUID().split('-')[0];
                 ccAccount = {
                   id: newAccId,
                   uid: user.uid,
                   workspaceId: currentWorkspaceId,
                   code: '2100',
                   name: 'Corporate Credit Card',
                   type: 'liability',
                   category: 'Credit Card',
                   subtype: 'Credit Card',
                   balanceCents: 0
                 } as any;
                 if (ccAccount) {
                    setAccounts([...accounts, ccAccount]);
                    accountsByName.set(ccAccount.name, ccAccount);
                    accountsById.set(ccAccount.id, ccAccount);
                    ccAccountPrecomputed = ccAccount;
                 }
              }
              
              if (ccAccount) {
                  targetCategoryResult = { accountName: ccAccount.name };
                  isSmartTransfer = true;
              }
          }

          // If we didn't find a match through the deterministic algorithm or smart transfer, it uses Manual Review.
          if (!targetCategoryResult) {
            usedAI = false;
          }

          if (targetCategoryResult) {
            const account = accountsByName.get(targetCategoryResult.accountName) || accountsById.get(targetCategoryResult.accountName);
            const fallbackAccId = accounts.find(a => a.type === 'expense' || a.category === 'Operations')?.id || accounts[0]?.id || '';
            lines = [{
              accountId: account?.id || fallbackAccId,
              accountName: account?.name || targetCategoryResult.accountName,
              amountCents: tx.amountCents || tx.totalAmountCents || 0,
              tags: targetCategoryResult.tags || (isSmartTransfer ? ['Auto-Transfer'] : []),
              dimensions: targetCategoryResult.dimensions || undefined,
              description: isSmartTransfer ? 'Auto-Transfer Detection' : (usedAI ? 'Auto-categorized by AI' : 'Auto-categorized by Rule Engine')
            }];
          }
        }

        const balancedLines = balanceTransactionLines(lines, tx.amountCents || tx.totalAmountCents || 0);

        let isResolvedCategory = false;
        if (balancedLines[0].accountId !== 'uncategorized' && balancedLines[0].accountName !== 'Uncategorized' && balancedLines[0].accountName !== 'Manual Review') {
          isResolvedCategory = true;
        }

        // 1. ALWAYS inject into the BankLines validation layer
        const bankLineRef = doc(collection(db, 'bankLines'));
        const bankLineRecord = {
          id: bankLineRef.id,
          workspaceId: currentWorkspaceId,
          uid: user.uid,
          date: tx.date,
          description: tx.description,
          amountCents: tx.amountCents || tx.totalAmountCents || 0,
          status: isResolvedCategory ? 'matched' : 'pending',
          matchedTransactionId: null as string | null,
          createdAt: new Date().toISOString()
        };

        // 2. ONLY synthesize actual atomic transaction if category was resolved
        if (isResolvedCategory) {
          const newTxId = doc(collection(db, 'transactions')).id;
          const txDraft: any = {
            ...tx,
            id: newTxId,
            lines: balancedLines,
            uid: user.uid,
            workspaceId: currentWorkspaceId,
            status: (tx as any).isAI ? 'draft' : 'pending',
            type: 'actual',
            createdAt: new Date().toISOString()
          };

          // Resolution check: If accountName was provided, resolve its ID FIRST
          if (txDraft.lines && txDraft.lines.length > 0) {
            txDraft.lines = txDraft.lines.map((line: any) => {
              if (line.accountName && line.accountId === 'uncategorized') {
                const resolved = accountsByName.get(line.accountName);
                if (resolved) {
                  return { ...line, accountId: resolved.id };
                }
              }
              if (line.accountId && line.accountId !== "uncategorized" && !accountsById.has(line.accountId)) {
                return { ...line, accountId: "uncategorized", accountName: "Manual Review" };
              }
              return line;
            });
          }

          const finalTx = {
            ...txDraft,
            verification: {
              status: 'verified' as const,
              verifiedAt: new Date().toISOString(),
              method: 'manual' as const,
              hash: DoubleEntryAuditor.computeHash(txDraft as any),
              timestamp: new Date().toISOString()
            }
          };
          
          bankLineRecord.matchedTransactionId = newTxId;
          processedTxs.push(finalTx);

          // LEARN: Record as a seen pattern for every line item
          if (finalTx.lines && finalTx.lines.length > 0) {
            finalTx.lines.forEach((line: any) => {
              if (line.accountName && line.accountName !== 'Uncategorized' && line.accountName !== 'Manual Review') {
                const searchDesc = line.description || (finalTx.lines.length === 1 ? finalTx.description : undefined);
                if (searchDesc) {
                  recordRulePattern(searchDesc, line.accountId || 'uncategorized', line.accountName, line.tags, line.dimensions);
                }
              }
            });
          }
        }
        
        bankLineRecords.push(bankLineRecord);
      });

      // Write bank lines in batches
      const BANK_BATCH_SIZE = 400;
      for (let i = 0; i < bankLineRecords.length; i += BANK_BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = bankLineRecords.slice(i, i + BANK_BATCH_SIZE);
        for (const record of chunk) {
          const bRef = doc(db, 'bankLines', record.id);
          batch.set(bRef, record);
        }
        await batch.commit();
      }

      // Post transactions via authenticated server bulk endpoint
      if (processedTxs.length > 0) {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/transactions/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            transactions: processedTxs
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Server rejected bulk transaction import.');
        }
      }

      const current = useLedgerStore.getState().transactions;
      setTransactions([...processedTxs, ...current]);
      toast.success(`Imported ${newTransactions.length} transactions with heuristic mapping.`, { id: loader });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions-batch-import');
      toast.error('Import failed. Transaction sequence aborted.', { id: loader });
    } finally {
      setIsSyncing(false);
    }
  };

  const recordRulePattern = async (description: string, accountId: string, accountName: string, tags?: string[], dimensions?: Record<string, string>) => {
    if (!user || !currentWorkspaceId || !description) return;

    // Do not record rule patterns into archived or inactive accounts
    const currentAccounts = useLedgerStore.getState().accounts;
    const targetAccount = currentAccounts.find(a => a.id === accountId || a.name.toLowerCase() === accountName.toLowerCase());
    if (targetAccount && ((targetAccount as any).archived === true || (targetAccount as any).isArchived === true || targetAccount.isActive === false)) {
      return;
    }
    
    // Normalize to extract the core merchant/pattern (strip dates, long numbers, transaction IDs)
    let cleanDesc = normalizeLabel(description);
    cleanDesc = cleanDesc.replace(/[0-9]{3,}/g, ''); // Remove sequence of 3+ numbers
    cleanDesc = cleanDesc.replace(/[0-9]+[a-z]+[0-9]+/g, ''); // Remove alphanumeric IDs
    cleanDesc = cleanDesc.replace(/[*#]/g, ''); // Remove common bank delimiters
    cleanDesc = normalizeLabel(cleanDesc);
    
    if (cleanDesc.length < 3) return;

    const patternId = cleanDesc.replace(/[^a-z0-9]/g, '_');
    
    try {
      const patternRef = doc(db, 'rulePatterns', `${currentWorkspaceId}_${patternId}`);
      const existingPattern = analyticalPatternCache[cleanDesc] as any;
      const newCount = (existingPattern?.count || 0) + 1;

      // Merge tags and dimensions conservatively
      const combinedTags = Array.from(new Set([...(existingPattern?.tags || []), ...(tags || [])])).slice(0, 5);
      const combinedDimensions = { ...(existingPattern?.dimensions || {}), ...(dimensions || {}) };

      await setDoc(patternRef, {
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        description: cleanDesc,
        accountId,
        accountName,
        tags: combinedTags,
        dimensions: Object.keys(combinedDimensions).length > 0 ? combinedDimensions : undefined,
        count: newCount,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      useLedgerStore.getState().updateAnalyticalMatchCache(
        cleanDesc,
        accountId,
        accountName,
        combinedTags,
        undefined,
        undefined,
        combinedDimensions
      );

      // PROMOTION LOGIC: Auto-create a deterministic rule after 3 occurrences
      if (newCount >= 3) {
        const { autoRules } = useLedgerStore.getState();
        const hasRule = autoRules.some(r => 
          r.condition.descriptionContains?.toLowerCase() === cleanDesc ||
          r.condition.vendor?.toLowerCase() === cleanDesc
        );

        if (!hasRule) {
          await firestoreAddDoc(collection(db, 'autoRules'), {
            uid: user.uid,
            workspaceId: currentWorkspaceId,
            name: `Autonomous Item Rule: ${cleanDesc}`,
            condition: {
              descriptionContains: cleanDesc
            },
            action: {
              type: 'categorize',
              targetNodeId: accountId,
              targetCategory: accountName
            },
            isActive: true,
            createdAt: new Date().toISOString()
          });
          toast.success(`Sub-ledger rule created for "${cleanDesc}"`, {
            description: `Automated link to ${accountName} established.`
          });
        }
      }
    } catch (e) {
      console.warn("Rule learning deferred", e);
    }
  };

  const balanceTransactionLines = (lines: any[], fallbackAmountCents: number): any[] => {
    let finalLines = [...lines];

    // If lines are empty but we have an amount, create a default pair
    if (finalLines.length === 0 && fallbackAmountCents !== 0) {
      // Find default asset account
      const assetAccounts = accounts.filter(a => a.type === 'asset');
      const defaultAsset = assetAccounts.find(a => resolveAccountRole(a) === 'cash') || assetAccounts[0] || accounts[0];

      // Find primary category / expense/income account if any
      const defaultCategory = accounts.find(a => a.type === 'expense' || a.type === 'income') || accounts[0];

      if (defaultCategory && defaultAsset) {
        finalLines = [
          {
            accountId: defaultCategory.id,
            accountName: defaultCategory.name,
            amountCents: fallbackAmountCents,
            description: "Category Allocation"
          },
          {
            accountId: defaultAsset.id,
            accountName: defaultAsset.name,
            amountCents: -fallbackAmountCents,
            description: "Asset Settlement"
          }
        ];
      }
      return finalLines;
    }

    // Check sum of existing lines
    const sum = finalLines.reduce((acc, l) => acc + (l.amountCents || 0), 0);
    if (sum === 0) {
      return finalLines;
    }

    // If all lines are on one side (all positive debits or all negative credits),
    // settle against default asset/cash account
    const allPositive = finalLines.length > 0 && finalLines.every(l => (l.amountCents || 0) > 0);
    const allNegative = finalLines.length > 0 && finalLines.every(l => (l.amountCents || 0) < 0);

    if (allPositive || allNegative) {
      const assetAccounts = accounts.filter(a => a.type === 'asset');
      const defaultAsset = assetAccounts.find(a => resolveAccountRole(a) === 'cash') || assetAccounts[0] || accounts[0];

      if (defaultAsset) {
        finalLines.push({
          accountId: defaultAsset.id,
          accountName: defaultAsset.name,
          amountCents: -sum,
          description: allPositive ? "Asset Settlement" : "Category Allocation"
        });
      }
      return finalLines;
    }

    // If lines already contain both debits and credits, but have an imbalance > 1 cent,
    // do NOT silently absorb into a System Offset. Reject/throw to protect ledger integrity.
    if (Math.abs(sum) > 1) {
      throw new Error(`Double-entry balance violation: Transaction lines are out of balance by $${(Math.abs(sum) / 100).toFixed(2)}.`);
    }

    // Minor penny rounding adjustment (<= 1 cent)
    if (Math.abs(sum) > 0) {
      const assetAccounts = accounts.filter(a => a.type === 'asset');
      const defaultAsset = assetAccounts.find(a => resolveAccountRole(a) === 'cash') || assetAccounts[0] || accounts[0];
      if (defaultAsset) {
        finalLines.push({
          accountId: defaultAsset.id,
          accountName: defaultAsset.name,
          amountCents: -sum,
          description: "Rounding Adjustment"
        });
      }
    }

    return finalLines;
  };

  const handleQuickAdd = useCallback(async (data: Partial<Transaction>) => {
    if (!user || !currentWorkspaceId) return;
    
    // Core App Feature: Integrity Enforcement
    try {
      if (data.lines) {
        TruthEngine.validateAccountingIntegrity(data.lines.map((l: TransactionLine) => ({
          amount: l.amountCents,
          type: l.amountCents > 0 ? 'debit' : 'credit' // Simple mapping for validation demo
        })));
      }
    } catch (e: any) {
      toast.error(e.message);
      return;
    }

    // Core App Feature: Billing and Usage limits
    const checkQuota = useBillingStore.getState().checkQuota;
    const incrementTransaction = useBillingStore.getState().incrementTransaction;
    const currentWorkspace = useAuthStore.getState().getCurrentWorkspace();
    const transactions = useLedgerStore.getState().transactions;
    if (!checkQuota(currentWorkspace?.plan, transactions?.length)) {
      toast.error("Usage Limit Reached: Please upgrade your plan to record more transactions.");
      return;
    }
    
    if (data.date && isPeriodLocked(data.date)) {
      toast.error("Historical freeze active. Cannot inject data into locked periods.");
      return;
    }
    
    const processedLines = balanceTransactionLines(data.lines || [], data.totalAmountCents || 0);
    const balancedData = {
      ...data,
      lines: processedLines
    };

    // Create optimistic ID
    const tempId = `temp-${crypto.randomUUID().split('-')[0]}`;
    const optimisticTx: Transaction = {
      id: tempId,
      uid: user.uid,
      workspaceId: currentWorkspaceId,
      status: 'completed',
      type: 'actual',
      createdAt: new Date().toISOString(),
      description: 'New Transaction',
      totalAmountCents: 0,
      currency: 'USD',
      date: getLocalDateISO(),
      ...balancedData,
      lines: balancedData.lines || []
    };

    // --- Persistent Rule Learning ---
    if (optimisticTx.description && optimisticTx.lines && optimisticTx.lines.length > 0) {
      optimisticTx.lines.forEach((line: any) => {
        if (line.accountName && line.accountName !== 'Uncategorized' && line.accountName !== 'Manual Review') {
          const searchDesc = line.description || (optimisticTx.lines.length === 1 ? optimisticTx.description : undefined);
          if (searchDesc) {
            recordRulePattern(searchDesc, line.accountId || 'unassigned', line.accountName, line.tags, line.dimensions);
          }
        }
      });
    }

    // Double-Entry Integrity Check
    const balance = optimisticTx.lines?.reduce((sum, l) => sum + (l.amountCents || 0), 0) || 0;
    if (balance !== 0) {
      toast.error("Double-entry violation: Debits and Credits must sum to zero.");
      return;
    }

    // --- Autonomous Yearly Tax Law Provisioner ---
    const txYearNum = data.date ? parseInt(data.date.split('-')[0]) : new Date().getFullYear();
    const allTxs = useLedgerStore.getState().transactions;
    const existingYears = new Set(allTxs.map(t => {
      const yearStr = t.date ? t.date.split('-')[0] : '';
      return yearStr ? parseInt(yearStr) : null;
    }).filter(Boolean));

    const isFirstTimeForNewYear = existingYears.size > 0 && !existingYears.has(txYearNum);

    if (isFirstTimeForNewYear) {
      setTimeout(async () => {
        try {
          const batch = writeBatch(db);
          const defaultRates = [
            { name: `FEDERAL COMPLIANCE: ${txYearNum}`, rate: 0.22, type: 'Income' },
            { name: `STATE STATUTORY (SIT): ${txYearNum}`, rate: 0.05, type: 'Income' },
            { name: `METROPOLITAN CITY LEVY: ${txYearNum}`, rate: 0.015, type: 'Sales' },
            { name: `LOCAL COUNTY TRANSIT: ${txYearNum}`, rate: 0.005, type: 'Sales' }
          ];

          defaultRates.forEach(rate => {
            const docRef = doc(collection(db, 'taxRates'));
            batch.set(docRef, {
              ...rate,
              uid: user.uid,
              workspaceId: currentWorkspaceId,
              createdAt: new Date().toISOString()
            });
          });

          await batch.commit();
          toast.success(`Fiscal Horizon ${txYearNum} Active!`, {
            description: `Auto-search locked in. Registered standard progressive bounds, state levies, and city/county margins.`,
            duration: 8000
          });
        } catch (e) {
          console.warn("Autonomous fiscal setup deferred", e);
        }
      }, 500);
    }

    // Deferred to ledger integrity stream
    setIsSyncing(true);

    
    const token = await user?.getIdToken();
    let dataOut, err;
    try {
      const finalTx = {
        ...balancedData,
        id: optimisticTx.id,
        totalAmountCents: Math.round(balancedData.totalAmountCents || 0),
        schemaVersion: '1.1',
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        status: 'completed',
        type: 'actual',
        createdAt: new Date().toISOString()
      };
      // Let's preserve the optimistic ID
      finalTx.id = optimisticTx.id;
      
      const res = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`,
          'x-operation-id': finalTx.id
        },
        body: JSON.stringify({ transaction: finalTx })
      });
      if (!res.ok) {
         const data = await res.json();
         throw new Error(data.error || 'Failed to save transaction');
      }
      dataOut = true; err = null;
    } catch(e: any) {
      err = e;
    }
    if (!err) {
      incrementTransaction();
      toast.success('Transaction added and certified', {
        action: {
          label: 'Undo',
          onClick: () => handleVoidTransaction(optimisticTx.id)
        }
      });
    } else {
      // Handled by true sync errors
      toast.error('Failed to add transaction. Protocol interrupted.');
    }
  }, [user, currentWorkspaceId, isPeriodLocked, recordRulePattern, handleVoidTransaction]);

  const handleBulkUpdate = async (ids: string[], updates: any) => {
    if (!user || !currentWorkspaceId || !ids || ids.length === 0) return;
    
    setIsSyncing(true);
    const loader = toast.loading(`Synchronizing ${ids.length} updates...`);

    try {
      const oldStates = new Map<string, Transaction>();
      const currentTransactions = useLedgerStore.getState().transactions;
      const updatesMap = new Map<string, any>();

      const targetAccount = accounts.find(a => 
        (updates.accountId && a.id === updates.accountId) || 
        (updates.accountName && a.name === updates.accountName)
      );
      const accId = targetAccount?.id || updates.accountId;
      const accName = targetAccount?.name || updates.accountName;
      const projId = updates.project || updates.projectId;

      for (const id of ids) {
        const tx = currentTransactions.find(t => t.id === id);
        if (tx) {
          oldStates.set(id, { ...tx });

          const updateData: Record<string, any> = {
            updatedAt: new Date().toISOString()
          };

          if (updates.isLocked !== undefined) updateData.isLocked = updates.isLocked;
          if (updates.status !== undefined) updateData.status = updates.status;
          if (updates.category !== undefined) updateData['dimensions.category'] = updates.category;
          if (projId !== undefined) {
            updateData['dimensions.project'] = projId;
            updateData.projectId = projId;
          }

          // Handle lines preservation: NEVER drop lines or destroy amounts
          if (accId !== undefined || accName !== undefined || projId !== undefined) {
            const existingLines = tx.lines && tx.lines.length > 0 ? tx.lines : [];
            if (existingLines.length > 0) {
              const newLines = existingLines.map((l: any, idx: number) => {
                const acc = accounts.find(a => a.id === l.accountId);
                const role = resolveAccountRole(acc);
                const isOffsetOrCash = role === 'cash' || (acc?.type === 'asset' && existingLines.length === 2 && idx === 1);
                
                // Modify the primary category / expense / revenue line, or line 0
                if (!isOffsetOrCash || idx === 0) {
                  return {
                    ...l,
                    ...(accId !== undefined ? { accountId: accId } : {}),
                    ...(accName !== undefined ? { accountName: accName } : {}),
                    ...(projId !== undefined ? { project: projId || undefined } : {})
                  };
                }
                if (projId !== undefined) {
                  return { ...l, project: projId || undefined };
                }
                return l;
              });
              updateData.lines = newLines;
            } else if (tx.totalAmountCents) {
              // Balance from scratch if previously unlined
              updateData.lines = balanceTransactionLines([], tx.totalAmountCents);
            }
          }

          updatesMap.set(id, updateData);
        }
      }

      const updatesPayload: { id: string; data: any }[] = [];
      for (const id of ids) {
        const u = updatesMap.get(id);
        if (u) {
          updatesPayload.push({ id, data: u });
        }
      }

      if (updatesPayload.length > 0) {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/transactions/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            workspaceId: currentWorkspaceId,
            updates: updatesPayload
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Server rejected batch updates');
        }
      }

      // Update local state atomically
      useLedgerStore.setState(state => ({
        transactions: state.transactions.map(t => {
          const u = updatesMap.get(t.id);
          if (!u) return t;
          const merged = { ...t, ...u };
          if (u['dimensions.category'] !== undefined || u['dimensions.project'] !== undefined) {
            merged.dimensions = {
              ...t.dimensions,
              ...(u['dimensions.category'] !== undefined ? { category: u['dimensions.category'] } : {}),
              ...(u['dimensions.project'] !== undefined ? { project: u['dimensions.project'] } : {})
            };
          }
          return merged;
        })
      }));
      
      toast.success(`Updated ${ids.length} transactions with atomic finality.`, { 
        id: loader,
        action: {
          label: 'Undo',
          onClick: async () => {
            const undoLoader = toast.loading('Reverting bulk updates...');
            try {
              const undoPayload: { id: string; data: any }[] = [];
              for (const id of ids) {
                const oldState = oldStates.get(id);
                if (oldState) {
                  undoPayload.push({ id, data: oldState });
                }
              }
              if (undoPayload.length > 0) {
                const token = await user.getIdToken();
                const res = await fetch('/api/v1/transactions/batch', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    updates: undoPayload
                  })
                });
                if (!res.ok) {
                  const errData = await res.json().catch(() => ({}));
                  throw new Error(errData.error || 'Server rejected undo batch updates');
                }
              }
              // Revert store state
              useLedgerStore.setState(state => ({
                transactions: state.transactions.map(t => oldStates.get(t.id) || t)
              }));
              toast.success('Bulk update reverted.', { id: undoLoader });
            } catch (err) {
              toast.error('Failed to revert bulk update.', { id: undoLoader });
            }
          }
        }
      });
    } catch (error: any) {
      console.error('Bulk update error:', error);
      const message = error?.message || 'Unknown network error';
      toast.error('Could not complete bulk update.', { 
        id: loader,
        description: `Sequence aborted. (${message})`
      });
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleParseReceipt = async (file: File, transactionId?: string) => {
    const { addParsingItem, updateParsingItem, parsingQueue } = useUIStore.getState();
    
    // 1. Generate Idempotency Key (SHA-256 Hash of content)
    const idempotencyKey = await generateFileHash(file);
    
    // 2. Prevent duplicate processing
    const isDuplicate = parsingQueue.some((item: any) => item.idempotencyKey === idempotencyKey && item.status !== 'error');
    if (isDuplicate) {
      toast.info(`Receipt ${file.name} is already being processed.`);
      return;
    }

    const parsingId = crypto.randomUUID();
    
    addParsingItem({
      id: parsingId,
      idempotencyKey,
      name: file.name,
      status: 'uploading'
    });

    const loader = toast.loading(`Parsing ${file.name}...`);
    
    try {
      updateParsingItem(parsingId, { status: 'parsing' });
      const { analyticalPatternCache, accounts, autoRules, transactions: existingTransactions } = useLedgerStore.getState();
      const currentWorkspace = getCurrentWorkspace();
      const labels = accounts.map(a => a.name);
      const data = await aiService.parseReceipt(file, userKey, analyticalPatternCache, labels);
      
      if (!data) {
        updateParsingItem(parsingId, { status: 'error' });
        toast.error(`Extraction failed for ${file.name}`, { id: loader });
        return;
      }

      // Reconciliation & Summary Row Validation Guard
      const validation = validateReceiptPayload(data);
      if (!validation.valid) {
        updateParsingItem(parsingId, { status: 'error' });
        toast.error(validation.error || 'Receipt validation failed', { id: loader });
        return;
      }
      
      setIsSyncing(true);

      const engine = new MatchingEngine(
        autoRules || [],
        analyticalPatternCache || {},
        user?.uid || '',
        matchingThreshold || 0.85,
        existingTransactions || [],
        dimensionNodes,
        accounts
      );

      const headerDimensions: { world?: string; class?: string; project?: string } = {};
      if (currentWorkspace?.dimensions) {
        const worldDim = currentWorkspace.dimensions.find((d: any) => d.isWorld || d.id === 'world');
        if (worldDim) headerDimensions.world = worldDim.id;
      }

      const debitLines = mapReceiptToCoordinates(data, accounts, engine, headerDimensions);

      if (transactionId) {
        // Attaching receipt to an existing transaction: balance the itemized lines with the settlement leg
        const balancedLines = balanceTransactionLines(debitLines, data.totalAmountCents || 0);

        const success = await handleUpdateTransaction(transactionId, {
          description: data.vendorName,
          totalAmountCents: data.totalAmountCents,
          taxAmountCents: data.taxAmountCents || 0,
          isCleared: true,
          clearedAt: new Date().toISOString(),
          lines: balancedLines
        });

        if (success) {
          toast.success(`${file.name} matched and verified with ${data.lines?.length || 0} items`, { id: loader });
        }
      } else {
        await handleQuickAdd({ 
          description: data.vendorName || 'Receipt Entry',
          totalAmountCents: data.totalAmountCents,
          taxAmountCents: data.taxAmountCents || 0,
          date: data.date || getLocalDateISO(),
          lines: debitLines
        });
        toast.success(`${file.name} processed with ${debitLines.length} line items`, { id: loader });
      }
      
      updateParsingItem(parsingId, { status: 'done' });
      // Cleanup successful items from queue after 5 seconds
      setTimeout(() => {
        const { parsingQueue, setParsingQueue } = useUIStore.getState();
        setParsingQueue(parsingQueue.filter((i: any) => i.id !== parsingId));
      }, 5000);

    } catch (error) {
      updateParsingItem(parsingId, { status: 'error' });
      toast.error(`AI processing failed for ${file.name}`, { id: loader });
    }
  };

  const handleResetWorkspace = async () => {
    if (!user || !currentWorkspaceId) return;
    const confirm = safeConfirm("CRITICAL PROTOCOL: This will permanently purge ALL data in this institutional workspace including transactions, architectural nodes, and forensic records. This cannot be undone. Are you absolutely sure?");
    if (!confirm) return;

    const loader = toast.loading('Initiating deep system reset...');
    try {
      setIsSyncing(true);
      
      const response = await fetch('/api/v1/transactions/reset', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user.getIdToken()}` },
         body: JSON.stringify({ workspaceId: currentWorkspaceId, confirmReset: true })
      });

      if (!response.ok) {
        throw new Error('Failed to reset workspace data on server.');
      }
      
      // Also clear the store immediately to reflect the void state
      useLedgerStore.setState({
          transactions: [],
          accounts: [],
          journalEntries: [],
          computedAccounts: [],
          totalLedgerBalance: 0,
          runningBalances: {
              totalIncome: 0,
              totalExpense: 0,
              totalBalance: 0,
              projectMetrics: {},
              categoryMetrics: {}
          }
      });

      // Clear the isDemoLoaded flag
      await updateDoc(doc(db, 'workspaces', currentWorkspaceId), {
        isDemoLoaded: false
      });

      toast.success('System purged. All topological nodes and records cleared.', { id: loader });
    } catch (error) {
      console.error('Reset Error:', error);
      toast.error('Reset failed partially. Check permissions.', { id: loader });
    } finally {
      setIsSyncing(false);
    }
  };

  


  const handleCloseYear = async (closingDate: string, lockPeriod: boolean = true) => {
    if (!user || !currentWorkspaceId) return;
    const loader = toast.loading('Initiating fiscal year close protocol...');
    try {
      setIsSyncing(true);
      const response = await fetch('/api/v1/transactions/close-year', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({ workspaceId: currentWorkspaceId, closingDate, lockPeriod })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute year-end close.');
      }

      // Add the new transaction to the client-side store
      if (data.transaction) {
        const currentTxs = useLedgerStore.getState().transactions;
        useLedgerStore.getState().setTransactions([...currentTxs, data.transaction]);
      }

      // Add the generated synthetic account if it exists
      if (data.generatedAccount) {
        const currentAccs = useLedgerStore.getState().accounts;
        useLedgerStore.getState().setAccounts([...currentAccs, data.generatedAccount]);
      }

      if (lockPeriod) {
        useLedgerStore.getState().setLockDate(closingDate);
      }

      toast.success(data.message || `Fiscal year closed successfully.`, { id: loader });
      return data;
    } catch (error: any) {
      console.error('Close Year Error:', error);
      toast.error(error.message || 'Year-end close failed.', { id: loader });
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = (transactions: Transaction[]) => {
    const headers = ['Date', 'Transaction ID', 'Description', 'Account ID', 'Account Name', 'Debit', 'Credit', 'Status', 'Project', 'Department'];
    
    const rows: string[][] = [];
    transactions.forEach(t => {
      t.lines.forEach(l => {
        const amt = lineAmount(l, t);
        const debit = amt > 0 ? formatDecimal(amt) : '0.00';
        const credit = amt < 0 ? formatDecimal(Math.abs(amt)) : '0.00';
        rows.push([
          sanitizeCsvCell(t.date),
          sanitizeCsvCell(t.id),
          sanitizeCsvCell(t.description),
          sanitizeCsvCell(l.accountId),
          sanitizeCsvCell(l.accountName),
          sanitizeCsvCell(debit),
          sanitizeCsvCell(credit),
          sanitizeCsvCell(t.status),
          sanitizeCsvCell(t.project || ''),
          sanitizeCsvCell(l.department || '')
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(sanitizeCsvCell), ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `general_ledger_export_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('General Ledger Export completed successfully');
  };

  const handleToggleFlag = async (id: string) => {
    const tx = useLedgerStore.getState().transactions.find(t => t.id === id);
    if (!tx) return;
    
    await fetch(`/api/v1/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
      body: JSON.stringify({ partialUpdate: { isFlagged: !tx.isFlagged, updatedAt: new Date().toISOString() } })
    });
    toast.info(tx.isFlagged ? 'Transaction flag removed' : 'Transaction flagged for review');
  };

  const handleDuplicateTransaction = async (id: string) => {
    const tx = useLedgerStore.getState().transactions.find(t => t.id === id);
    if (!tx) return;

    const { id: _, createdAt: __, verification: ___, ...txData } = tx;
    await handleQuickAdd({ 
      ...txData,
      description: `${txData.description} (Copy)`,
      date: getLocalDateISO()
    });
    toast.success('Transaction duplicated');
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    if (!user || !currentWorkspaceId) return false;
    
    const originalTransactions = [...useLedgerStore.getState().transactions];
    const txIndex = originalTransactions.findIndex(t => t.id === id);
    if (txIndex === -1) return false;

    const tx = originalTransactions[txIndex];
    if (updates.date && isPeriodLocked(updates.date)) {
      toast.error("Period freeze active. Modification blocked.");
      return false;
    }

    // Double-Entry Integrity Check for updates
    if (updates.lines) {
      const balance = updates.lines.reduce((sum, l) => sum + (l.amountCents || 0), 0) || 0;
      if (balance !== 0) {
        toast.error("Double-entry violation: Modified lines are unbalanced.");
        return false;
      }
    }

    // Optimistic Update
    const updatedVerification = tx.verification ? {
      ...tx.verification,
      status: 'unverified' as const,
      timestamp: new Date().toISOString()
    } : undefined;

    const updatedTx = { 
      ...tx, 
      ...updates, 
      ...(updatedVerification ? { verification: updatedVerification } : {}),
      updatedAt: new Date().toISOString() 
    };
    const nextTransactions = [...originalTransactions];
    nextTransactions[txIndex] = updatedTx as Transaction;
    setTransactions(nextTransactions);
    setIsSyncing(true);

    
    const token = await user?.getIdToken();
    try {
      const expectedUpdatedAt = tx.updatedAt;
      const payload = {
        ...tx,
        ...updates,
        ...(updatedVerification ? { verification: updatedVerification } : {}),
        updatedAt: new Date().toISOString()
      };
      const res = await fetch(`/api/v1/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ transaction: payload, expectedUpdatedAt })
      });
      if (!res.ok) {
         const data = await res.json();
         if (res.status === 409 || data.error === 'version_conflict') {
           const err: any = new Error(data.message || 'This transaction was modified by another user.');
           err.isConflict = true;
           err.currentTransaction = data.currentTransaction;
           throw err;
         }
         throw new Error(data.error || 'Failed to update transaction');
      }
    } catch(e: any) {
      if (e.isConflict) {
        toast.error('Version conflict: Transaction modified by another user.', {
          description: 'Your changes were not saved to prevent overwriting someone else\'s updates. Loaded latest version.'
        });
        if (e.currentTransaction) {
          const currentTxs = [...useLedgerStore.getState().transactions];
          const idx = currentTxs.findIndex(t => t.id === id);
          if (idx !== -1) {
            currentTxs[idx] = e.currentTransaction;
            setTransactions(currentTxs);
          }
          return false;
        }
      } else {
        const message = e?.message || 'Unknown network error';
        toast.error('Could not save your changes.', {
          description: `Please try again. (${message})`
        });
      }
      setTransactions(originalTransactions);
      return false;
    }

    await recordAudit('UPDATE_TRANSACTION', 'transaction', id, updates);
      
      toast.success('Transaction updated', {
        action: {
          label: 'Undo',
          onClick: () => handleUpdateTransaction(id, tx)
        }
      });

      // --- Persistent Rule Learning ---
      // If user manually updated the category, check if we should suggest a permanent rule
      if (updates.lines && Array.isArray(updates.lines) && updates.lines.length > 0) {
        const { autoRules, accounts } = useLedgerStore.getState();
        const mainLine = updates.lines[0];
        const description = tx.description;
        
        // Push to autonomous cache for immediate "soft" learning across all lines
        updates.lines.forEach((line: any) => {
          if (line.accountName && line.accountName !== 'Uncategorized' && line.accountName !== 'Manual Review') {
            const searchDesc = line.description || (updates.lines?.length === 1 ? description : undefined);
            if (searchDesc && line.accountId) {
              recordRulePattern(searchDesc, line.accountId, line.accountName, line.tags, line.dimensions);
            }
          }
        });
        
        const existingRule = Array.isArray(autoRules) ? autoRules.find(r => 
          r.condition.descriptionContains?.toLowerCase() === (description || '').toLowerCase() ||
          r.condition.vendor?.toLowerCase() === (description || '').toLowerCase()
        ) : null;

        if (!existingRule && mainLine.accountName && mainLine.accountName !== 'Uncategorized') {
          const account = Array.isArray(accounts) ? accounts.find(a => a.id === mainLine.accountId) : null;
          toast("Pattern detected", {
            description: `Should I always categorize "${description}" as ${mainLine.accountName}?`,
            action: {
              label: "Create Rule",
              onClick: () => handleAddRule({
                condition: { descriptionContains: description },
                action: { 
                  targetNodeId: mainLine.accountId,
                  targetCategory: mainLine.accountName
                },
                confidence: 1.0,
                isHardened: true
              })
            }
          });
        }
      }
      // -------------------------------
      return true;
  };

  const handleReverseTransaction = async (
    id: string,
    reversalDate: string,
    reason: string,
    replacement?: Partial<Transaction>
  ) => {
    if (!user || !currentWorkspaceId) return null;
    const loader = toast.loading('Executing reverse & correct...');
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/v1/transactions/${id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reversalDate,
          reason,
          replacement,
          workspaceId: currentWorkspaceId
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to reverse transaction');
      }

      const data = await res.json();
      const store = useLedgerStore.getState();
      const currentTxs = store.transactions;
      const updatedTxs = currentTxs.map(t => t.id === id ? { ...t, reversalEventId: data.reversal?.id || 'reversed' } : t);

      const toAdd: Transaction[] = [];
      if (data.reversal) toAdd.push(data.reversal);
      if (data.replacement) toAdd.push(data.replacement);

      store.setTransactions([...toAdd, ...updatedTxs]);

      await recordAudit('TRANSACTION_REVERSED', 'transaction', id, {
        reversalId: data.reversal?.id,
        replacementId: data.replacement?.id,
        reason
      });

      toast.success(replacement ? 'Transaction reversed & corrected successfully' : 'Transaction reversed successfully', { id: loader });
      return data;
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse transaction', { id: loader });
      throw err;
    }
  };

  const handleDeleteAccount = async (id: string, force = false) => {
    if (!user || !currentWorkspaceId) return;
    
    // Check if account has transactions
    const txs = useLedgerStore.getState().transactions;
    const jes = useLedgerStore.getState().journalEntries;
    const linkedTxs = txs.filter(t => t.lines?.some(l => l.accountId === id));
    const linkedJes = jes.filter(j => j.lines?.some(l => l.accountId === id));
    const hasTransactions = linkedTxs.length > 0 || linkedJes.length > 0;

    setIsSyncing(true);
    try {
      if (hasTransactions) {
        if (!force) {
          const confirmed = safeConfirm(`This account has ${linkedTxs.length + linkedJes.length} historical records. Deactivating it will preserve all transaction history and balance history while hiding it from active selection. Proceed with deactivation?`);
          if (!confirmed) {
            setIsSyncing(false);
            return;
          }
        }

        // Safely archive account to preserve accounting integrity and prevent security rule violations
        await updateDoc(doc(db, 'chartAccounts', id), {
          isActive: false,
          status: 'archived',
          updatedAt: new Date().toISOString()
        });

        await addDoc(collection(db, 'auditLogs'), {
          uid: user.uid,
          workspaceId: currentWorkspaceId,
          email: user.email,
          action: 'DEACTIVATE_ACCOUNT',
          entityType: 'account',
          entityId: id,
          details: { linkedTransactionsCount: linkedTxs.length },
          timestamp: new Date().toISOString()
        });

        toast.success('Account deactivated and archived (transaction history preserved)');
      } else {
        if (!force) {
          const confirm = safeConfirm("Are you sure you want to delete this account? This action is irreversible.");
          if (!confirm) {
            setIsSyncing(false);
            return;
          }
        }

        await deleteDoc(doc(db, 'chartAccounts', id));

        await addDoc(collection(db, 'auditLogs'), {
          uid: user.uid,
          workspaceId: currentWorkspaceId,
          email: user.email,
          action: 'DELETE_EMPTY_ACCOUNT',
          entityType: 'account',
          entityId: id,
          timestamp: new Date().toISOString()
        });

        toast.success('Account node decommissioned');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `chartAccounts/${id}`);
      toast.error('Decommissioning sequence failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconcileMatch = async (bankLineId: string, transactionId: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/v1/transactions/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
        body: JSON.stringify({ workspaceId: currentWorkspaceId, operations: [
          { type: 'updateBankLine', id: bankLineId, data: { status: 'matched', matchedTransactionId: transactionId } },
          { type: 'updateTransaction', id: transactionId, data: { status: 'reconciled' } }
        ]})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error on match');
      toast.success('Alignment confirmed and certified.');
    } catch (error: any) {
      toast.error('Matching cycle failed: ' + (error?.message || 'Network error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconcileIgnore = async (bankLineId: string) => {
    if (!user || !currentWorkspaceId) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/v1/transactions/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
          body: JSON.stringify({ 
            workspaceId: currentWorkspaceId, 
            operations: [{ type: 'updateBankLine', id: bankLineId, data: { status: 'ignored' } }] 
          })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error on ignore');
      toast.info('Item ignored');
    } catch (error: any) {
      toast.error('Action failed: ' + (error?.message || 'Network error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconcileCreate = async (bankLine: BankStatementLine) => {
    if (!user || !currentWorkspaceId) return;
    setIsSyncing(true);
    try {
      const txId = doc(collection(db, 'transactions')).id;
      const targetAccId = accounts.find(a => a.type === 'expense' || a.category === 'Operations')?.id || accounts[0]?.id;
      if (!targetAccId) throw new Error('No valid account node found to target.');
      
      const rawLines = [{ accountId: targetAccId, accountName: 'General Expense', amountCents: bankLine.amountCents }];
      const balancedLines = balanceTransactionLines(rawLines, bankLine.amountCents);

      const txData = {
        id: txId,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        date: bankLine.date,
        description: bankLine.description,
        totalAmountCents: Math.abs(bankLine.amountCents),
        status: 'reconciled',
        type: 'actual',
        createdAt: new Date().toISOString(),
        lines: balancedLines
      };

      const res = await fetch('/api/v1/transactions/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
        body: JSON.stringify({ workspaceId: currentWorkspaceId, operations: [
          { type: 'createTransaction', id: txId, data: txData },
          { type: 'updateBankLine', id: bankLine.id, data: { status: 'matched', matchedTransactionId: txId } }
        ]})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to synthesize transaction');
      toast.success('Atomic transaction synthesized and reconciled.');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'bankLines/synthesis');
      toast.error('Synthesis cycle interrupted: ' + (error?.message || 'Network error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconcileUndo = async (bankLineId: string, transactionId?: string) => {
    setIsSyncing(true);
    try {
      const operations: any[] = [{ type: 'updateBankLine', id: bankLineId, data: { status: 'pending', matchedTransactionId: null } }];
      if (transactionId) {
         operations.push({ type: 'updateTransaction', id: transactionId, data: { status: 'completed' } });
      }
      const res = await fetch('/api/v1/transactions/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
        body: JSON.stringify({ workspaceId: currentWorkspaceId, operations })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to revert reconcile alignment');
      }
      toast.success('Alignment reverted successfully. Re-inserted into potential pipeline matches.');
    } catch (error) {
      toast.error('Failed to undo match.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddRule = async (data: any) => {
    if (!user || !currentWorkspaceId) return;
    try {
      await addDoc(collection(db, 'autoRules'), {
        ...data,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        createdAt: new Date().toISOString()
      });
      toast.success('Categorization rule synced');
    } catch (error) {
      toast.error('Failed to save rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'autoRules', id));
      toast.success('Rule removed');
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const handleUpdateRule = async (id: string, updates: Partial<AutoRule>) => {
    try {
      await updateDoc(doc(db, 'autoRules', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      toast.success('Rule configuration updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `autoRules/${id}`);
      toast.error('Failed to update rule');
    }
  };

  const handleApplyRules = async (ruleIds: string[]) => {
    if (!user || !currentWorkspaceId) return;
    setIsSyncing(true);
    const loader = toast.loading('Initiating rule execution sequence...');
    
    // Store original state for rollback if needed
    const originalTransactions = [...useLedgerStore.getState().transactions];

    try {
      const qRules = query(
        collection(db, 'autoRules'), 
        where('workspaceId', '==', currentWorkspaceId),
        where('uid', '==', user.uid)
      );
      const rulesSnap = await getDocs(qRules);
      const activeRules = rulesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(r => ruleIds.includes(r.id));

      if (activeRules.length === 0) {
        toast.info('No active rules found to apply.', { id: loader });
        return;
      }

      // Build search engine
      const patterns = activeRules.flatMap(r => {
        const p: any[] = [];
        if (r.condition.descriptionContains) p.push({ pattern: r.condition.descriptionContains, ruleId: r.id });
        if (r.condition.vendor) p.push({ pattern: r.condition.vendor, ruleId: r.id });
        return p;
      });
      
      const acSearch = patterns.length > 0 ? new AhoCorasick(patterns) : null;
      if (!acSearch) {
        toast.info('No rule patterns to match.', { id: loader });
        return;
      }

      let count = 0;
      const accountMap = new Map(accounts.map(a => [a.id, a]));
      const ruleMap = new Map(activeRules.map(r => [r.id, r]));
      const updatesToPost: { id: string; data: any }[] = [];

      const localUpdatedTxs = originalTransactions.map(tx => {
        let matchingRuleId: string | null = null;
        
        // First, use string matching
        const results = acSearch ? acSearch.search(tx.description) : [];
        const candidateRuleIds = results;

        // Also check all active rules to see if they pass purely via numeric/date match without text
        activeRules.forEach(r => {
           const hasTextCond = !!(r.condition.descriptionContains || r.condition.vendor);
           if (!hasTextCond && !candidateRuleIds.includes(r.id)) {
               candidateRuleIds.push(r.id);
           }
        });

        // Evaluate the full matrix for each candidate
        for (const ruleId of candidateRuleIds) {
          const rule = ruleMap.get(ruleId);
          if (!rule) continue;

          let isMatch = true;
          
          if (rule.condition.vendor && !tx.description.toLowerCase().includes(rule.condition.vendor.toLowerCase())) {
              isMatch = false;
          }
          if (rule.condition.descriptionContains && !tx.description.toLowerCase().includes(rule.condition.descriptionContains.toLowerCase())) {
              isMatch = false;
          }

          // Numeric logic
          const amt = Math.abs(tx.totalAmountCents);
          if (rule.condition.amountThreshold && amt < rule.condition.amountThreshold) isMatch = false;
          if (rule.condition.exactAmount && amt !== rule.condition.exactAmount) isMatch = false;
          
          // Date logic
          if (rule.condition.dateRange) {
            const d = parseLocalDate(tx.date);
            const start = parseLocalDate(rule.condition.dateRange.start);
            const end = parseLocalDate(rule.condition.dateRange.end);
            if (d < start || d > end) isMatch = false;
          }

          if (isMatch) {
            matchingRuleId = rule.id;
            break;
          }
        }

        if (matchingRuleId) {
          const matchingRule = ruleMap.get(matchingRuleId);
          const account = accountMap.get(matchingRule?.action.targetNodeId);
          
          const updatedTx = {
            ...tx,
            // Apply target status if flagged for review
            status: matchingRule?.action.flagForReview ? 'flagged' : tx.status,
            // Apply Class & Location
            classId: matchingRule?.action.targetClass || tx.classId,
            locationId: matchingRule?.action.targetLocation || tx.locationId,
            lines: tx.lines.map((line, idx) => {
               if (idx === 0 && account) {
                   return {
                      ...line,
                      accountId: account.id,
                      accountName: account.name
                   };
               }
              if (line.accountId && line.accountId !== "uncategorized" && !accountMap.has(line.accountId)) {
                return { ...line, accountId: "uncategorized", accountName: "Manual Review" };
              }
               return line;
            }),
            updatedAt: new Date().toISOString()
          };
          
          updatesToPost.push({
            id: tx.id,
            data: {
              lines: updatedTx.lines,
              status: updatedTx.status,
              classId: updatedTx.classId,
              locationId: updatedTx.locationId
            }
          });
          count++;
          return updatedTx;
        }
        return tx;
      });

      if (updatesToPost.length > 0) {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/transactions/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ workspaceId: currentWorkspaceId, updates: updatesToPost })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Server rejected batch rule updates');
        }
      }

      if (count > 0) {
        setTransactions(localUpdatedTxs);
        toast.success(`Rule mapping complete. ${count} transactions identified and updated.`, { id: loader });
      } else {
        toast.info('Scan finished. No matching patterns found.', { id: loader });
      }
    } catch (error) {
      console.error(error);
      setTransactions(originalTransactions); // Rollback
      toast.error('Rule execution aborted.', { id: loader });
    }
  };

  const handleBulkRepair = async (repairedTxs: Transaction[]) => {
    if (!user || !currentWorkspaceId) return;
    const loader = toast.loading('Synchronizing re-serialized chain...');
    
    try {
      const batchRepair = repairedTxs.map(tx => ({ id: tx.id, data: { verification: tx.verification } }));
      if (batchRepair.length > 0) {
         const res = await fetch('/api/v1/transactions/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
            body: JSON.stringify({ workspaceId: currentWorkspaceId, updates: batchRepair })
         });
         if (!res.ok) throw new Error('Batch repair API rejected updates');
      }
      toast.success('Ledger chain cryptographically certified.', { id: loader });
    } catch (error: any) {
      toast.error('Sync failed: ' + (error?.message || 'Network error'), { id: loader });
    }
  };

  const handleAutoReconcile = async () => {
    if (!user || !currentWorkspaceId) return;
    setIsSyncing(true);
    const loader = toast.loading('Initiating auto-reconciliation...');
    
    try {
      const qBank = query(
        collection(db, 'bankLines'), 
        where('workspaceId', '==', currentWorkspaceId), 
        where('uid', '==', user.uid),
        where('status', '==', 'pending')
      );
      const qTx = query(
        collection(db, 'transactions'), 
        where('workspaceId', '==', currentWorkspaceId), 
        where('uid', '==', user.uid)
      );
      
      const [bankSnap, txSnap] = await Promise.all([getDocs(qBank), getDocs(qTx)]);
      const bankLines = bankSnap.docs.map(d => ({ id: d.id, ...d.data() } as BankStatementLine));
      const transactions = txSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Transaction))
        .filter(t => t.status !== 'reconciled' && t.status !== 'void');
      
      const minHash = new MinHash(64, user?.uid);
      let matchCount = 0;

      // Pre-calculate signatures for transactions
      const txSignatures = transactions.map(tx => ({
        id: tx.id,
        sig: minHash.createSignature(`${tx.description} ${tx.totalAmountCents}`)
      }));

      // 1. Calculate Score Matrix for all possible pairs
      const sourceItems = bankLines.map(bl => {
        const scoreMap = new Map<string, number>();
        const blSig = minHash.createSignature(`${bl.description} ${bl.amountCents}`);
        const blDescClean = (bl.description || '').toLowerCase().replace(/[^a-z0-9 \u0590-\u05FF]/g, '').trim();
        
        transactions.filter(isPostable).forEach((tx, idx) => {
          // Check sign direction:
          const cashLines = tx.lines?.filter(l => {
            const acc = accounts.find(a => a.id === l.accountId);
            return acc && resolveAccountRole(acc) === 'cash';
          }) || [];
          const cashDelta = cashLines.reduce((s, l) => s + lineAmount(l, tx), 0);

          // If transaction has explicit cash lines, cash movement direction MUST match bank line sign!
          if (cashDelta !== 0 && Math.sign(cashDelta) !== Math.sign(bl.amountCents)) {
            return; // Skip incompatible cash directions
          }

          let score = 0;
          
          // Amount Match
          const tTotal = Math.round(Math.abs(tx.totalAmountCents || 0) * (tx.exchangeRate || 1));
          if (Math.abs(bl.amountCents) === tTotal) {
            score += 65;
          }

          // Date Proximity
          const bDate = parseLocalDate(bl.date).getTime();
          const tDate = parseLocalDate(tx.date).getTime();
          const dayDiff = Math.abs(bDate - tDate) / (1000 * 60 * 60 * 24);
          if (dayDiff <= 7) score += (7 - dayDiff) * 3;

          // Description Similarity (Hybrid: MinHash + Jaro-Winkler)
          const txDescClean = (tx.description || '').toLowerCase().replace(/[^a-z0-9 \u0590-\u05FF]/g, '').trim();
          const similarityMinHash = minHash.compare(blSig, txSignatures[idx].sig);
          const similarityJW = jaroWinklerSimilarity(blDescClean, txDescClean, user?.uid);
          
          const combinedSimilarity = (similarityMinHash * 0.3) + (similarityJW * 0.7);
          
          if (combinedSimilarity > 0.3) {
             score += combinedSimilarity * 45;
          }

          // Require a minimum combined similarity threshold (0.35) or higher score to prevent false amount-only matches
          if (score >= 75 && (combinedSimilarity >= 0.35 || dayDiff <= 2)) {
            scoreMap.set(tx.id, score);
          }
        });

        return { id: bl.id, scoreMap };
      });

      // 2. Resolve via Global Optimum Algorithm
      const relevantTargets = new Set<string>();
      sourceItems.forEach(item => {
        for (const key of item.scoreMap.keys()) relevantTargets.add(key);
      });
      const targetIds = Array.from(relevantTargets);
      
      const optimalMatches = findGlobalOptimalMatch(sourceItems, targetIds);
      const batchReconcile: any[] = [];

      // 3. Apply Matches
      optimalMatches.forEach((txId, blId) => {
        batchReconcile.push(
          { type: 'updateBankLine', id: blId, data: { status: 'matched', matchedTransactionId: txId } },
          { type: 'updateTransaction', id: txId, data: { status: 'reconciled' } }
        );
        matchCount++;
      });

      if (batchReconcile.length > 0) {
         const res = await fetch('/api/v1/transactions/reconcile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await user?.getIdToken()}` },
            body: JSON.stringify({ workspaceId: currentWorkspaceId, operations: batchReconcile })
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Server rejected auto-reconcile operations');
      }

      if (matchCount > 0) {
        toast.success(`Optimal alignment complete. ${matchCount} nodes synchronized.`, { id: loader });
      } else {
        toast.info('Scan complete. No high-confidence matches found.', { id: loader });
      }
    } catch (error: any) {
      toast.error('Reconciliation cycle interrupted: ' + (error?.message || 'Error occurred'), { id: loader });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIntegrityAction = async (action: string, _details?: any) => {
    if (!user || !currentWorkspaceId) return;

    if (action === 'repair-chain') {
      const q = query(
        collection(db, 'transactions'), 
        where('workspaceId', '==', currentWorkspaceId),
        where('uid', '==', user.uid)
      );
      const snap = await getDocs(q);
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const repaired = DoubleEntryAuditor.repairChain(txs);
      await handleBulkRepair(repaired);
    } else if (action === 'prune-range') {
      toast.info('Analyzing orphaned nodes...');
    }
  };

  return useMemo(() => ({ 
    handleVoidTransaction, 
    handleImportTransactions, 
    handleQuickAdd, 
    handleUpdateTransaction,
    handleReverseTransaction,
    handleDuplicateTransaction,
    handleBulkUpdate,
    handleParseReceipt,
    handleResetWorkspace,
    
    handleExport,
    handleCloseYear,
    handleCloseMonth: async (dateStr: string | null) => {
      if (!user || !currentWorkspaceId) return;
      
      const loader = toast.loading('Applying fiscal period lock...');
      try {
        setIsSyncing(true);
        // Extract YYYY-MM from YYYY-MM-DD
        const month = dateStr ? dateStr.substring(0, 7) : '';
        
        if (!month) {
          throw new Error("Invalid month format for period lock.");
        }

        const response = await fetch('/api/v1/transactions/close-month', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await user.getIdToken()}`
          },
          body: JSON.stringify({ workspaceId: currentWorkspaceId, month })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to close month.');
        }

        useLedgerStore.getState().setLockDate(data.closingDate);
        toast.success(data.message || `Month closed successfully.`, { id: loader });
      } catch (error: any) {
        toast.error(error.message || 'Month-end close failed.', { id: loader });
      } finally {
        setIsSyncing(false);
      }
    },
    handleReconcileMatch,
    handleReconcileIgnore,
    handleReconcileCreate,
    handleReconcileUndo,
    handleAutoReconcile,
    handleAddRule,
    handleDeleteRule,
    handleDeleteAccount,
    handleUpdateRule,
    handleApplyRules,
    handleBulkRepair,
    handleIntegrityAction,
    handleToggleFlag,
    handleProcessDueRecurring: async () => {
      if (!user || !currentWorkspaceId) return { count: 0 };
      const loader = toast.loading('Triggering server recurring transaction processing...');
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/system/recurring/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'Failed to process recurring transactions.');
        }

        const data = await res.json();
        const processedCount = data.data?.processedCount ?? 0;
        if (processedCount === 0) {
          toast.info('No recurring transactions due at this time.', { id: loader });
        } else {
          toast.success(`Successfully posted ${processedCount} recurring transaction(s).`, { id: loader });
        }
        return { count: processedCount };
      } catch (err: any) {
        console.error('Failed to process recurring transactions:', err);
        toast.error(err.message || 'Failed to process recurring transactions.', { id: loader });
        return { count: 0 };
      }
    },
    handleSmartCluster: async () => {
      if (!user || !currentWorkspaceId) return;
      const loader = toast.loading('Calculating transaction clusters...');
      try {
        const txs = (useLedgerStore.getState().transactions || []).filter(isPostable);
        const uncategorized = txs.filter(t => t.lines?.[0]?.accountId === 'uncategorized');
        
        if (uncategorized.length < 5) {
          toast.info('Insufficient data for statistical clustering.', { id: loader });
          return;
        }

        // Feature Engineering: Normalized Amount and Normalized Time
        const maxAmount = txs.reduce((max, t) => {
          const amt = Math.abs(Math.round((t.totalAmountCents || 0) * (t.exchangeRate || 1)));
          return amt > max ? amt : max;
        }, 0);
        
        const minTime = txs.reduce((min, t) => {
          const time = parseLocalDate(t.date).getTime();
          return time < min ? time : min;
        }, Infinity);
        
        const maxTime = txs.reduce((max, t) => {
          const time = parseLocalDate(t.date).getTime();
          return time > max ? time : max;
        }, 0);
        
        const timeRange = maxTime - minTime || 1;

        const clusterData = uncategorized.map(t => ({
          id: t.id,
          x: Math.abs(Math.round((t.totalAmountCents || 0) * (t.exchangeRate || 1))) / (maxAmount || 1),
          y: (parseLocalDate(t.date).getTime() - minTime) / timeRange
        }));

        const k = Math.min(5, Math.ceil(uncategorized.length / 10));
        const clusters = kMeans(clusterData, k);
        
        toast.success(`Discovered ${k} distinct spending patterns.`, { id: loader });
        return clusters;
      } catch (e) {
        toast.error('Cluster analysis failed.', { id: loader });
      }
    }
  }), [user, currentWorkspaceId, accounts, analyticalPatternCache, getCurrentWorkspace, setIsSyncing]);
}
