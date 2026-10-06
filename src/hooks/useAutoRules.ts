import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where, writeBatch } from '../lib/db/firestore';
import { dryRunRules, ruleGroupName } from '../lib/rulesEngine';
import { describeError } from '../lib/errorRemedies';
import { useCurrentRole } from './useCurrentRole';
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

  const role = useCurrentRole();
  const canManageRules = role !== 'viewer';
  const pending = useRef(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const currentContext = useCallback(() => {
    const auth = useAuthStore.getState();
    const workspace = auth.getCurrentWorkspace();
    const currentRole = workspace?.uid === auth.user?.uid ? 'owner' : workspace?.roles?.[auth.user?.uid || ''];
    return !!user && !!workspaceId && auth.user?.uid === user.uid && auth.currentWorkspaceId === workspaceId && (currentRole === 'owner' || currentRole === 'accountant' || currentRole === 'bookkeeper');
  }, [user, workspaceId]);

  // Read all pages, not just the capped browser cache, before changing a whole group.
  const workspaceRules = useCallback(async () => {
    const snapshot = await getDocs(query(collection(db, 'autoRules'), where('workspaceId', '==', workspaceId)));
    return snapshot.docs.map(row => ({ ...row.data(), id: row.id }) as AutoRule).filter(rule => rule.workspaceId === workspaceId);
  }, [workspaceId]);

  const updateGroup = useCallback(async (groupName: string, change: { groupName?: string; groupIsActive?: boolean }) => {
    if (!canManageRules || !currentContext()) throw new Error('Your role cannot edit rules.');
    if (pending.current) throw new Error('A group change is still being saved.');
    const name = change.groupName?.trim();
    if (change.groupName !== undefined && (!name || name.length > 120)) throw new Error('Enter a group name of 1–120 characters.');
    pending.current = true;
    setIsUpdatingGroup(true);
    try {
      const allRules = await workspaceRules();
      if (!currentContext()) throw new Error('The workspace changed; retry in the current workspace.');
      const members = allRules.filter(rule => ruleGroupName(rule) === groupName);
      if (!members.length) throw new Error('This group no longer contains rules.');
      if (name && name !== groupName && allRules.some(rule => ruleGroupName(rule) === name)) throw new Error('That group already exists. Choose another name.');
      const patch = name ? { groupName: name } : { groupIsActive: change.groupIsActive };
      const batch = writeBatch(db);
      members.forEach(rule => batch.update(doc(db, 'autoRules', rule.id), patch));
      await batch.commit();
      if (!currentContext()) return;
      const ids = new Set(members.map(rule => rule.id));
      const cached = useLedgerStore.getState().autoRules as AutoRule[];
      useLedgerStore.getState().setAutoRules(cached.map(rule => ids.has(rule.id) ? { ...rule, ...patch } : rule));
    } finally {
      pending.current = false;
      setIsUpdatingGroup(false);
    }
  }, [canManageRules, currentContext, workspaceRules]);

  const setRulePriority = useCallback(async (ruleId: string, priority: number) => {
    if (!currentContext()) throw new Error('Your role cannot edit rules.');
    if (!(useLedgerStore.getState().autoRules as AutoRule[]).some(rule => rule.id === ruleId && rule.workspaceId === workspaceId)) throw new Error('This rule is not in the current workspace.');
    if (!Number.isSafeInteger(priority)) throw new Error('Enter a whole-number priority.');
    await updateDoc(doc(db, 'autoRules', ruleId), { priority });
    if (!currentContext()) return;
    const rules = useLedgerStore.getState().autoRules as AutoRule[];
    useLedgerStore.getState().setAutoRules(rules.map(rule => rule.id === ruleId ? { ...rule, priority } : rule));
  }, [currentContext, workspaceId]);

  /** Create or replace a rule (keeps its creator and workspace when editing). */
  const saveRule = useCallback(async (rule: AutoRule): Promise<boolean> => {
    if (!user || !workspaceId || !currentContext() || pending.current) return false;
    const existing = (useLedgerStore.getState().autoRules || []).find(r => r.id === rule.id) as AutoRule | undefined;
    if (existing && existing.workspaceId !== workspaceId) return false;
    pending.current = true;
    setIsUpdatingGroup(true);
    const full = stored({ ...rule, workspaceId, uid: existing?.uid || user.uid, createdAt: existing?.createdAt || rule.createdAt || new Date().toISOString() });
    try {
      const members = (await workspaceRules()).filter(r => ruleGroupName(r) === ruleGroupName(full));
      if (!currentContext()) return false;
      full.groupIsActive = !members.some(r => r.groupIsActive === false);
      await setDoc(doc(db, 'autoRules', full.id), full as never);
      if (!currentContext()) return true;
      const rules = (useLedgerStore.getState().autoRules || []) as AutoRule[];
      useLedgerStore.getState().setAutoRules(existing ? rules.map(r => (r.id === full.id ? full : r)) : [...rules, full]);
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      pending.current = false;
      setIsUpdatingGroup(false);
    }
  }, [user, workspaceId, currentContext, workspaceRules]);

  const setRuleActive = useCallback(async (ruleId: string, isActive: boolean) => {
    if (!currentContext() || !(useLedgerStore.getState().autoRules as AutoRule[]).some(rule => rule.id === ruleId && rule.workspaceId === workspaceId)) return;
    try {
      await updateDoc(doc(db, 'autoRules', ruleId), { isActive });
      if (!currentContext()) return;
      const rules = (useLedgerStore.getState().autoRules || []) as AutoRule[];
      useLedgerStore.getState().setAutoRules(rules.map(r => (r.id === ruleId ? { ...r, isActive } : r)));
    } catch (err) {
      fail(err);
    }
  }, [currentContext, workspaceId]);

  const deleteRule = useCallback(async (ruleId: string) => {
    if (!currentContext() || !(useLedgerStore.getState().autoRules as AutoRule[]).some(rule => rule.id === ruleId && rule.workspaceId === workspaceId)) return;
    try {
      await deleteDoc(doc(db, 'autoRules', ruleId));
      if (!currentContext()) return;
      const rules = (useLedgerStore.getState().autoRules || []) as AutoRule[];
      useLedgerStore.getState().setAutoRules(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      fail(err);
    }
  }, [currentContext, workspaceId]);

  /**
   * Run the rules over existing transactions and save what they change, as the dry run shows it.
   * Returns how many transactions were changed (0 when nothing matched or saving failed).
   */
  const applyToExisting = useCallback(async (rules: AutoRule[], transactions: Transaction[]): Promise<number> => {
    if (!user || !workspaceId || !currentContext()) return 0;
    const dry = dryRunRules(rules, transactions);
    const byId = new Map(transactions.map(t => [t.id, t]));
    const updates = dry.matches
      .map(m => ({ id: m.transactionId, data: changedRuleFields(byId.get(m.transactionId) || m.txModified, m.txModified) }))
      .filter(u => Object.keys(u.data).length > 0);
    if (updates.length === 0) return 0;
    try {
      const token = await user.getIdToken();
      if (!currentContext()) return 0;
      const res = await fetch('/api/v1/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId, updates }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || 'The changes were not saved');
      if (!currentContext()) return 0;
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
  }, [user, workspaceId, currentContext]);

  return { saveRule, setRuleActive, deleteRule, applyToExisting, updateGroup, setRulePriority, isUpdatingGroup };
}
