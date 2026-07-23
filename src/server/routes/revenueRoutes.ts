import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';

export const revenueRouter = express.Router();

revenueRouter.post('/recognize', async (req, res) => {
  try {
    const { workspaceId, contractId, periodId, amountCents, deferredAccountId, revenueAccountId } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    
    if (!workspaceId || !amountCents || !deferredAccountId || !revenueAccountId) {
      return res.status(400).json({ error: "Missing required fields." });
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
      description: `ASC 606 Revenue Recognition for Contract ${contractId || 'Unknown'} (Period ${periodId || 'N/A'})`,
      totalAmountCents: amountCents,
      type: 'journal',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: deferredAccountId,
          accountName: 'Deferred Revenue',
          amountCents: amountCents, // Debit Liability
          description: 'Recognized revenue - reducing liability'
        },
        {
          id: `line-2`,
          accountId: revenueAccountId,
          accountName: 'Recognized Revenue',
          amountCents: -amountCents, // Credit Revenue
          description: 'Recognized revenue - increasing income'
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
      message: 'Revenue recognized successfully (ASC 606 compliance).',
      transactionId: tx.id
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
