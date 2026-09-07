import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import { getDb, assertPeriodOpen } from '../db/firestore';
import { Transaction } from '../../types';

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

    // 1. Authorize workspace membership FIRST before checking idempotency (#82)
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    const wsData = wsDoc.data();
    if (!wsDoc.exists || (wsData?.uid !== user.uid && !wsData?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    // 2. Check idempotency record AFTER authorization (#82)
    const idempotencyKey = (req.headers['idempotency-key'] as string) || (contractId && periodId ? `${contractId}_${periodId}` : undefined);
    if (idempotencyKey) {
      const idempDoc = await db.collection('idempotencyKeys').doc(`${workspaceId}_rev_${idempotencyKey}`).get();
      if (idempDoc.exists) {
        return res.json(idempDoc.data()?.response);
      }
    }

    const txDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toLocaleDateString('en-CA');

    // 3. Validate period lock
    await assertPeriodOpen(db, workspaceId, txDate);

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: txDate,
      description: `ASC 606 Revenue Recognition for Contract ${contractId || 'Unknown'} (Period ${periodId || 'N/A'})`,
      totalAmountCents: amountCents,
      currency: 'USD',
      type: 'journal' as const,
      status: 'approved' as const,
      isCleared: true,
      createdAt: new Date().toISOString(),
      lines: [
        {
          id: 'line-1',
          accountId: deferredAccountId,
          amountCents: amountCents, // Debit Liability
          description: 'Recognized revenue - reducing liability'
        },
        {
          id: 'line-2',
          accountId: revenueAccountId,
          amountCents: -amountCents, // Credit Revenue
          description: 'Recognized revenue - increasing income'
        }
      ]
    };

    // 4. Validate through canonical validator (#102-R)
    const validatedTx = await TransactionValidator.validateAndPrepare(tx, {
      workspaceId,
      user: { uid: user.uid, admin: user.admin },
      wsData
    });

    const responsePayload = {
      status: 'ok',
      message: 'Revenue recognized successfully (ASC 606 compliance).',
      transactionId: validatedTx.id
    };

    let resultResponse = responsePayload;

    await db.runTransaction(async (t: any) => {
      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_rev_${idempotencyKey}`);
        const idempSnap = await t.get(idempRef);
        if (idempSnap.exists) {
          resultResponse = idempSnap.data()?.response || responsePayload;
          return;
        }
      }

      const txRef = db.collection('transactions').doc(validatedTx.id);
      t.set(txRef, { ...validatedTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_rev_${idempotencyKey}`);
        t.set(idempRef, {
          response: responsePayload,
          timestamp: new Date().toISOString(),
          workspaceId
        });
      }
    });

    res.json(resultResponse);
  } catch (e: any) {
    res.status(e.message?.includes('Unauthorized') || e.message?.includes('Forbidden') ? 403 : 400).json({ error: e.message });
  }
});
