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

    if (typeof pvAmountCents !== 'number' || pvAmountCents <= 0) {
      return res.status(400).json({ error: "pvAmountCents must be a positive integer." });
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
    });

    res.json({
      status: 'ok',
      message: 'ASC 842 Lease capitalized successfully.',
      transactionId: tx.id
    });
  } catch (e: any) {
    res.status(e.message?.includes('Unauthorized') ? 403 : 400).json({ error: e.message });
  }
});

