import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';
import { getDb, validateWorkspaceMember, assertPeriodOpen, validateWorkspaceAccounts } from '../db/firestore';

export const revenueRouter = express.Router();

revenueRouter.post('/recognize', async (req, res) => {
  try {
    const { workspaceId, contractId, periodId, amountCents, deferredAccountId, revenueAccountId, date } = req.body;
    const user = (req as any).user;
    const db = getDb();
    
    if (!workspaceId || !amountCents || !deferredAccountId || !revenueAccountId) {
      return res.status(400).json({ error: "Missing required fields (workspaceId, amountCents, deferredAccountId, revenueAccountId)." });
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: "amountCents must be a positive integer." });
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || (contractId && periodId ? `${contractId}_${periodId}` : undefined);
    if (idempotencyKey) {
      const idempDoc = await db.collection('idempotencyKeys').doc(`${workspaceId}_rev_${idempotencyKey}`).get();
      if (idempDoc.exists) {
        return res.json(idempDoc.data()?.response);
      }
    }

    const txDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toLocaleDateString('en-CA');

    // 1. Validate workspace membership
    await validateWorkspaceMember(db, workspaceId, user);

    // 2. Validate period lock
    await assertPeriodOpen(db, workspaceId, txDate);

    // 3. Validate accounts exist and belong to workspace
    const accountMap = await validateWorkspaceAccounts(db, workspaceId, [deferredAccountId, revenueAccountId]);
    const deferredAcc = accountMap.get(deferredAccountId)!;
    const revenueAcc = accountMap.get(revenueAccountId)!;

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: txDate,
      description: `ASC 606 Revenue Recognition for Contract ${contractId || 'Unknown'} (Period ${periodId || 'N/A'})`,
      totalAmountCents: amountCents,
      type: 'journal',
      status: 'posted',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: deferredAccountId,
          accountName: deferredAcc.name,
          amountCents: amountCents, // Debit Liability
          description: 'Recognized revenue - reducing liability'
        },
        {
          id: `line-2`,
          accountId: revenueAccountId,
          accountName: revenueAcc.name,
          amountCents: -amountCents, // Credit Revenue
          description: 'Recognized revenue - increasing income'
        }
      ]
    };

    // Double entry check
    DoubleEntryValidator.validateJournalEntry(tx as any);

    const responsePayload = {
      status: 'ok',
      message: 'Revenue recognized successfully (ASC 606 compliance).',
      transactionId: tx.id
    };

    await db.runTransaction(async (t: any) => {
      const txRef = db.collection('transactions').doc(tx.id);
      t.set(txRef, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      tx.lines.forEach((line: any, index: number) => {
         const eventRef = db.collection('journalEntries').doc(`${tx.id}-line-${index}`);
         t.set(eventRef, {
            id: eventRef.id,
            timestamp: new Date().toISOString(),
            accountId: line.accountId,
            amountCents: line.amountCents,
            eventType: 'ACTUAL',
            transactionId: tx.id,
            workspaceId: tx.workspaceId,
            description: line.description || tx.description
         });
      });

      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_rev_${idempotencyKey}`);
        t.set(idempRef, {
          response: responsePayload,
          timestamp: new Date().toISOString(),
          workspaceId
        });
      }
    });

    res.json(responsePayload);
  } catch (e: any) {
    res.status(e.message?.includes('Unauthorized') ? 403 : 400).json({ error: e.message });
  }
});

