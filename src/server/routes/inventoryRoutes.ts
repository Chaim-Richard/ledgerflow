import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';

export const inventoryRouter = express.Router();

inventoryRouter.post('/cogs', async (req, res) => {
  try {
    const { workspaceId, itemId, quantitySold, inventoryAccountId, cogsAccountId } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    
    if (!workspaceId || !itemId || !quantitySold || !inventoryAccountId || !cogsAccountId) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    // In a real system, we'd query inventory layers for FIFO calculation.
    // For this simulation, we'll assume a blended unit cost of $50 (5000 cents).
    const blendedUnitCost = 5000;
    const totalCogsCents = quantitySold * blendedUnitCost;

    const tx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: new Date().toISOString().split('T')[0],
      description: `Inventory COGS (FIFO Valuation) - Item: ${itemId} (Qty: ${quantitySold})`,
      totalAmountCents: totalCogsCents,
      type: 'journal',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: cogsAccountId,
          accountName: 'Cost of Goods Sold',
          amountCents: totalCogsCents, // Debit Expense
          description: 'Recognize cost of goods sold'
        },
        {
          id: `line-2`,
          accountId: inventoryAccountId,
          accountName: 'Inventory Asset',
          amountCents: -totalCogsCents, // Credit Asset
          description: 'Reduce inventory asset'
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
      message: 'Inventory COGS recorded successfully.',
      transactionId: tx.id,
      blendedUnitCost,
      totalCogsCents
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
