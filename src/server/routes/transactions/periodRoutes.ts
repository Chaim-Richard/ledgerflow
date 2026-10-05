import express from 'express';
import { z } from 'zod';
import { ClosingEntryEngine } from '../../../kernel/ledger/ClosingEntryEngine';
import { TransactionSchema } from '../../../schemas';
import type { ChartAccount, Transaction } from '../../../types';
import { getDb } from '../../db/firestore';
import { writeServerAuditLog } from '../../services/auditLogService';
import { closePeriod, PeriodCloseError } from '../../services/periodCloseService';
import { errorMessage, requestUser } from '../../auth/requestUser';
import { FxRevaluationError, revaluateForeignBalances, undoRevaluation } from '../../services/fxRevaluationService';
import { formatTzDate } from './helpers';

const revaluationBodySchema = z.object({
  workspaceId: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** today's rates may be fetched when missing; historical month-ends require each rate to be supplied */
  rates: z.record(z.string(), z.number().positive()).optional(),
}).strict();

/** What an error costs the caller: the service's own status and the plain sentence to show. */
function revaluationError(res: express.Response, err: unknown): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ status: 'error', message: 'This needs the workspace to revalue, and a date as YYYY-MM-DD if you name one.' });
    return;
  }
  if (err instanceof FxRevaluationError) {
    res.status(err.status).json({ status: 'error', message: err.message });
    return;
  }
  res.status(500).json({ status: 'error', message: 'The revaluation could not be run.', details: errorMessage(err) });
}

function revaluationRoute(dryRun: boolean) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const parsed = revaluationBodySchema.parse(req.body);
      const user = requestUser(req);
      const result = await revaluateForeignBalances(getDb(), {
        workspaceId: parsed.workspaceId,
        user: { uid: user.uid, email: user.email, admin: user.admin },
        date: parsed.date,
        rates: parsed.rates,
        dryRun,
      });
      res.json({ status: 'ok', ...result });
    } catch (err) {
      revaluationError(res, err);
    }
  };
}

/** Period work: currency revaluation, year-end and month-end close, workspace reset. Part of /api/v1/transactions (F-06), registered in the original order. */
export function registerPeriodRoutes(transactionRouter: express.Router): void {
  // ==========================================
  // MONTH-END CURRENCY REVALUATION (R-07)
  // ==========================================
  // The entry a period end needs: the open foreign invoices and bills valued at today's rate, the
  // difference against an unrealized FX gain/loss account, and its reversal the next day so the
  // documents keep their own rates. preview posts nothing; run posts both. Every rule — which
  // documents, which accounts, when nothing is posted at all — is in the service and in
  // src/lib/fxRevaluation.ts, where it is tested.
  //
  // What used to be here (behind LF_ENABLE_LEGACY_REVALUATION) applied one rate to every asset and
  // liability account, home-currency ones included, on invented rates when the rate service was down
  // (L-187). It is gone: the flag no longer means anything.
  transactionRouter.post('/revaluation/preview', revaluationRoute(true));
  transactionRouter.post('/revaluation/run', revaluationRoute(false));
  transactionRouter.post('/revaluation/undo', async (req, res) => {
    try {
      const { workspaceId, date } = revaluationBodySchema.parse(req.body);
      const user = requestUser(req);
      const result = await undoRevaluation(getDb(), { workspaceId: String(workspaceId), user: { uid: user.uid, email: user.email, admin: user.admin }, date: String(date || '') });
      res.json({ status: 'ok', ...result });
    } catch (err) {
      return revaluationError(res, err);
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
