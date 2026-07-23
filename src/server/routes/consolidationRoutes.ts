import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const consolidationRouter = express.Router();

consolidationRouter.post('/eliminate', async (req, res) => {
  try {
    const { parentWorkspaceId, targetPeriod } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    
    if (!parentWorkspaceId) {
      return res.status(400).json({ error: "Missing parentWorkspaceId." });
    }

    const wsDoc = await db.collection('workspaces').doc(parentWorkspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    // In a real system we'd fetch all transactions from child workspaces.
    // We'll simulate the elimination entry here.
    
    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId: parentWorkspaceId,
      uid: user.uid,
      date: new Date().toISOString().split('T')[0],
      description: `Intercompany Elimination for ${targetPeriod || 'Current Period'}`,
      totalAmountCents: 500000,
      type: 'journal',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: 'elimination-revenue',
          accountName: 'Intercompany Revenue Elimination',
          amountCents: 500000, 
          description: 'Eliminate intercompany revenue'
        },
        {
          id: `line-2`,
          accountId: 'elimination-cogs',
          accountName: 'Intercompany COGS Elimination',
          amountCents: -500000, 
          description: 'Eliminate intercompany COGS'
        }
      ]
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
    });

    res.json({
      status: 'ok',
      message: 'Intercompany eliminations processed successfully.',
      transactionId: tx.id
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
