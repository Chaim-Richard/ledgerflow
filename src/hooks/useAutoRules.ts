import { useCallback } from 'react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { deleteDoc, doc, setDoc, updateDoc } from '../lib/db/firestore';
import { dryRunRules } from '../lib/rulesEngine';
import { describeError } from '../lib/errorRemedies';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { AutoRule, Transaction } from '../types';

/**
 * Saving automation rules (Settings → Rules, "Create rule" in the transaction list). Rules used to
 * change only the copy in the open page: lost on reload and never seen by the rule engine after
 * it. Every change is now written to the database (autoRules, live), and "apply to existing"
 * saves the changed transactions through the server (POST /api/v1/transactions/batch, which
 * checks the role, the period lock and that entries still balance).
 */

/** Fields of a transaction a rule may change (rulesEngine applyRuleAction), sent when they differ. */
const RULE_FIELDS = ['lines', 'description', 'status', 'tags', 'metadata', 'classId', 'locationId', 'projectId', 'dimensions', 'category'] as const;

export function changedRuleFields(before: Transaction, after: Transaction): Partial<Transaction> {
  const out: Record<string, unknown> = {};
  for (const key of RULE_FIELDS) {
    const a = (before as unknown as Record<string, unknown>)[key];
    const b = (after as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b) && b !== undefined) out[key] = b;
  }
  return out as Partial<Transaction>;
}

/** A rule as stored: no undefined values (the database keeps JSON). */
function stored(rule: AutoRule): AutoRule {
  return JSON.parse(JSON.stringify(rule)) as AutoRule;
}

const fail = (err: unknown) => {
  const described = describeError(err, 'update');
  toast.error(described.title, { description: described.remedy });
};

export function useAutoRules() {
  const user = useAuthStore(s => s.user);
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);

  /** Create or replace a rule (keeps its creator and workspace when editing). */
  const saveRule = useCallback(async (rule: AutoRule): Promise<boolean> => {
    if (!user || !workspaceId) return false;
    const existing = (useLedgerStore.getState().autoRules || []).find(r => r.id === rule.id) as AutoRule | undefined;
    const full = stored({ ...rule, workspaceId, uid: existing?.uid || user.uid, createdAt: existing?.createdAt || rule.createdAt || new Date().toISOString() });
    try {
      await setDoc(doc(db, 'autoRules', full.id), full as never);
      const rules = (useLedgerStore.getState().autoRules || []) as AutoRule[];
      useLedgerStore.getState().setAutoRules(existing ? rules.map(r => (r.id === full.id ? full : r)) : [...rules, full]);
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }, [user, workspaceId]);

  const setRuleActive = useCallback(async (ruleId: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'autoRules', ruleId), { isActive });
      const rules = (useLedgerStore.getState().autoRules || []) as AutoRule[];
      useLedgerStore.getState().setAutoRules(rules.map(r => (r.id === ruleId ? { ...r, isActive } : r)));
    } catch (err) {
      fail(err);
    }
  }, []);

  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      await deleteDoc(doc(db, 'autoRules', ruleId));
      const rules = (useLedgerStore.getState().autoRules || []) as AutoRule[];
      useLedgerStore.getState().setAutoRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      fail(err);
    }
  }, []);

  /**
   * Run the rules over existing transactions and save what they change, as the dry run shows it.
   * Returns how many transactions were changed (0 when nothing matched or saving failed).
   */
  const applyToExisting = useCallback(async (rules: AutoRule[], transactions: Transaction[]): Promise<number> => {
    if (!user || !workspaceId) return 0;
    const dry = dryRunRules(rules, transactions);
    const byId = new Map(transactions.map(t => [t.id, t]));
    const updates = dry.matches
      .map(m => ({ id: m.transactionId, data: changedRuleFields(byId.get(m.transactionId) || m.txModified, m.txModified) }))
      .filter(u => Object.keys(u.data).length > 0);
    if (updates.length === 0) return 0;
    try {
      const res = await fetch('/api/v1/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ workspaceId, updates }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || 'The changes were not saved');
      const now = new Date().toISOString();
      await Promise.all(Object.entries(dry.summary.rulesTriggered).map(([ruleId, hits]) => {
        const rule = rules.find(r => r.id === ruleId);
        return rule && hits > 0
          ? updateDoc(doc(db, 'autoRules', ruleId), { hitCount: (rule.hitCount || 0) + hits, lastTriggeredAt: now }).catch(() => undefined)
          : undefined;
      }));
      return updates.length;
    } catch (err) {
      fail(err);
      return 0;
    }
  }, [user, workspaceId]);

  return { saveRule, setRuleActive, deleteRule, applyToExisting };
}
