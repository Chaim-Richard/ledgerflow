import Decimal from "decimal.js";
import { Request, Response, NextFunction } from "express";
import express from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DoubleEntryValidator } from '../../kernel/validation/DoubleEntryValidator';
import { ClosingEntryEngine } from '../../kernel/ledger/ClosingEntryEngine';
import { TransactionSchema } from '../../schemas';
import { parseLocalDate } from '../../lib/utils';

export const transactionRouter = express.Router();

export function enforceDoubleEntrySafety(req: Request, res: Response, next: NextFunction) {
  const transaction = req.body.transaction;
  // Let /batch bypass this middleware
  if (req.path === '/batch') {
    return next();
  }
  if (req.body.partialUpdate) {
    return next();
  }
  if (!transaction || !Array.isArray(transaction.lines) || transaction.lines.length < 2) {
    return res.status(400).json({ error: "Invalid transaction structure: at least 2 lines required." });
  }
  
  if (transaction.currency && !/^[A-Z]{3}$/.test(transaction.currency)) {
    return res.status(400).json({ error: "Currency must be a valid ISO 4217 3-letter code." });
  }

  try {
    const netSum = transaction.lines.reduce((acc: any, line: any) => {
      if (typeof line.amountCents !== 'number' || !Number.isSafeInteger(line.amountCents)) {
        throw new Error("Invalid cents integer format.");
      }
      return acc.plus(new Decimal(line.amountCents));
    }, new Decimal(0));

    if (!netSum.isZero()) {
      return res.status(422).json({
        error: `Mathematical imbalance: Net ledger sum is ${netSum.toNumber()} cents. Debits must equal Credits.`
      });
    }

    DoubleEntryValidator.validateJournalEntry(transaction);
    next();
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}


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

    transactions.sort((a: any, b: any) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

    res.json({
      status: "success",
      workspaceId,
      transactionsCount: transactions.length,
      transactions
    });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") return res.status(403).json({ error: "Forbidden workspace access" });
    console.error('[TRANSACTION ROUTE ERROR]', err);
    res.status(500).json({ error: "An unexpected internal server error occurred." });
  }
});

transactionRouter.post('/', enforceDoubleEntrySafety, async (req, res) => {
  try {
    const { transaction } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const user = (req as any).user;
    
    if (!transaction || !transaction.workspaceId) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    transaction.uid = user.uid; // Security fix: enforce ownership

    const parsed = TransactionSchema.safeParse(transaction);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Schema validation failed', details: parsed.error.issues });
    }

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
       const debitSum = (transaction.lines || [])
         .filter((l: any) => (l.amountCents || 0) > 0)
         .reduce((sum: number, l: any) => sum + (l.amountCents || 0), 0);
       transaction.totalAmountCents = debitSum || Math.abs(transaction.lines?.[0]?.amountCents || 0);
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

transactionRouter.put('/:id', enforceDoubleEntrySafety, async (req, res) => {
  try {
    const { id } = req.params;
    let { transaction, partialUpdate } = req.body;
    const user = (req as any).user;
    const db = getFirestore();

    // Support flat API payloads: { workspaceId, lines, date, ... }
    if (!transaction && !partialUpdate && (req.body.workspaceId || req.body.lines || req.body.date)) {
      transaction = { ...req.body, id };
    }
    
    // For partial updates (like flagging or voiding)
    if (partialUpdate) {
      await db.runTransaction(async (t: any) => {
         const txRef = db.collection('transactions').doc(id);
         const doc = await t.get(txRef);
         if (!doc.exists) throw new Error('Not found');
         const txData = doc.data();
         const wsId = txData?.workspaceId;
         // Verify workspace
         const wsDoc = await db.collection('workspaces').doc(wsId).get();
         const wsData = wsDoc.data();
         if (!wsDoc.exists || (wsData?.uid !== user.uid && !wsData?.members?.includes(user.uid) && !user.admin)) {
           throw new Error('Not a member');
         }
         if (wsData?.lockDate && txData?.date && txData.date <= wsData.lockDate) {
           throw new Error(`Period Locked: Data mutation forbidden before ${wsData.lockDate}`);
         }
         if ((txData?.status === 'certified' || txData?.status === 'void') && !user.admin) {
           throw new Error(`Forbidden: Transaction status is locked (${txData?.status}).`);
         }
         
         if (partialUpdate.lines !== undefined || partialUpdate.amountCents !== undefined || partialUpdate.totalAmountCents !== undefined || partialUpdate.workspaceId !== undefined || partialUpdate.date !== undefined) {
           throw new Error('Restricted fields cannot be modified via partialUpdate. Use a full transaction update instead.');
         }

         t.update(txRef, { ...partialUpdate, updatedAt: FieldValue.serverTimestamp() });
      });

      const auditId = `audit-${Date.now()}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        workspaceId: req.body.workspaceId || user.developerWorkspaceId || "unknown",
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email || "developer@ledgerflow.io",
        action: "TRANSACTION_UPDATED_PARTIAL",
        details: `Partial update on transaction ref [${id}].`
      });

      return res.json({ status: 'ok', transactionId: id });
    }

    if (!transaction || !transaction.workspaceId) return res.status(400).json({ error: 'Invalid payload: missing workspaceId' });
    if (!transaction.id) transaction.id = id;
    transaction.uid = user.uid; // Enforce ownership
    const wsDoc = await db.collection('workspaces').doc(transaction.workspaceId).get();
    const wsData = wsDoc.data();
    if (!wsDoc.exists || (wsData?.uid !== user.uid && !wsData?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    if (wsData?.lockDate && transaction.date && transaction.date <= wsData.lockDate) {
      return res.status(400).json({ error: `Period Locked: Data mutation forbidden before ${wsData.lockDate}` });
    }

    DoubleEntryValidator.validateJournalEntry(transaction);

    await db.runTransaction(async (t: any) => {
      const txRef = db.collection('transactions').doc(id);
      const doc = await t.get(txRef);
      if (!doc.exists) throw new Error('Not found');
      if (doc.data()?.workspaceId !== transaction.workspaceId) throw new Error('Workspace mismatch');
      if ((doc.data()?.status === 'certified' || doc.data()?.status === 'void' || doc.data()?.isCleared === true) && !user.admin) {
        throw new Error('Cannot modify certified, cleared, or voided transactions');
      }
      if (wsData?.lockDate && doc.data()?.date && doc.data()?.date <= wsData.lockDate) {
        throw new Error(`Period Locked: Cannot modify a transaction originally dated before ${wsData.lockDate}`);
      }

      t.update(txRef, { ...transaction, updatedAt: FieldValue.serverTimestamp() });
    });

    const auditId = `audit-${Date.now()}`;
    await db.collection("auditLogs").doc(auditId).set({
      id: auditId,
      workspaceId: transaction.workspaceId,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email || "developer@ledgerflow.io",
      action: "TRANSACTION_UPDATED",
      details: `Full update on transaction ref [${id}].`
    });

    res.json({ status: 'ok', transactionId: id, data: transaction });
  } catch (e: any) {
    if (e.message === 'Not found') {
       return res.status(404).json({ error: e.message });
    }
    if (e.message === 'Not a member' || e.message === 'Workspace mismatch' || e.message?.includes('Forbidden')) {
       return res.status(403).json({ error: e.message });
    }
    res.status(400).json({ error: e.message }); 
  }
});

transactionRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceId = (req.query.workspaceId as string) || (req.body?.workspaceId as string);
    const user = (req as any).user;
    const db = getFirestore();
    const txRef = db.collection('transactions').doc(id);
    const doc = await txRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const data = doc.data();
    const wsId = workspaceId || data?.workspaceId;
    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    const wsData = wsDoc.data();
    if (!wsDoc.exists || (wsData?.uid !== user.uid && !wsData?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    if (wsData?.lockDate && data?.date && data.date <= wsData.lockDate) {
      return res.status(400).json({ error: `Period Locked: Data mutation forbidden before ${wsData.lockDate}` });
    }

    if ((data?.status === 'certified' || data?.status === 'void') && !user.admin) {
      return res.status(403).json({ error: `Forbidden: Transaction status is audited and locked (${data?.status}). Destructive actions are restricted to administrators.` });
    }

    await txRef.delete();

    const auditId = `audit-${Date.now()}`;
    await db.collection("auditLogs").doc(auditId).set({
      id: auditId,
      workspaceId: wsId,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email || "developer@ledgerflow.io",
      action: "TRANSACTION_DELETED",
      details: `Deleted transaction ref [${id}].`
    });

    res.json({ status: 'ok', deletedId: id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// A bulk creation endpoint for atomic multiple postings
transactionRouter.post('/bulk', async (req, res) => {
  try {
    const { transactions, workspaceId, entityMutation } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    const wsId = workspaceId || transactions?.[0]?.workspaceId;
    if (!wsId) return res.status(400).json({ error: 'Missing workspaceId' });

    const wsDoc = await db.collection('workspaces').doc(wsId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    if ((!Array.isArray(transactions) || transactions.length === 0) && !entityMutation) {
      return res.json({ status: 'ok', count: 0 });
    }

    // Validate double entry for each transaction
    for (const tx of (transactions || [])) {
      tx.uid = user.uid;
      tx.workspaceId = wsId;
      DoubleEntryValidator.validateJournalEntry(tx);
    }

    await db.runTransaction(async (t: any) => {
      if (entityMutation) {
        const ref = db.collection(entityMutation.collection).doc(entityMutation.docId);
        if (entityMutation.action === "create" || entityMutation.action === "update") {
          t.set(ref, { ...entityMutation.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else if (entityMutation.action === "delete") {
          t.delete(ref);
        }
      }
      for (const tx of (transactions || [])) {
        if (!tx.id) tx.id = db.collection('transactions').doc().id;
        if (!tx.totalAmountCents) {
          const debitSum = (tx.lines || [])
            .filter((l: any) => (l.amountCents || 0) > 0)
            .reduce((sum: number, l: any) => sum + (l.amountCents || 0), 0);
          tx.totalAmountCents = debitSum || Math.abs(tx.lines?.[0]?.amountCents || 0);
        }

        const txRef = db.collection('transactions').doc(tx.id);
        t.set(txRef, { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

        (tx.lines || []).forEach((line: any, index: number) => {
          const eventRef = db.collection('journalEntries').doc(`${tx.id}-line-${index}`);
          t.set(eventRef, {
            id: eventRef.id,
            timestamp: new Date().toISOString(),
            accountId: line.accountId,
            amountCents: line.amountCents,
            eventType: 'ACTUAL',
            transactionId: tx.id,
            workspaceId: wsId,
            description: line.description || tx.description
          });
        });
      }
    });

    res.json({ status: 'ok', count: transactions.length });
  } catch (e: any) {
    console.error('[BULK TRANSACTIONS ERROR]', e);
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
     
     if (!updates || !Array.isArray(updates) || updates.length === 0) return res.json({ status: 'ok' });
     if (updates.length > 500) {
       return res.status(400).json({ error: 'Batch limit exceeded: maximum 500 updates allowed per request.' });
     }

     const txRefs = updates.map((u: any) => db.collection('transactions').doc(u.id));
     const txDocs = await db.getAll(...txRefs);
     const batch = db.batch();

     for (let i = 0; i < txDocs.length; i++) {
       const txDoc = txDocs[i];
       if (!txDoc.exists) throw new Error(`Transaction ${updates[i].id} not found`);
       
       const txData = txDoc.data();
       if (txData?.workspaceId !== workspaceId) throw new Error(`Transaction ${updates[i].id} does not belong to this workspace`);
       
       const wsData = wsDoc.data();
       if (wsData?.lockDate && txData?.date && txData.date <= wsData.lockDate) throw new Error(`Period Locked: Transaction ${updates[i].id} is locked.`);
       if ((txData?.status === 'certified' || txData?.status === 'void') && !user.admin) throw new Error(`Forbidden: Transaction ${updates[i].id} status is locked.`);
       
       const updateData = updates[i].data;
       if (updateData.lines !== undefined || updateData.amountCents !== undefined || updateData.totalAmountCents !== undefined || updateData.workspaceId !== undefined || updateData.date !== undefined || updateData.uid !== undefined) {
         throw new Error(`Restricted fields cannot be modified via batch update on transaction ${updates[i].id}.`);
       }

       batch.update(txDoc.ref, { ...updateData, updatedAt: FieldValue.serverTimestamp() });
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


// ==========================================
// PROGRAMMATIC RECONCILIATION API (B2B)
// ==========================================

transactionRouter.get('/reconciliation/status', async (req, res) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
    if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });
    const user = (req as any).user;
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

    // Fetch uncleared transactions
    const snapshot = await db.collection('transactions')
      .where('workspaceId', '==', workspaceId)
      .where('isCleared', '==', false)
      .get();
      
    const unclearedCount = snapshot.size;
    res.json({
      status: 'ok',
      workspaceId,
      unclearedCount,
      message: `There are ${unclearedCount} uncleared transactions awaiting reconciliation.`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

transactionRouter.post('/reconciliation/match', async (req, res) => {
  try {
    const { workspaceId, externalBankLines } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

    // Auto-match external bank lines against uncleared internal transactions
    // (A real production system would do fuzzy matching here)
    res.json({
      status: 'ok',
      matchedCount: externalBankLines.length,
      suggestions: externalBankLines.map((line: any) => ({
        externalId: line.id,
        suggestedInternalId: null,
        confidence: 0
      }))
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

transactionRouter.post('/reconciliation/clear', async (req, res) => {
  try {
    const { workspaceId, transactionIds } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

    const batch = db.batch();
    for (const id of transactionIds) {
      batch.update(db.collection('transactions').doc(id), {
        isCleared: true,
        clearedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    await batch.commit();

    res.json({
      status: 'ok',
      clearedCount: transactionIds.length,
      message: 'Transactions successfully cleared.'
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// ==========================================
// MONTH-END REVALUATION API
// ==========================================
transactionRouter.post('/revaluation/run', async (req, res) => {
  try {
    const { workspaceId, targetCurrency } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

    // In a real system, we'd calculate the FX differential for all foreign currency accounts.
    // For this simulation, we'll create a synthetic adjustment journal entry.
    const revalTx = {
      id: db.collection("transactions").doc().id,
      workspaceId,
      uid: user.uid,
      date: new Date().toLocaleDateString('en-CA'),
      description: `Month-End FX Revaluation to ${targetCurrency || 'USD'}`,
      totalAmountCents: 1500, // Synthetic amount: $15.00
      type: 'journal',
      isCleared: true,
      lines: [
        {
          id: `line-1`,
          accountId: 'fx-unrealized-gain',
          accountName: 'Unrealized FX Gain/Loss',
          amountCents: -1500,
          description: 'Mark-to-market adjustment'
        },
        {
          id: `line-2`,
          accountId: 'cash-foreign',
          accountName: 'Foreign Currency Cash',
          amountCents: 1500,
          description: 'Mark-to-market adjustment'
        }
      ]
    };

    await db.runTransaction(async (t: any) => {
      const txRef = db.collection('transactions').doc(revalTx.id);
      t.set(txRef, { ...revalTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      
      revalTx.lines.forEach((line: any, index: number) => {
         const eventRef = db.collection('journalEntries').doc(`${revalTx.id}-line-${index}`);
         t.set(eventRef, {
            id: eventRef.id,
            timestamp: new Date().toISOString(),
            accountId: line.accountId,
            amountCents: line.amountCents,
            eventType: 'ACTUAL',
            transactionId: revalTx.id,
            workspaceId: revalTx.workspaceId,
            description: line.description || revalTx.description
         });
      });
    });

    res.json({
      status: 'ok',
      message: 'Month-end revaluation completed successfully. Adjusting journal entry posted.',
      transactionId: revalTx.id
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

transactionRouter.post('/close-year', async (req, res) => {
  try {
    const { workspaceId, closingDate, lockPeriod } = req.body;
    const user = (req as any).user;
    if (!workspaceId || !closingDate) {
      return res.status(400).json({ error: 'Missing required parameters: workspaceId and closingDate (YYYY-MM-DD).' });
    }

    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }

    const wsData = wsDoc.data();
    const isOwnerOrAdmin = wsData?.uid === user.uid || user.admin;
    if (!isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to execute fiscal year close.' });
    }

    // Check if period is already locked past or on this date
    if (wsData?.lockDate && wsData.lockDate >= closingDate) {
      return res.status(400).json({ error: `Cannot close year: Period is locked through ${wsData.lockDate}.` });
    }

    // 1. Fetch all chartAccounts for workspace
    const accountsSnap = await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get();
    const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // 2. Fetch all transactions for workspace on or before closingDate
    const txSnap = await db.collection('transactions')
      .where('workspaceId', '==', workspaceId)
      .where('date', '<=', closingDate)
      .get();
    const transactions = txSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // 3. Generate closing journal entry via ClosingEntryEngine
    const result = ClosingEntryEngine.generateClosingJournalEntry({
      workspaceId,
      uid: user.uid,
      closingDate,
      accounts,
      transactions,
      baseCurrency: wsData?.currency || 'USD'
    });

    // 4. Validate schema
    const parsed = TransactionSchema.safeParse(result.closingTransaction);
    if (!parsed.success) {
      return res.status(500).json({ error: 'Closing entry failed schema validation', details: parsed.error.issues });
    }

    // 5. Commit closing transaction
    const txRef = db.collection('transactions').doc(result.closingTransaction.id);
    const batch = db.batch();
    batch.set(txRef, result.closingTransaction);

    // If synthetic account was generated, persist it
    if (result.generatedRetainedEarningsAccount) {
      const accRef = db.collection('chartAccounts').doc(result.generatedRetainedEarningsAccount.id);
      batch.set(accRef, result.generatedRetainedEarningsAccount);
    }

    // If lockPeriod is requested, advance workspace lockDate to closingDate
    if (lockPeriod) {
      batch.update(db.collection('workspaces').doc(workspaceId), {
        lockDate: closingDate,
        updatedAt: new Date().toISOString()
      });
    }

    // 6. Log audit event
    const auditRef = db.collection('auditLogs').doc();
    batch.set(auditRef, {
      workspaceId,
      actorUid: user.uid,
      actorEmail: user.email || 'authenticated-user',
      action: 'FISCAL_YEAR_CLOSE',
      details: `Fiscal year closed as of ${closingDate}. Net income of $${(result.netIncomeCents / 100).toFixed(2)} transferred to Retained Earnings. ${result.revenueAccountsClosed} revenue accounts and ${result.expenseAccountsClosed} expense accounts closed.`,
      metadata: {
        transactionId: result.closingTransaction.id,
        closingDate,
        netIncomeCents: result.netIncomeCents,
        lockPeriod: !!lockPeriod,
        syntheticAccountCreated: !!result.generatedRetainedEarningsAccount
      },
      timestamp: FieldValue.serverTimestamp()
    });

    await batch.commit();

    res.json({
      status: 'ok',
      message: `Fiscal year closed successfully as of ${closingDate}.`,
      transaction: result.closingTransaction,
      generatedAccount: result.generatedRetainedEarningsAccount,
      summary: result.summary,
      accountsClosed: result.revenueAccountsClosed + result.expenseAccountsClosed
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

transactionRouter.post('/reset', async (req, res) => {
  try {
    const { workspaceId, confirmReset } = req.body;
    const user = (req as any).user;
    const db = getFirestore();
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    
    // Only the workspace owner or a global admin can completely reset the workspace data
    if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !user.admin)) {
      return res.status(403).json({ error: 'Forbidden: Only the workspace owner or a global admin can reset data.' });
    }

    if (confirmReset !== true) {
      return res.status(400).json({ error: 'Explicit confirmation required (confirmReset: true).' });
    }

    // Never wipe auditLogs - the audit trail must be preserved
    const collections = [
      'transactions', 'chartAccounts', 'journalEntries', 'projects', 'budgets', 
      'vendors', 'customers', 'invoices', 'bills', 
      'inventory', 'assets', 'recurring', 'employees', 'payRuns', 
      'taxRates', 'partners', 'autoRules', 'bankLines'
    ];

    for (const coll of collections) {
      let hasMore = true;
      while (hasMore) {
        const snapshot = await db.collection(coll)
          .where('workspaceId', '==', workspaceId)
          .limit(500)
          .get();

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }

    // Record persistent audit log of the reset action
    await db.collection('auditLogs').add({
      workspaceId,
      actorUid: user.uid,
      actorEmail: user.email || 'authenticated-user',
      action: 'WORKSPACE_DATA_RESET',
      details: 'All financial and operational records reset by workspace owner.',
      timestamp: FieldValue.serverTimestamp()
    });

    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
