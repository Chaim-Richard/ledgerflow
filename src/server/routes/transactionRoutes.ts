import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';

export const transactionRouter = express.Router();

transactionRouter.get('/', async (req, res) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
    if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId query parameters" });

    const user = (req as any).user;
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const { startDate, endDate, accountId, limit } = req.query;

    let queryFn: any = db.collection("transactions").where("workspaceId", "==", workspaceId);
    
    if (startDate) queryFn = queryFn.where("date", ">=", startDate as string);
    if (endDate) queryFn = queryFn.where("date", "<=", endDate as string);
    
    const maxLimit = parseInt(limit as string, 10) || 100;
    queryFn = queryFn.limit(Math.min(maxLimit, 1000));

    const transactionsSnap = await queryFn.get();
    let transactions = transactionsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    if (accountId) {
      transactions = transactions.filter((t: any) => t.lines?.some((l: any) => l.accountId === accountId));
    }

    transactions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      status: "success",
      workspaceId,
      transactionsCount: transactions.length,
      transactions
    });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") return res.status(403).json({ error: "Forbidden workspace access" });
    res.status(500).json({ error: err.message });
  }
});

transactionRouter.post('/', async (req, res) => {
  try {
    const { transaction } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const user = (req as any).user;
    
    if (!transaction || !transaction.workspaceId) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    transaction.uid = user.uid; // Security fix: enforce ownership

    const db = getFirestore();
    if (!transaction.id) transaction.id = db.collection("transactions").doc().id;
    
    if (idempotencyKey) {
       const idempotencyRef = db.collection('idempotencyKeys').doc(idempotencyKey);
       const idempotencyDoc = await idempotencyRef.get();
       if (idempotencyDoc.exists) {
          const data = idempotencyDoc.data();
          return res.status(data?.code || 409).json(data?.body || { error: 'Duplicate request processing' });
       }
    }

    const wsDoc = await db.collection('workspaces').doc(transaction.workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    
    DoubleEntryValidator.validateJournalEntry(transaction);
    
    // Standardize totalAmountCents
    if (!transaction.totalAmountCents) {
       // We can't fetch accounts here synchronously easily without a big refactor, 
       // but the client should have already set it. If not, fallback:
       transaction.totalAmountCents = transaction.lines[0]?.amountCents || 0;
    }

    await db.runTransaction(async (t: any) => {
      if (idempotencyKey) {
         const idempotencyRef = db.collection('idempotencyKeys').doc(idempotencyKey);
         const idempotencyDoc = await t.get(idempotencyRef);
         if (idempotencyDoc.exists) {
            throw new Error('Duplicate request processing');
         }
      }

      const txRef = db.collection('transactions').doc(transaction.id);
      const doc = await t.get(txRef);
      if (doc.exists) {
         throw new Error('Duplicate request processing');
      }

      t.set(txRef, { ...transaction, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      // Fix Event Sourcing Disconnect by making IDs deterministic
      transaction.lines.forEach((line: any, index: number) => {
         const eventRef = db.collection('journalEntries').doc(`${transaction.id}-line-${index}`);
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

      if (idempotencyKey) {
         const idempotencyRef = db.collection('idempotencyKeys').doc(idempotencyKey);
         const responseBody = { status: 'ok', transactionId: transaction.id };
         t.set(idempotencyRef, { code: 200, body: responseBody, createdAt: FieldValue.serverTimestamp() });
      }
    });

    res.status(200).json({ status: 'ok', transactionId: transaction.id });
  } catch (e: any) {
    if (e.message === 'Duplicate request processing') {
       return res.status(409).json({ error: e.message });
    }
    if (e.message === 'Not a member') {
       return res.status(403).json({ error: e.message });
    }
    res.status(400).json({ error: e.message });
  }
});

transactionRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction, partialUpdate } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    if (!transaction.id) transaction.id = db.collection("transactions").doc().id;
    
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
    transaction.uid = user.uid; // Security fix: enforce ownership
    const wsDoc = await db.collection('workspaces').doc(transaction.workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

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
  } catch (e: any) {
    if (e.message === 'Not found') {
       return res.status(404).json({ error: e.message });
    }
    if (e.message === 'Not a member' || e.message === 'Workspace mismatch') {
       return res.status(403).json({ error: e.message });
    }
    res.status(400).json({ error: e.message }); 
  }
});

// A batch endpoint for mass updates
transactionRouter.post('/batch', async (req, res) => {
   try {
     const { updates, workspaceId } = req.body;
     const user = (req as any).user;
     const db = getFirestore();
     const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
     if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });
     
     const batch = db.batch();
     for (const update of updates) {
       batch.update(db.collection('transactions').doc(update.id), { ...update.data, updatedAt: FieldValue.serverTimestamp() });
     }
     await batch.commit();
     res.json({ status: 'ok' });
   } catch (e: any) {
    if (e.message === 'Not a member') {
       return res.status(403).json({ error: e.message });
    }
    res.status(400).json({ error: e.message }); 
  }
});

// An endpoint for complex reconciliations
transactionRouter.post('/reconcile', async (req, res) => {
  try {
     const { workspaceId, operations } = req.body;
     const user = (req as any).user;
     const db = getFirestore();
     const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
     if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });
     
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
  } catch(e: any) {
    if (e.message === 'Not a member') {
       return res.status(403).json({ error: e.message });
    }
    res.status(400).json({ error: e.message });
  }
});
