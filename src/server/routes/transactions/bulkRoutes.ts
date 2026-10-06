import { ApprovalRefused, serverApproval } from '../../services/invoiceApprovalGuard';
import express from 'express';
import { FieldValue } from '../../db/firestore';
import { DoubleEntryValidator } from '../../../kernel/validation/DoubleEntryValidator';
import { TransactionValidator } from '../../../kernel/validation/TransactionValidator';
import { InvoiceSchema, BillSchema, OrderSchema, ProjectSchema, BankLineImportSchema, CreditNoteSchema, VendorCreditSchema } from '../../../schemas';
import type { Transaction } from '../../../types';
import { getDb } from '../../db/firestore';
import { LedgerPostingError, prepareStockMoves } from '../../services/cogsStockService';
import { z } from 'zod';
import { assertPostingOpen } from '../../../lib/periodLock';
import { errorMessage, requestUser } from '../../auth/requestUser';
import { isUpdatedAtMismatch } from './helpers';
import { writeServerAuditLog } from '../../services/auditLogService';
import { deletionSentence, deletionSnapshot } from '../../services/deletionRecord';
import { MAX_RECATEGORIZE, RecategorizeError, recategorize } from '../../services/recategorizeService';
import { workspaceRole } from '../../../lib/periodLock';


/** Many entries at once: posting in bulk and batch updates. Part of /api/v1/transactions (F-06), registered in the original order. */
export function registerTransactionBulkRoutes(transactionRouter: express.Router): void {
  // A bulk creation endpoint for atomic multiple postings with chunking support
  transactionRouter.post('/bulk', async (req, res) => {
    try {
      const { transactions, workspaceId, entityMutation } = req.body;
      // Imported bank statement lines (the browser may not write bankLines itself)
      const bankLines = BankLineImportSchema.array().max(5000).parse(req.body.bankLines ?? []);
      const user = requestUser(req);
      const db = getDb();
      const wsId = workspaceId || transactions?.[0]?.workspaceId;
      if (!wsId) return res.status(400).json({ error: 'Missing workspaceId' });

      if (user.developerWorkspaceId && user.developerWorkspaceId !== wsId) {
        return res.status(403).json({ error: `Forbidden: API key is scoped strictly to workspace ${user.developerWorkspaceId}` });
      }

      const wsDoc = await db.collection('workspaces').doc(wsId).get();
      if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) {
        return res.status(403).json({ error: 'Not a member' });
      }

      const wsData = wsDoc.data();

      const idempotencyKey = req.headers['idempotency-key'] as string;
      const scopedIdempotencyKey = idempotencyKey ? `${wsId}_${idempotencyKey}` : null;

      if ((!Array.isArray(transactions) || transactions.length === 0) && !entityMutation && bankLines.length === 0) {
        return res.json({ status: 'ok', count: 0 });
      }

      if (scopedIdempotencyKey) {
        const idempotencyDoc = await db.collection('idempotencyKeys').doc(scopedIdempotencyKey).get();
        if (idempotencyDoc.exists) {
          const cachedResult = idempotencyDoc.data()?.body || { status: 'ok', count: Array.isArray(transactions) ? transactions.length : 0 };
          return res.json(cachedResult);
        }
      }

      // Allowlist entityMutation collections to close arbitrary Admin-SDK mutation primitive
      const ALLOWED_ENTITY_COLLECTIONS = ['invoices', 'bills', 'orders', 'projects', 'creditNotes', 'vendorCredits'];
      if (entityMutation) {
        if (!ALLOWED_ENTITY_COLLECTIONS.includes(entityMutation.collection)) {
          return res.status(400).json({ error: `Forbidden: entityMutation collection '${entityMutation.collection}' is not permitted.` });
        }
        if (!entityMutation.docId || typeof entityMutation.docId !== 'string') {
          return res.status(400).json({ error: 'Invalid entityMutation: docId must be a string.' });
        }
      }

      // Period lock, duplicate ID check, and account verification (TransactionValidator) for transactions
      const seenTxIds = new Set<string>();

      const validatedTransactions: Transaction[] = [];
      for (const tx of (transactions || [])) {
        if (tx.id) {
          if (seenTxIds.has(tx.id)) {
            return res.status(400).json({ error: `Duplicate transaction ID '${tx.id}' in bulk request payload.` });
          }
          seenTxIds.add(tx.id);
        }
        tx.uid = user.uid;
        tx.workspaceId = wsId;
      
        const validatedTx = await TransactionValidator.validateAndPrepare(tx, {
          workspaceId: wsId,
          user: { uid: user.uid, admin: user.admin },
          wsData
        });
        validatedTransactions.push(validatedTx);
      }

      // ONE database transaction: the document change, the ledger entries, stock moved by cost of
      // goods sold entries, and the idempotency record all commit together or not at all.
      let body: Record<string, unknown> = { status: 'ok', count: validatedTransactions.length };
      await db.runTransaction(async (t) => {
        // Reads first
        const entityRef = entityMutation ? db.collection(entityMutation.collection).doc(entityMutation.docId) : null;
        let existingEntity: Record<string, unknown> | undefined;
        if (entityRef) {
          const existingDoc = await t.get(entityRef);
          existingEntity = existingDoc.exists ? existingDoc.data() : undefined;
          if (existingDoc.exists && existingDoc.data()?.workspaceId !== wsId) {
            throw new LedgerPostingError(403, `Forbidden: Entity ${entityMutation.docId} does not belong to authorized workspace.`);
          }
        }
        const refs = validatedTransactions.map(tx => db.collection('transactions').doc(tx.id));
        if (refs.length > 0) {
          const snaps = await t.getAll(...refs);
          const taken = snaps.find((s) => s.exists);
          if (taken) throw new LedgerPostingError(409, `Transaction ${taken.id} already exists`);
        }
        const stock = await prepareStockMoves(db, t, wsId, validatedTransactions);
        const bankLineRefs = bankLines.map(b => db.collection('bankLines').doc(b.id));
        if (bankLineRefs.length > 0) {
          const takenLine = (await t.getAll(...bankLineRefs)).find((snap: { exists: boolean }) => snap.exists);
          if (takenLine) throw new LedgerPostingError(409, `Bank line ${takenLine.id} already exists`);
          const postedIds = new Set(validatedTransactions.map(tx => tx.id));
          const unknown = bankLines.find(b => b.matchedTransactionId && !postedIds.has(b.matchedTransactionId));
          if (unknown) throw new LedgerPostingError(400, `Bank line ${unknown.id} points to a transaction outside this request`);
        }
        const idempotencyRef = scopedIdempotencyKey ? db.collection('idempotencyKeys').doc(scopedIdempotencyKey) : null;
        if (idempotencyRef) {
          const replay = await t.get(idempotencyRef);
          if (replay.exists) { body = replay.data()?.body || body; return; }
        }

        // Writes
        if (entityRef && (entityMutation.action === 'create' || entityMutation.action === 'update')) {
          const schemaMap: Record<string, z.ZodObject<z.ZodRawShape>> = { invoices: InvoiceSchema, bills: BillSchema, orders: OrderSchema, projects: ProjectSchema, creditNotes: CreditNoteSchema, vendorCredits: VendorCreditSchema };
          const schema = schemaMap[entityMutation.collection];
          if (!schema) throw new Error(`Forbidden: No schema for entityMutation collection '${entityMutation.collection}'.`);
          // An update sends only the changed fields: check those, and never fill in defaults for the rest
          const sent = { ...(entityMutation.data || {}), workspaceId: wsId };
          const parsed = (entityMutation.action === 'update' ? schema.partial() : schema).parse(sent);
          const validatedData = entityMutation.action === 'update' ? Object.fromEntries(Object.entries(parsed).filter(([k]) => k in sent)) : parsed;
          // who approved an invoice is decided here, not by the request (BE-04, L-191)
          if (entityMutation.collection === 'invoices') {
            try {
              Object.assign(validatedData, serverApproval(existingEntity, validatedData, wsData || {}, user.uid, new Date().toISOString()));
            } catch (err) {
              if (err instanceof ApprovalRefused) throw new LedgerPostingError(403, err.message);
              throw err;
            }
          }
          t.set(entityRef, { ...validatedData, uid: user.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else if (entityRef && entityMutation.action === 'delete') {
          t.delete(entityRef);
          // what was deleted, kept in the audit trail with the deletion itself (CA-10)
          if (existingEntity) {
            await writeServerAuditLog({
              workspaceId: wsId, uid: user.uid, email: user.email, action: 'DOCUMENT_DELETED',
              entityType: entityMutation.collection, entityId: entityRef.id,
              details: { description: deletionSentence(entityMutation.collection, entityRef.id, existingEntity), deleted: deletionSnapshot(existingEntity) },
            }, { db, tx: t });
          }
        }
        validatedTransactions.forEach((tx, j) => t.create(refs[j], { ...tx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }));
        stock.apply();
        bankLines.forEach((b, j) => t.create(bankLineRefs[j], { ...b, matchedTransactionId: b.matchedTransactionId ?? null, workspaceId: wsId, uid: user.uid, createdAt: new Date().toISOString() }));
        if (stock.warnings.length > 0) body = { ...body, warnings: stock.warnings };
        if (idempotencyRef) t.set(idempotencyRef, { createdAt: FieldValue.serverTimestamp(), code: 200, body, workspaceId: wsId });
      });

      res.json(body);
    } catch (e) {
      console.error('[BULK TRANSACTIONS ERROR]', e);
      res.status(e instanceof LedgerPostingError ? e.status : 400).json({ error: errorMessage(e) });
    }
  });

  // Rule actions (D-3 / K-39): move the non-bank side of bank entries to another account, all or none
  const recategorizeSchema = z.object({
    workspaceId: z.string().min(1),
    changes: z.array(z.object({ id: z.string().min(1), bankAccountId: z.string().min(1), toAccountId: z.string().min(1), expectedUpdatedAt: z.string().optional() }).strict()).min(1).max(MAX_RECATEGORIZE),
  }).strict();
  transactionRouter.post('/recategorize', async (req, res) => {
    try {
      const { workspaceId, changes } = recategorizeSchema.parse(req.body);
      const user = requestUser(req);
      res.json({ status: 'success', ...(await recategorize(getDb(), { workspaceId, uid: user.uid, email: user.email, changes })) });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: e.issues });
      if (e instanceof RecategorizeError) return res.status(e.status).json({ error: e.message, ...(e.entryId ? { entryId: e.entryId } : {}) });
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  // A batch endpoint for mass updates
  transactionRouter.post('/batch', async (req, res) => {
     try {
       const { updates, workspaceId } = req.body;
       const user = requestUser(req);
       const db = getDb();
       if (!workspaceId || !Array.isArray(updates) || updates.length === 0) {
         return res.status(400).json({ error: "Missing workspaceId or updates" });
       }

       const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
       if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid) && !user.admin)) return res.status(403).json({ error: 'Not a member' });

       const wsData = wsDoc.data();
       // writers only: a viewer is a member too
       if (!user.admin && !['owner', 'accountant', 'bookkeeper'].includes(workspaceRole(wsData as never, user.uid))) return res.status(403).json({ error: 'Only owners, accountants and bookkeepers change entries' });
       const allowedStatuses = ['draft', 'pending', 'certified', 'void', 'reconciled', 'completed', 'failed', 'flagged', 'reviewed', 'overdue', 'approved'];

       // Chunk updates in batches of 400 to respect Firestore write limits
       const BATCH_CHUNK_SIZE = 400;
       for (let offset = 0; offset < updates.length; offset += BATCH_CHUNK_SIZE) {
         const chunkUpdates = updates.slice(offset, offset + BATCH_CHUNK_SIZE);
         const txRefs = chunkUpdates.map((u: { id: string }) => db.collection('transactions').doc(u.id));
         const txDocs = await db.getAll(...txRefs);
         const batch = db.batch();

         for (let i = 0; i < txDocs.length; i++) {
           const txDoc = txDocs[i];
           if (!txDoc.exists) throw new Error(`Transaction ${chunkUpdates[i].id} not found`);
         
           const txData = txDoc.data();
           if (txData?.workspaceId !== workspaceId) throw new Error(`Transaction ${chunkUpdates[i].id} does not belong to this workspace`);
         
           if (txData?.date) assertPostingOpen(txData.date, wsData, user.uid);
           if ((txData?.status === 'certified' || txData?.status === 'void') && !user.admin) throw new Error(`Forbidden: Transaction ${chunkUpdates[i].id} status is locked.`);
         
           const updateData = { ...chunkUpdates[i].data };
           const expectedUpdatedAt = chunkUpdates[i].expectedUpdatedAt || updateData.expectedUpdatedAt;
           delete updateData.expectedUpdatedAt;

           if (isUpdatedAtMismatch(expectedUpdatedAt, txData?.updatedAt)) {
             return res.status(409).json({
               error: 'version_conflict',
               message: `Transaction ${chunkUpdates[i].id} was modified by another user.`,
               conflictTransactionId: chunkUpdates[i].id,
               currentTransaction: { ...txData, id: txDoc.id }
             });
           }

           if (updateData.workspaceId !== undefined || updateData.uid !== undefined) {
             throw new Error(`Restricted fields (workspaceId, uid) cannot be modified via batch update on transaction ${chunkUpdates[i].id}.`);
           }

           if (updateData.lines !== undefined) {
             const simulatedTx = { ...txData, ...updateData };
             DoubleEntryValidator.validateJournalEntry(simulatedTx as Transaction);
           }

           if (updateData.status && !allowedStatuses.includes(updateData.status)) {
             throw new Error(`Invalid status '${updateData.status}' provided for transaction ${chunkUpdates[i].id}.`);
           }

           batch.update(txDoc.ref, { ...updateData, updatedAt: FieldValue.serverTimestamp() });
         }
       
         await batch.commit();
       }

       res.json({ status: 'ok' });
     } catch (e) {
      if (errorMessage(e) === 'Not a member') {
         return res.status(403).json({ error: errorMessage(e) });
      }
      res.status(400).json({ error: errorMessage(e) }); 
    }
  });
}
