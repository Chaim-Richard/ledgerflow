with open('src/server/routes/transactionRoutes.ts', 'w') as f:
    f.write("""import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';

export const transactionRouter = express.Router();

transactionRouter.post('/', async (req, res) => {
  try {
    const { transaction } = req.body;
    const user = (req as any).user;
    if (!transaction || !transaction.workspaceId) return res.status(400).json({ error: 'Invalid payload' });
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(transaction.workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) return res.status(403).json({ error: 'Not a member' });

    DoubleEntryValidator.validateJournalEntry(transaction);

    await db.runTransaction(async (t: any) => {
      const txRef = db.collection('transactions').doc(transaction.id);
      t.set(txRef, { ...transaction, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      // Fix Event Sourcing Disconnect
      transaction.lines.forEach((line: any) => {
         const eventRef = db.collection('journalEntries').doc();
         t.set(eventRef, {
            id: eventRef.id,
            timestamp: new Date().toISOString(),
            accountId: line.accountId,
            amountCents: line.amountCents,
            eventType: 'ACTUAL',
            transactionId: transaction.id,
            workspaceId: transaction.workspaceId,
            description: line.description || transaction.description
         });
      });
    });

    res.json({ status: 'ok', transactionId: transaction.id });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

transactionRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction, partialUpdate } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    
    // For partial updates (like flagging or voiding) we don't need double-entry validation
    // For full updates (like line modifications) we do need validation
    if (partialUpdate) {
      await db.runTransaction(async (t: any) => {
         const txRef = db.collection('transactions').doc(id);
         const doc = await t.get(txRef);
         if (!doc.exists) throw new Error('Not found');
         // Verify workspace
         const wsDoc = await db.collection('workspaces').doc(doc.data()?.workspaceId).get();
         if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) throw new Error('Not a member');
         
         t.update(txRef, { ...partialUpdate, updatedAt: FieldValue.serverTimestamp() });
      });
      return res.json({ status: 'ok' });
    }

    if (!transaction || !transaction.workspaceId) return res.status(400).json({ error: 'Invalid payload' });
    const wsDoc = await db.collection('workspaces').doc(transaction.workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) return res.status(403).json({ error: 'Not a member' });

    DoubleEntryValidator.validateJournalEntry(transaction);

    await db.runTransaction(async (t: any) => {
      const txRef = db.collection('transactions').doc(id);
      const doc = await t.get(txRef);
      if (!doc.exists) throw new Error('Not found');
      if (doc.data()?.workspaceId !== transaction.workspaceId) throw new Error('Workspace mismatch');
      if (doc.data()?.status === 'certified' || doc.data()?.status === 'voided') throw new Error('Cannot modify certified or voided transactions');

      t.update(txRef, { ...transaction, updatedAt: FieldValue.serverTimestamp() });
    });

    res.json({ status: 'ok' });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// A batch endpoint for mass updates
transactionRouter.post('/batch', async (req, res) => {
   try {
     const { updates, workspaceId } = req.body;
     const user = (req as any).user;
     const db = getFirestore();
     const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
     if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) return res.status(403).json({ error: 'Not a member' });
     
     const batch = db.batch();
     for (const update of updates) {
       batch.update(db.collection('transactions').doc(update.id), { ...update.data, updatedAt: FieldValue.serverTimestamp() });
     }
     await batch.commit();
     res.json({ status: 'ok' });
   } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// An endpoint for complex reconciliations
transactionRouter.post('/reconcile', async (req, res) => {
  try {
     const { workspaceId, operations } = req.body;
     const user = (req as any).user;
     const db = getFirestore();
     const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
     if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) return res.status(403).json({ error: 'Not a member' });
     
     await db.runTransaction(async (t: any) => {
        for (const op of operations) {
          if (op.type === 'updateBankLine') t.update(db.collection('bankLines').doc(op.id), op.data);
          if (op.type === 'updateTransaction') t.update(db.collection('transactions').doc(op.id), op.data);
          if (op.type === 'createTransaction') {
             DoubleEntryValidator.validateJournalEntry(op.data);
             t.set(db.collection('transactions').doc(op.id), op.data);
          }
        }
     });
     res.json({ status: 'ok' });
  } catch(e: any) { res.status(400).json({ error: e.message }); }
});
""")
