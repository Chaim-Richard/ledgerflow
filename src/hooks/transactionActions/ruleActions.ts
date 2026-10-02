import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from '../../lib/db/firestore';
import { db } from '../../firebase';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { Transaction, AutoRule, ChartAccount } from '../../types';
import { toast } from 'sonner';
import { parseLocalDate } from '../../lib/utils';
import { AhoCorasick } from '../../lib/algorithms';
import { handleFirestoreError, OperationType } from '../../lib/firebaseUtils';
import type { ActionContext } from './shared';

/** Automation rules: add, change, delete and apply to existing entries. (F-05, moved from useTransactionActions.) */
export function createRuleActions(ctx: ActionContext) {
  const { user, currentWorkspaceId, setTransactions, accounts, setIsSyncing } = ctx;

  const handleAddRule = async (data: Partial<AutoRule>) => {
    if (!user || !currentWorkspaceId) return;
    try {
      await addDoc(collection(db, 'autoRules'), {
        ...data,
        uid: user.uid,
        workspaceId: currentWorkspaceId,
        createdAt: new Date().toISOString()
      });
      toast.success('Categorization rule synced');
    } catch {
      toast.error('Failed to save rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'autoRules', id));
      toast.success('Rule removed');
    } catch {
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
        .map(d => ({ id: d.id, ...d.data() } as AutoRule))
        .filter(r => ruleIds.includes(r.id));

      if (activeRules.length === 0) {
        toast.info('No active rules found to apply.', { id: loader });
        return;
      }

      // Build search engine
      const patterns = activeRules.flatMap(r => {
        const p: { pattern: string; ruleId: string }[] = [];
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
      const accountMap = new Map<string | undefined, ChartAccount>(accounts.map(a => [a.id, a]));
      const ruleMap = new Map(activeRules.map(r => [r.id, r]));
      const updatesToPost: { id: string; data: Partial<Transaction> }[] = [];

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

  return { handleAddRule, handleDeleteRule, handleUpdateRule, handleApplyRules };
}

export type RuleActions = ReturnType<typeof createRuleActions>;
