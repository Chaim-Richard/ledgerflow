import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';

export const leaseRouter = express.Router();

leaseRouter.post('/capitalize', async (req, res) => {
  try {
    const { workspaceId, leaseName, pvAmountCents, rouAssetAccountId, leaseLiabilityAccountId } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    
    if (!workspaceId || !pvAmountCents || !rouAssetAccountId || !leaseLiabilityAccountId) {
      return res.status(400).json({ error: "Missing required fields for ASC 842 capitalization." });
    }

    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: new Date().toISOString().split('T')[0],
      description: `ASC 842 Initial Recognition: ${leaseName || 'Operating Lease'}`,
      totalAmountCents: pvAmountCents,
      type: 'journal',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: rouAssetAccountId,
          accountName: 'Right-of-Use (ROU) Asset',
          amountCents: pvAmountCents, // Debit Asset
          description: 'Capitalize PV of lease payments'
        },
        {
          id: `line-2`,
          accountId: leaseLiabilityAccountId,
          accountName: 'Lease Liability',
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
    res.status(500).json({ error: e.message });
  }
});
