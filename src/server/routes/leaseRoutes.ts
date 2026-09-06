import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';
import { getDb, validateWorkspaceMember, assertPeriodOpen, validateWorkspaceAccounts } from '../db/firestore';

export const leaseRouter = express.Router();

leaseRouter.post('/capitalize', async (req, res) => {
  try {
    const { workspaceId, leaseName, pvAmountCents, rouAssetAccountId, leaseLiabilityAccountId, date } = req.body;
    const user = (req as any).user;
    const db = getDb();
    
    if (!workspaceId || !pvAmountCents || !rouAssetAccountId || !leaseLiabilityAccountId) {
      return res.status(400).json({ error: "Missing required fields for ASC 842 capitalization." });
    }

    if (!Number.isInteger(pvAmountCents) || pvAmountCents <= 0) {
      return res.status(400).json({ error: "pvAmountCents must be a positive integer." });
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || (leaseName ? `lease_${leaseName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : undefined);
    if (idempotencyKey) {
      const idempDoc = await db.collection('idempotencyKeys').doc(`${workspaceId}_lease_${idempotencyKey}`).get();
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
    const accountMap = await validateWorkspaceAccounts(db, workspaceId, [rouAssetAccountId, leaseLiabilityAccountId]);
    const rouAcc = accountMap.get(rouAssetAccountId)!;
    const liabilityAcc = accountMap.get(leaseLiabilityAccountId)!;

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: txDate,
      description: `ASC 842 Initial Recognition: ${leaseName || 'Operating Lease'}`,
      totalAmountCents: pvAmountCents,
      type: 'journal',
      status: 'posted',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: rouAssetAccountId,
          accountName: rouAcc.name,
          amountCents: pvAmountCents, // Debit Asset
          description: 'Capitalize PV of lease payments'
        },
        {
          id: `line-2`,
          accountId: leaseLiabilityAccountId,
          accountName: liabilityAcc.name,
          amountCents: -pvAmountCents, // Credit Liability
          description: 'Recognize lease liability'
        }
      ]
    };

    // Double entry check
    DoubleEntryValidator.validateJournalEntry(tx as any);

    const responsePayload = {
      status: 'ok',
      message: 'ASC 842 Lease capitalized successfully.',
      transactionId: tx.id
    };

    let resultResponse = responsePayload;

    await db.runTransaction(async (t: any) => {
      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_lease_${idempotencyKey}`);
        const idempSnap = await t.get(idempRef);
        if (idempSnap.exists) {
          resultResponse = idempSnap.data()?.response || responsePayload;
          return;
        }
      }

      const txRef = db.collection('transactions').doc(tx.id);
      t.set(txRef, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

      if (idempotencyKey) {
        const idempRef = db.collection('idempotencyKeys').doc(`${workspaceId}_lease_${idempotencyKey}`);
        t.set(idempRef, {
          response: responsePayload,
          timestamp: new Date().toISOString(),
          workspaceId
        });
      }
    });

    res.json(resultResponse);
  } catch (e: any) {
    res.status(e.message?.includes('Unauthorized') ? 403 : 400).json({ error: e.message });
  }
});

