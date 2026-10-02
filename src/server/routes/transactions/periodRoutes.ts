import express from 'express';
import { FieldValue } from '../../db/firestore';
import { TransactionValidator } from '../../../kernel/validation/TransactionValidator';
import { ClosingEntryEngine } from '../../../kernel/ledger/ClosingEntryEngine';
import { TransactionSchema } from '../../../schemas';
import type { ChartAccount, Transaction, TransactionLine } from '../../../types';
import { getLocalDateISO } from '../../../lib/utils';
import { getDb } from '../../db/firestore';
import type { DocumentData } from '../../db/firestore';
import { isPostable } from '../../../lib/txFilters';
import { writeServerAuditLog } from '../../services/auditLogService';
import { lockMessage, postingLock } from '../../../lib/periodLock';
import { closePeriod, PeriodCloseError } from '../../services/periodCloseService';
import { errorMessage, requestUser } from '../../auth/requestUser';
import { FxService } from '../../services/FxService';
import { formatTzDate } from './helpers';

/** Period work: currency revaluation, year-end and month-end close, workspace reset. Part of /api/v1/transactions (F-06), registered in the original order. */
export function registerPeriodRoutes(transactionRouter: express.Router): void {
  // ==========================================
  // MONTH-END REVALUATION API
  // ==========================================
  transactionRouter.post('/revaluation/run', async (req, res) => {
    try {
      const { workspaceId, targetCurrency } = req.body;
      const user = requestUser(req);
      const db = getDb();
      const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

      const wsData = wsDoc.data();
      const baseCurrency = wsData?.currency || 'USD';
      const targetCurr = (targetCurrency || baseCurrency).toUpperCase();

      const today = getLocalDateISO();
      const lock = postingLock(today, wsData, user.uid);
      if (lock) return res.status(400).json({ error: lockMessage(today, lock) });

      // --- LIVE FX FETCH ---
      const liveRates = await FxService.getRatesForBase(baseCurrency);
      const marketRate = liveRates[targetCurr] || 1.0;

      // Ensure real chartAccounts exist for Unrealized FX and Foreign Clearing
      const accSnap = await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get();
      let fxGainLossAcc: { id: string; data: () => DocumentData } | undefined = accSnap.docs.find(d => (d.data().name || '').toLowerCase().includes('fx gain') || (d.data().name || '').toLowerCase().includes('unrealized'));
      let fxClearingAcc: { id: string; data: () => DocumentData } | undefined = accSnap.docs.find(d => (d.data().name || '').toLowerCase().includes('fx clearing') || (d.data().name || '').toLowerCase().includes('foreign'));

      const batchSetup = db.batch();
      if (!fxGainLossAcc) {
        const newRef = db.collection('chartAccounts').doc();
        const accData = {
          id: newRef.id,
          workspaceId,
          uid: user.uid,
          name: 'Unrealized FX Gain/Loss',
          code: '8090',
          type: 'expense',
          subtype: 'other_expense',
          balanceCents: 0,
          createdAt: new Date().toISOString()
        };
        batchSetup.set(newRef, accData);
        fxGainLossAcc = { id: newRef.id, data: () => accData };
      }
      if (!fxClearingAcc) {
        const newRef = db.collection('chartAccounts').doc();
        const accData = {
          id: newRef.id,
          workspaceId,
          uid: user.uid,
          name: 'Foreign Exchange Clearing',
          code: '1090',
          type: 'asset',
          subtype: 'cash',
          balanceCents: 0,
          createdAt: new Date().toISOString()
        };
        batchSetup.set(newRef, accData);
        fxClearingAcc = { id: newRef.id, data: () => accData };
      }
      await batchSetup.commit();

      // --- REAL REVALUATION CALCULATION ---
      // 1. Fetch all transactions to compute current functional balances vs expected market value
      const txSnap = await db.collection('transactions').where('workspaceId', '==', workspaceId).get();
      const transactions = txSnap.docs.map(d => d.data() as Transaction);
    
      const revalLines: TransactionLine[] = [];
      let totalAdjustmentCents = 0;

      // Group lines by account
      const accountBalances = new Map<string, { foreignCents: number, functionalCents: number, name: string }>();
    
      transactions.forEach((tx) => {
        if (!isPostable(tx)) return;
        (tx.lines || []).forEach((l: TransactionLine) => {
          if (!l.accountId) return;
          const rate = l.exchangeRate || tx.exchangeRate || 1;
          const stats = accountBalances.get(l.accountId) || { foreignCents: 0, functionalCents: 0, name: l.accountName || l.accountId };
          stats.foreignCents += l.amountCents;
          stats.functionalCents += Math.round(l.amountCents * rate);
          accountBalances.set(l.accountId, stats);
        });
      });

      for (const [accountId, stats] of accountBalances.entries()) {
        // We only revalue Asset/Liability accounts that have a non-zero balance
        const acc = accSnap.docs.find(d => d.id === accountId)?.data();
        if (!acc || (acc.type !== 'asset' && acc.type !== 'liability')) continue;
        if (stats.foreignCents === 0) continue;

        // Expected functional balance at current market rates
        const expectedFunctionalCents = Math.round(stats.foreignCents * marketRate);
        const adjustment = expectedFunctionalCents - stats.functionalCents;

        if (adjustment !== 0) {
          revalLines.push({
            id: `reval-${accountId}`,
            accountId: accountId,
            accountName: stats.name,
            amountCents: adjustment,
            description: `FX Revaluation adjustment (${baseCurrency} vs ${targetCurr})`
          });
          totalAdjustmentCents += adjustment;
        }
      }

      if (revalLines.length === 0) {
        return res.json({ status: "ok", message: "No revaluation needed. Functional balances match market rates." });
      }

      const fxGainLossAccId = fxGainLossAcc?.id || 'fx-gain-loss-default';
      const fxGainLossAccName = fxGainLossAcc?.data()?.name || 'Unrealized FX Gain/Loss';

      const revalTx = {
        id: db.collection("transactions").doc().id,
        workspaceId,
        uid: user.uid,
        date: today,
        description: `Month-End FX Revaluation to ${targetCurr}`,
        totalAmountCents: Math.abs(totalAdjustmentCents),
        currency: baseCurrency,
        type: 'journal' as const,
        status: 'approved' as const,
        isCleared: true,
        createdAt: new Date().toISOString(),
        lines: [
          ...revalLines,
          {
            id: `offset-fx`,
            accountId: fxGainLossAccId,
            accountName: fxGainLossAccName,
            amountCents: -totalAdjustmentCents, // Offset to P&L
            description: 'Net Unrealized FX Gain/Loss'
          }
        ]
      };

      const validatedRevalTx = await TransactionValidator.validateAndPrepare(revalTx, {
        workspaceId,
        user: { uid: user.uid, admin: user.admin },
        wsData
      });

      await db.runTransaction(async (t) => {
        const txRef = db.collection('transactions').doc(validatedRevalTx.id);
        t.set(txRef, { ...validatedRevalTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });

      res.json({
        status: 'ok',
        message: `Month-end revaluation completed. Posted ${revalLines.length + 1} lines adjusting for ${totalAdjustmentCents} cents net.`,
        transactionId: revalTx.id
      });
    } catch (e) {
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  transactionRouter.post('/close-year', async (req, res) => {
    try {
      const { workspaceId, closingDate, lockPeriod } = req.body;
      const user = requestUser(req);
      if (!workspaceId || !closingDate) {
        return res.status(400).json({ error: 'Missing required parameters: workspaceId and closingDate (YYYY-MM-DD).' });
      }

      const db = getDb();
      const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!wsDoc.exists) {
        return res.status(404).json({ error: 'Workspace not found.' });
      }

      const wsData = wsDoc.data();
      const isOwnerOrAdmin = wsData?.uid === user.uid || user.admin;
      if (!isOwnerOrAdmin) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions to execute fiscal year close.' });
      }

      // Check if period is already locked past or on this date
      if (wsData?.lockDate && wsData.lockDate >= closingDate) {
        return res.status(400).json({ error: `Cannot close year: Period is already locked through ${wsData.lockDate}.` });
      }

      const today = formatTzDate(new Date(), wsData?.timezone);
      if (closingDate > today) {
        return res.status(400).json({ error: `Cannot close future accounting period. Closing date (${closingDate}) is ahead of current date (${today}).` });
      }

      // 1. Fetch all chartAccounts for workspace
      const accountsSnap = await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get();
      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as ChartAccount);

      // 2. Fetch all transactions for workspace on or before closingDate
      const txSnap = await db.collection('transactions')
        .where('workspaceId', '==', workspaceId)
        .where('date', '<=', closingDate)
        .get();
      const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Transaction);

      // 3. Generate closing journal entry via ClosingEntryEngine
      const result = ClosingEntryEngine.generateClosingJournalEntry({
        workspaceId,
        uid: user.uid,
        closingDate,
        accounts,
        transactions,
        baseCurrency: wsData?.currency || 'USD'
      });

      // 4. Validate schema
      const parsed = TransactionSchema.safeParse(result.closingTransaction);
      if (!parsed.success) {
        return res.status(500).json({ error: 'Closing entry failed schema validation', details: parsed.error.issues });
      }

      // 5. Commit closing transaction
      const txRef = db.collection('transactions').doc(result.closingTransaction.id);
      const batch = db.batch();
      batch.set(txRef, result.closingTransaction);

      // If synthetic account was generated, persist it
      if (result.generatedRetainedEarningsAccount) {
        const accRef = db.collection('chartAccounts').doc(result.generatedRetainedEarningsAccount.id);
        batch.set(accRef, result.generatedRetainedEarningsAccount);
      }

      // If lockPeriod is requested, advance workspace lockDate to closingDate
      if (lockPeriod) {
        batch.update(db.collection('workspaces').doc(workspaceId), {
          lockDate: closingDate,
          updatedAt: new Date().toISOString()
        });
      }

      // 6. Log audit event
      await writeServerAuditLog({
        workspaceId,
        uid: user.uid,
        email: user.email || 'authenticated-user',
        action: 'FISCAL_YEAR_CLOSE',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          description: `Fiscal year closed as of ${closingDate}. Net income of $${(result.netIncomeCents / 100).toFixed(2)} transferred to Retained Earnings. ${result.revenueAccountsClosed} revenue accounts and ${result.expenseAccountsClosed} expense accounts closed.`,
          transactionId: result.closingTransaction.id,
          closingDate,
          netIncomeCents: result.netIncomeCents,
          lockPeriod: !!lockPeriod,
          syntheticAccountCreated: !!result.generatedRetainedEarningsAccount
        }
      }, { db });

      await batch.commit();

      res.json({
        status: 'ok',
        message: `Fiscal year closed successfully as of ${closingDate}.`,
        transaction: result.closingTransaction,
        generatedAccount: result.generatedRetainedEarningsAccount,
        summary: result.summary,
        accountsClosed: result.revenueAccountsClosed + result.expenseAccountsClosed
      });
    } catch (e) {
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  // Hard close through the end of a month. Same service as the Month-End Close screen
  // (src/server/services/periodCloseService.ts): owner/accountant only, refused while drafts are
  // dated in the period, audited. The year-end closing entry is /close-year.
  transactionRouter.post('/close-month', async (req, res) => {
    const { workspaceId, month } = (req.body || {}) as { workspaceId?: string; month?: string };
    if (!workspaceId || !month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Missing or invalid parameters: workspaceId and month (YYYY-MM) required.' });
    }
    const user = (req as unknown as { user: { uid: string; email?: string } }).user;
    try {
      const result = await closePeriod(getDb(), { workspaceId, uid: user.uid, email: user.email, month, mode: 'hard' });
      res.json({ status: 'ok', month, closingDate: result.lockDate, lockDate: result.lockDate, message: `Period ${month} locked through ${result.lockDate}.` });
    } catch (e) {
      if (e instanceof PeriodCloseError) return res.status(e.status).json({ error: e.message, details: e.details });
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  transactionRouter.post('/reset', async (req, res) => {
    try {
      const { workspaceId, confirmReset } = req.body;
      const user = requestUser(req);
      const db = getDb();
      const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    
      // Only the workspace owner or a global admin can completely reset the workspace data
      if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !user.admin)) {
        return res.status(403).json({ error: 'Forbidden: Only the workspace owner or a global admin can reset data.' });
      }

      if (confirmReset !== true) {
        return res.status(400).json({ error: 'Explicit confirmation required (confirmReset: true).' });
      }
      // Real books are never wiped on the spot: delete the workspace instead (30-day window, then
      // purge). Only a workspace holding demo data can be emptied at once.
      if (wsDoc.data()?.isDemoLoaded !== true) {
        return res.status(409).json({ error: 'Only demo data can be cleared at once. To remove real books, delete the workspace (Settings → Security): it is kept for 30 days first.' });
      }

      // Never wipe auditLogs - the audit trail must be preserved
      const collections = [
        'transactions', 'chartAccounts', 'projects', 'budgets', 
        'vendors', 'customers', 'invoices', 'bills', 
        'inventory', 'assets', 'recurring', 'employees', 'payRuns', 
        'taxRates', 'partners', 'autoRules', 'bankLines'
      ];

      for (const coll of collections) {
        let hasMore = true;
        while (hasMore) {
          const snapshot = await db.collection(coll)
            .where('workspaceId', '==', workspaceId)
            .limit(500)
            .get();

          if (snapshot.empty) {
            hasMore = false;
            break;
          }

          const batch = db.batch();
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // Record persistent audit log of the reset action
      await writeServerAuditLog({
        workspaceId,
        uid: user.uid,
        email: user.email || 'authenticated-user',
        action: 'WORKSPACE_DATA_RESET',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          description: 'All financial and operational records reset by workspace owner.'
        }
      }, { db });

      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ error: errorMessage(e) });
    }
  });
}
