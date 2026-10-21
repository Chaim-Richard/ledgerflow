import { errorMessage } from '../../lib/errorRemedies';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { useState, useMemo, useEffect } from 'react';

import { parseLocalDate } from '../../lib/utils';
import { useTimeout } from '../../hooks/useTimeout';
import { resolveAccountRole } from '../../lib/accountUtils';

import { jaroWinklerSimilarity, findGlobalOptimalMatch } from '../../lib/algorithms';
import { toast } from 'sonner';
import { isPostable, lineAmount } from '../../lib/txFilters';

import type { BankLineActionTarget } from './BankLineActionDialog';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';

export function useReconciliationModel() {
  const user = useAuthStore(s => s.user);
  useAuthStore(s => s.currentWorkspaceId);
  const transactions = useLedgerStore(s => s.transactions);
  const bankLines = useLedgerStore(s => s.bankLines || []);
  const accounts = useLedgerStore(s => s.accounts);
  useLedgerCollections('bankLines');
  const txActions = useTransactionActions();
  const onMatch = txActions.handleReconcileMatch;
  const onIgnore = txActions.handleReconcileIgnore;
  const onAddFromBank = txActions.handleReconcileCreate;
  const onAutoReconcile = txActions.handleAutoReconcile;
  const onUndoMatch = txActions.handleReconcileUndo;
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);
  const [matchToleranceCents] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoReconciling, setIsAutoReconciling] = useState(false);

  // Tab view: pending matching streams vs synchronized matched history logs
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');

  // Custom filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [bankLineAction, setBankLineAction] = useState<BankLineActionTarget | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Granular checkable state for the smart auto-alignment bulk modal
  const [selectedBatchIds, setSelectedBatchIds] = useState<Record<string, boolean>>({});
  const { setSafeTimeout } = useTimeout();

  const safeBankLines = useMemo(() => Array.isArray(bankLines) ? bankLines : [], [bankLines]);
  const safeTransactions = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);
  const safeAccounts = useMemo(() => Array.isArray(accounts) ? accounts : [], [accounts]);

  const cashAccounts = useMemo(() => safeAccounts.filter(a => resolveAccountRole(a) === 'cash'), [safeAccounts]);

  // Active pending statement lines
  const unmatchedBankLines = useMemo(() => {
    return safeBankLines.filter(line => line.status === 'pending' && (selectedAccountId === 'all' || !line.accountId || line.accountId === selectedAccountId));
  }, [safeBankLines, selectedAccountId]);

  // Synchronized matched statement lines (History)
  const matchedBankLines = useMemo(() => {
    return safeBankLines.filter(line => line.status === 'matched' && (selectedAccountId === 'all' || !line.accountId || line.accountId === selectedAccountId));
  }, [safeBankLines, selectedAccountId]);

  // Share of in-scope statement lines already matched. Numerator and denominator use the same
  // account-scoped population; ignored lines are excluded so they cannot count as reconciled.
  const reconciledPercent = useMemo(() => {
    const matched = matchedBankLines.length;
    const total = matched + unmatchedBankLines.length;
    return total === 0 ? 0 : Math.round((matched / total) * 100);
  }, [matchedBankLines, unmatchedBankLines]);

  // Uncleared internal ledger transactions (excluding void and reconciled)
  const unclearedLedgerTransactions = useMemo(() => {
    return safeTransactions.filter(tx => {
      if (!isPostable(tx) || tx.status === 'reconciled') return false;
      if (selectedAccountId !== 'all') {
        const touchesAccount = tx.lines?.some((l) => l.accountId === selectedAccountId);
        if (!touchesAccount) return false;
      }
      return true;
    });
  }, [safeTransactions, selectedAccountId]);

  // AI/Heuristic dynamic suggestion index maps
  const aiSuggestionsMap = useMemo(() => {
    if (unmatchedBankLines.length === 0 || unclearedLedgerTransactions.length === 0) return [];

    const sourceItems = unmatchedBankLines.map(btx => {
      const scoreMap = new Map<string, number>();

      unclearedLedgerTransactions.forEach(ltx => {
        // Sign direction validation for cash account movement
        const cashLines = ltx.lines?.filter((l) => {
          const acc = safeAccounts.find(a => a.id === l.accountId);
          return acc && resolveAccountRole(acc) === 'cash';
        }) || [];
        const cashDelta = cashLines.reduce((s: number, l) => s + lineAmount(l, ltx), 0);

        // Disallow matching positive bank deposits with negative cash outflows and vice versa
        if (cashDelta !== 0 && Math.sign(cashDelta) !== Math.sign(btx.amountCents)) {
          return;
        }

        let score = 0;

        // Exact Amount Match (High Weight)
        if (Math.abs(ltx.totalAmountCents) === Math.abs(btx.amountCents)) {
          score += 100;
        } else if (Math.abs(Math.abs(ltx.totalAmountCents) - Math.abs(btx.amountCents)) <= matchToleranceCents) {
          score += 30; // Near match / tiny difference
        }

        // Description Similarity (Jaro-Winkler)
        const descSimilarity = jaroWinklerSimilarity(btx.description, ltx.description, user?.uid);
        score += descSimilarity * 65;

        // Date Proximity
        const bDate = parseLocalDate(btx.date).getTime();
        const lDate = parseLocalDate(ltx.date).getTime();
        if (!isNaN(bDate) && !isNaN(lDate)) {
          const dayDiff = Math.abs(bDate - lDate) / (1000 * 60 * 60 * 24);
          if (dayDiff === 0) score += 30;
          else if (dayDiff <= 3) score += 18;
          else if (dayDiff <= 7) score += 8;
        }

        // Require similarity > 0.3 or dateDiff <= 2 to prevent pure amount-only false positives
        const bDateMs = parseLocalDate(btx.date).getTime();
        const lDateMs = parseLocalDate(ltx.date).getTime();
        const dDiff = (!isNaN(bDateMs) && !isNaN(lDateMs)) ? Math.abs(bDateMs - lDateMs) / (1000 * 60 * 60 * 24) : 99;

        if (score > 115 && (descSimilarity >= 0.3 || dDiff <= 2)) { // Threshold for considering it a strong match candidate
          scoreMap.set(ltx.id, score);
        }
      });

      return { id: btx.id, scoreMap };
    });

    return sourceItems;
  }, [unmatchedBankLines, unclearedLedgerTransactions, user?.uid, matchToleranceCents, safeAccounts]);

  const optimizedMatches = useMemo(() => {
     if (!aiSuggestionsMap || !Array.isArray(aiSuggestionsMap)) return new Map();

     const relevantTargets = new Set<string>();
     aiSuggestionsMap.forEach(item => {
        for (const key of item.scoreMap.keys()) relevantTargets.add(key);
     });

     return findGlobalOptimalMatch(aiSuggestionsMap, Array.from(relevantTargets));
  }, [aiSuggestionsMap]);

  // Initialize checkboxes for smart bulk matching modal when it opens
  useEffect(() => {
    if (showAutoConfirm) {
      const state: Record<string, boolean> = {};
      unmatchedBankLines.forEach(btx => {
        if (optimizedMatches.get(btx.id)) {
          state[btx.id] = true;
        }
      });
      setSafeTimeout(() => setSelectedBatchIds(state), 0);
    }
  }, [showAutoConfirm, unmatchedBankLines, optimizedMatches, setSafeTimeout]);

  // Execute confirmation for selected batch elements
  const executeSelectedBatchMatches = async () => {
    setIsProcessing(true);
    let matchedCount = 0;

    // Filter only those selected by checkboxes
    const pairsToMatch = unmatchedBankLines.map(btx => {
        const ltxId = optimizedMatches.get(btx.id);
        const isChecked = selectedBatchIds[btx.id];
        return { bankId: btx.id, ledgerId: ltxId, isChecked };
    }).filter(p => p.ledgerId && p.isChecked);

    if (pairsToMatch.length === 0) {
        toast.info("No matches selected.");
        setIsProcessing(false);
        return;
    }

    try {
        for (const pair of pairsToMatch) {
           await onMatch(pair.bankId, pair.ledgerId!);
           matchedCount++;
        }
        toast.success(`${matchedCount} match${matchedCount === 1 ? "" : "es"} applied.`);
        setShowAutoConfirm(false);
    } catch (err) {
        toast.error("Could not apply the matches.", {
          description: `Please try again. (${errorMessage(err) || 'Network error'})`
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleAutoReconcile = async () => {
    setIsAutoReconciling(true);
    try {
       // The action layer reports its own completion toasts (with the applied count, or no-match).
       await onAutoReconcile({ bankLines: unmatchedBankLines, transactions: unclearedLedgerTransactions });
    } catch (e) {
        toast.error("Could not finish automatic matching.", {
          description: `Please try again. (${errorMessage(e) || 'Network error'})`
        });
    } finally {
       setIsAutoReconciling(false);
    }
  };

  // Revert / Undo a confirmed reconciliation link
  const handleUndoAlignment = async (bankLineId: string, matchedTxId?: string) => {
    if (!onUndoMatch) {
      toast.error("Undoing matches is not available in this workspace.");
      return;
    }

    setIsProcessing(true);
    try {
      await onUndoMatch(bankLineId, matchedTxId);
    } catch (e) {
      toast.error("Could not undo the match: " + errorMessage(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedBankLine = useMemo(() => {
    if (viewMode === 'pending') {
      return unmatchedBankLines.find(b => b.id === selectedBankId);
    } else {
      return matchedBankLines.find(b => b.id === selectedBankId);
    }
  }, [unmatchedBankLines, matchedBankLines, selectedBankId, viewMode]);

  const selectedLedgerTx = useMemo(() => {
    if (viewMode === 'pending') {
      return unclearedLedgerTransactions.find(l => l.id === selectedLedgerId);
    } else {
      const matchTxId = selectedBankLine?.matchedTransactionId;
      return safeTransactions.find(tx => tx.id === matchTxId);
    }
  }, [unclearedLedgerTransactions, safeTransactions, selectedLedgerId, selectedBankLine, viewMode]);

  // DUAL-VERIFIER ALIGNMENT MATRIX METRICS
  const checkSimilarity = useMemo(() => {
    if (!selectedBankLine || !selectedLedgerTx) return { textScore: 0, dateDiff: 0, amountDiff: 0, overall: 0 };

    // Description similarity
    const textScore = Math.round(jaroWinklerSimilarity(selectedBankLine.description, selectedLedgerTx.description, user?.uid) * 100);

    // Date Difference
    const bDate = parseLocalDate(selectedBankLine.date).getTime();
    const lDate = parseLocalDate(selectedLedgerTx.date).getTime();
    let dateDiff = 99;
    if (!isNaN(bDate) && !isNaN(lDate)) {
      dateDiff = Math.abs(bDate - lDate) / (1000 * 60 * 60 * 24);
    }

    // Amount difference
    const amountDiff = Math.abs(selectedBankLine.amountCents) - Math.abs(selectedLedgerTx.totalAmountCents);

    // Compute heuristic overall probability
    let overall = 0;
    if (amountDiff === 0) overall += 50;
    else if (Math.abs(amountDiff) < 100) overall += 25; // negligible difference

    overall += Math.max(0, 40 - (dateDiff * 8)); // Date penalty
    overall += (textScore * 0.1); // text likeness

    return {
      textScore,
      dateDiff,
      amountDiff,
      overall: Math.min(100, Math.round(overall))
    };
  }, [selectedBankLine, selectedLedgerTx, user?.uid]);

  // Filter pending feeds
  const filteredBankFeed = useMemo(() => {
    const list = viewMode === 'pending' ? unmatchedBankLines : matchedBankLines;
    if (!searchQuery) return list;
    return list.filter(b =>
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.amountCents.toString().includes(searchQuery)
    );
  }, [unmatchedBankLines, matchedBankLines, searchQuery, viewMode]);

  const filteredLedgerEntries = useMemo(() => {
    if (!searchQuery) return unclearedLedgerTransactions;
    return unclearedLedgerTransactions.filter(l =>
      l.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.totalAmountCents.toString().includes(searchQuery)
    );
  }, [unclearedLedgerTransactions, searchQuery]);

  return { bankLines, accounts, onMatch, onIgnore, onAddFromBank, selectedBankId, setSelectedBankId, selectedLedgerId, setSelectedLedgerId, showAutoConfirm, setShowAutoConfirm, isProcessing, isAutoReconciling, viewMode, setViewMode, searchQuery, setSearchQuery, bankLineAction, setBankLineAction, selectedAccountId, setSelectedAccountId, selectedBatchIds, setSelectedBatchIds, safeTransactions, cashAccounts, unmatchedBankLines, matchedBankLines, reconciledPercent, unclearedLedgerTransactions, optimizedMatches, executeSelectedBatchMatches, handleAutoReconcile, handleUndoAlignment, selectedBankLine, selectedLedgerTx, checkSimilarity, filteredBankFeed, filteredLedgerEntries };
}
