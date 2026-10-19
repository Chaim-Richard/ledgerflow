import { ApprovalRefused, serverApproval } from '../../services/invoiceApprovalGuard';
import { approvalEvent, notifyApproval, type ApprovalEvent } from '../../services/approvalNotifications';
import type { InvoiceApprovalRecord } from '../../../lib/invoiceApproval';
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
import { isPostable } from '../../../lib/txFilters';
import { errorMessage, requestUser } from '../../auth/requestUser';
import { isUpdatedAtMismatch } from './helpers';
import { assertSameRequest, requestPayloadHash } from '../../utils/idempotency';
import { LEDGER_WRITER_ROLES, roleInWorkspace } from '../../middleware/requireLedgerWriter';
import { writeServerAuditLog } from '../../services/auditLogService';
import { deletionSentence, deletionSnapshot } from '../../services/deletionRecord';
import { MAX_RECATEGORIZE, RecategorizeError, recategorize } from '../../services/recategorizeService';
import { workspaceRole } from '../../../lib/periodLock';
import { refusedLabels, refusedLabelsMessage } from '../../../lib/requiredLabels';
import { DELIVERY_COGS_TYPE, DELIVERY_RETURN_TYPE } from '../../../lib/deliveries';


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
      const payloadHash = scopedIdempotencyKey ? requestPayloadHash(req.body) : undefined;

      if ((!Array.isArray(transactions) || transactions.length === 0) && !entityMutation && bankLines.length === 0) {
        return res.json({ status: 'ok', count: 0 });
      }

      if (scopedIdempotencyKey) {
        const idempotencyDoc = await db.collection('idempotencyKeys').doc(scopedIdempotencyKey).get();
        if (idempotencyDoc.exists) {
          try { assertSameRequest(idempotencyDoc.data(), user.uid, payloadHash); } catch (err) { return res.status(409).json({ error: errorMessage(err) }); }
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

      // BF-08 step 2: a delivery's cost entries are made by the delivery (Deliver on the order), never posted directly
      const delivery = validatedTransactions.find(tx => tx.metadata?.type === DELIVERY_COGS_TYPE || tx.metadata?.type === DELIVERY_RETURN_TYPE);
      if (delivery) return res.status(400).json({ error: 'Deliver goods from the order (Deliver), not as an entry', transactionId: delivery.id });

      // Z-12: a required label whose rule refuses stops an entry a person typed without it. Entries
      // made with bank lines imported in this request are saved and listed instead: an import never stops.
      const imported = new Set(bankLines.map(b => b.matchedTransactionId).filter(Boolean));
      for (const tx of validatedTransactions) {
        const missing = imported.has(tx.id) ? [] : refusedLabels(tx, wsData?.dimensions);
        if (missing.length > 0) return res.status(400).json({ error: refusedLabelsMessage(missing), transactionId: tx.id, missingLabels: missing });
      }

      // ONE database transaction: the document change, the ledger entries, stock moved by cost of
      // goods sold entries, and the idempotency record all commit together or not at all.
      let body: Record<string, unknown> = { status: 'ok', count: validatedTransactions.length };
      // S-09: an approval asked for or decided with this save, told after it commits
      let approvalNotice: { invoiceId: string; invoice: Record<string, unknown>; event: ApprovalEvent } | null = null;
      await db.runTransaction(async (t) => {
        approvalNotice = null;
        // Reads first
        // AUD-07: a replay is recognised first, before any other read or check, and only for the same
        // user and the same request
        const idempotencyRef = scopedIdempotencyKey ? db.collection('idempotencyKeys').doc(scopedIdempotencyKey) : null;
        if (idempotencyRef) {
          const replay = await t.get(idempotencyRef);
          if (replay.exists) {
            try { assertSameRequest(replay.data(), user.uid, payloadHash); } catch (err) { throw new LedgerPostingError(409, errorMessage(err)); }
            body = replay.data()?.body || body; return;
          }
        }
        // AUD-08: the closing date as it is at commit — a month closed after the checks above but
        // before this save refuses the save instead of posting into the closed month
        const wsNow = (await t.get(db.collection('workspaces').doc(wsId))).data();
        // authority at commit: the role and membership as they are now, read in this transaction, so a
        // role taken away after the first check (middleware) cannot still let this save through
        if (!user.admin) {
          const isMember = wsNow?.uid === user.uid || (Array.isArray(wsNow?.members) && wsNow.members.includes(user.uid));
          if (!wsNow || !isMember || !LEDGER_WRITER_ROLES.includes(roleInWorkspace(wsNow, user.uid))) {
            throw new LedgerPostingError(403, 'You no longer have permission to change these books');
          }
        }
        for (const tx of validatedTransactions) {
          const date = (tx as { date?: string }).date;
          if (date) {
            try { assertPostingOpen(date, wsNow as never, user.uid); } catch (err) { throw new LedgerPostingError(409, errorMessage(err)); }
          }
        }
        const entityRef = entityMutation ? db.collection(entityMutation.collection).doc(entityMutation.docId) : null;
        let existingEntity: Record<string, unknown> | undefined;
        if (entityRef) {
          const existingDoc = await t.get(entityRef);
          existingEntity = existingDoc.exists ? existingDoc.data() : undefined;
          if (existingDoc.exists && existingDoc.data()?.workspaceId !== wsId) {
            throw new LedgerPostingError(403, `Forbidden: Entity ${entityMutation.docId} does not belong to authorized workspace.`);
          }
        }
        // DEP-1: an invoice made from an estimate/order never takes the order past its total — the
        // invoices already made from it are read here, inside the save, so two people invoicing the
        // same order at once cannot both get through (a deposit is a payment, not an invoice)
        if (entityRef && entityMutation.collection === 'invoices' && (entityMutation.action === 'create' || entityMutation.action === 'update')) {
          const data = (entityMutation.data || {}) as { amountCents?: unknown; status?: unknown; metadata?: { convertedFromEstimateId?: unknown } };
          const estimateId = data.metadata?.convertedFromEstimateId ?? (existingEntity?.metadata as { convertedFromEstimateId?: unknown } | undefined)?.convertedFromEstimateId;
          const status = String(data.status ?? existingEntity?.status ?? '');
          if (typeof estimateId === 'string' && estimateId && status !== 'void' && status !== 'cancelled') {
            const est = await t.get(db.collection('estimates').doc(estimateId));
            if (est.exists && est.data()?.workspaceId === wsId) {
              const totalCents = Math.round(Number(est.data()?.amountCents) || 0);
              const made = await t.get(db.collection('invoices').where('workspaceId', '==', wsId).where('metadata.convertedFromEstimateId', '==', estimateId));
              const others = made.docs.filter(d => d.id !== entityMutation.docId && !['void', 'cancelled'].includes(String(d.data()?.status)))
                .reduce((sum, d) => sum + Math.round(Number(d.data()?.amountCents) || 0), 0);
              const thisCents = Math.round(Number(data.amountCents ?? existingEntity?.amountCents) || 0);
              if (totalCents > 0 && others + thisCents > totalCents) {
                throw new LedgerPostingError(409, `That is more than is left to invoice on this order (${(Math.max(0, totalCents - others) / 100).toFixed(2)} left)`);
              }
            }
          }
        }
        // INT-2 (BUG-03): one live posting per invoice, decided here on the server. The client builds the
        // reversal of the previous posting from what it has loaded; if that was out of date (another tab,
        // a retry after a lost answer) the invoice's live posting is still there and not reversed by this
        // request. Then: the very same posting again → this save already happened, answer as before and
        // write nothing; a different posting → refused, so the invoice is never counted twice.
        // the same for bills (INT-2 for bills): one live 'bill-accrual' per bill; and for the payment posted with
        // the document (INT-2 for payments): one live 'invoice-payment' / 'bill-payment' per document. Only when
        // every such entry of the request is already live and identical is it a replay; a stale save that adds or
        // changes one of them (e.g. marks the invoice paid from an old tab) is refused, never half-applied.
        const ACCRUAL_KINDS = [
          { type: 'invoice-accrual', key: 'invoiceId' }, { type: 'bill-accrual', key: 'billId' },
          { type: 'invoice-payment', key: 'invoiceId' }, { type: 'bill-payment', key: 'billId' },
        ] as const;
        const accruals = validatedTransactions.flatMap(tx => ACCRUAL_KINDS
          .filter(k => tx.metadata?.type === k.type && typeof (tx.metadata as Record<string, unknown> | undefined)?.[k.key] === 'string')
          .map(k => ({ tx, kind: k })));
        const same = (a: Transaction, b: Transaction) => a.date === b.date && Number(a.totalAmountCents) === Number(b.totalAmountCents)
          && JSON.stringify((a.lines || []).map(l => [l.accountId, l.amountCents])) === JSON.stringify((b.lines || []).map(l => [l.accountId, l.amountCents]));
        const replayedIds: string[] = [];
        let stale = '';
        for (const { tx: incoming, kind } of accruals) {
          const documentId = String((incoming.metadata as Record<string, unknown>)[kind.key]);
          const posted = await t.get(db.collection('transactions').where('workspaceId', '==', wsId).where(`metadata.${kind.key}`, '==', documentId));
          const docs = posted.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as Array<Transaction & { id: string }>;
          const reversed = new Set([...docs, ...validatedTransactions]
            .filter(x => x.metadata?.isReversal).map(x => String(x.metadata?.reversesTxId || x.metadata?.reversedTransactionId || '')));
          const live = docs.filter(x => x.metadata?.type === kind.type && !x.metadata?.isReversal && isPostable(x) && !reversed.has(x.id));
          if (live.length === 1 && same(live[0], incoming)) replayedIds.push(live[0].id);
          else if (live.length > 0) stale = kind.key === 'billId' ? 'bill' : 'invoice';
        }
        // some entries already live and the rest new: an old tab adding to a posted document
        if (!stale && replayedIds.length > 0 && replayedIds.length < accruals.length) stale = accruals[0].kind.key === 'billId' ? 'bill' : 'invoice';
        if (stale) throw new LedgerPostingError(409, `This ${stale} was changed or posted elsewhere (another tab or an earlier save). Reload it and save again.`);
        if (replayedIds.length > 0) {
          body = { status: 'ok', count: 0, replayed: true, transactionIds: replayedIds };
          return;
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
              const event = approvalEvent(existingEntity?.approval as InvoiceApprovalRecord | undefined, validatedData.approval as InvoiceApprovalRecord | undefined);
              if (event && entityRef) approvalNotice = { invoiceId: entityRef.id, invoice: { ...(existingEntity || {}), ...validatedData }, event };
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
        if (idempotencyRef) t.set(idempotencyRef, { createdAt: FieldValue.serverTimestamp(), code: 200, body, workspaceId: wsId, actor: user.uid, payloadHash });
      });

      const notice = approvalNotice as { invoiceId: string; invoice: Record<string, unknown>; event: ApprovalEvent } | null;
      if (notice) await notifyApproval(db, { workspaceId: wsId, ...notice, actorUid: user.uid });
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
       // #112: only these fields can change in a batch; totals, dates, currency and identity go
       // through the full entry editor (PUT) or /recategorize, which check everything
       const BATCH_FIELDS = new Set(['lines', 'description', 'status', 'tags', 'metadata', 'classId', 'locationId', 'projectId', 'dimensions', 'category', 'dimensions.category', 'dimensions.project', 'isLocked', 'isFlagged', 'isTransfer', 'transferDetails', 'verification', 'notes', 'memo', 'updatedAt']);
       if (updates.length > 2000) return res.status(400).json({ error: 'At most 2000 entries per batch' });
       const ids = updates.map((u: { id: unknown }) => String(u?.id ?? ''));
       if (ids.some(id => !id) || new Set(ids).size !== ids.length) return res.status(400).json({ error: 'Each entry once, with its id' });
       for (const u of updates as Array<{ id: string; data?: Record<string, unknown> }>) {
         const bad = Object.keys(u.data || {}).filter(k => k !== 'expectedUpdatedAt' && !BATCH_FIELDS.has(k));
         if (bad.length) return res.status(400).json({ error: `These fields cannot be changed in a batch: ${bad.join(', ')} (entry ${u.id})` });
       }

       // #113: everything is read and checked first, then written in ONE transaction — a refused
       // entry or a version conflict leaves every entry unchanged
       const conflict = await db.runTransaction(async (t) => {
         // AUD-08: the workspace (closing date, role) as it is at commit, not as it was read before
         const wsNow = (await t.get(db.collection('workspaces').doc(workspaceId))).data();
         if (!user.admin && (!wsNow || !(wsNow.uid === user.uid || (Array.isArray(wsNow.members) && wsNow.members.includes(user.uid))) || !LEDGER_WRITER_ROLES.includes(roleInWorkspace(wsNow, user.uid)))) throw new Error('Only owners, accountants and bookkeepers change entries');
         const txRefs = ids.map(id => db.collection('transactions').doc(id));
         const txDocs = await Promise.all(txRefs.map(r => t.get(r)));
         const accountIds = new Set<string>();
         for (const u of updates as Array<{ data?: { lines?: Array<{ accountId?: string }> } }>) for (const l of u.data?.lines || []) if (l?.accountId) accountIds.add(String(l.accountId));
         const accountDocs = await Promise.all([...accountIds].map(id => t.get(db.collection('chartAccounts').doc(id))));
         const ownAccounts = new Set(accountDocs.filter(d => d.exists && d.data()?.workspaceId === workspaceId).map(d => d.id));
         const writes: Array<{ ref: (typeof txRefs)[number]; data: Record<string, unknown> }> = [];
         for (let i = 0; i < txDocs.length; i++) {
           const txDoc = txDocs[i];
           const id = ids[i];
           if (!txDoc.exists) throw new Error(`Transaction ${id} not found`);
           const txData = txDoc.data();
           if (txData?.workspaceId !== workspaceId) throw new Error(`Transaction ${id} does not belong to this workspace`);
           if (txData?.date) assertPostingOpen(txData.date, wsNow as never, user.uid);
           const newDate = (updates[i].data as { date?: unknown } | undefined)?.date;
           if (typeof newDate === 'string' && newDate) assertPostingOpen(newDate, wsNow as never, user.uid);
           if ((txData?.status === 'certified' || txData?.status === 'void') && !user.admin) throw new Error(`Forbidden: Transaction ${id} status is locked.`);
           const updateData = { ...updates[i].data } as Record<string, unknown>;
           const expectedUpdatedAt = updates[i].expectedUpdatedAt || updateData.expectedUpdatedAt;
           delete updateData.expectedUpdatedAt;
           if (isUpdatedAtMismatch(expectedUpdatedAt as never, txData?.updatedAt)) {
             return { id, current: { ...txData, id: txDoc.id } };
           }
           if (updateData.lines !== undefined) {
             const lines = updateData.lines as Array<{ accountId?: string; amountCents?: number }>;
             if (!Array.isArray(lines) || lines.length < 2) throw new Error(`Entry ${id} needs at least two lines`);
             DoubleEntryValidator.validateJournalEntry({ ...txData, ...updateData } as Transaction);
             const unknown = lines.filter(l => !l.accountId || !ownAccounts.has(String(l.accountId)));
             if (unknown.length) throw new Error(`Entry ${id} uses an account that is not in this workspace`);
             const total = lines.reduce((sum, l) => sum + Math.max(0, Math.round(Number(l.amountCents) || 0)), 0);
             const before = Math.abs(Math.round(Number(txData?.totalAmountCents) || 0));
             if (before && total !== before) throw new Error(`Entry ${id}: a batch may move amounts between accounts but not change the total (${before} → ${total} cents); edit the entry instead`);
           }
           if (updateData.status && !allowedStatuses.includes(String(updateData.status))) {
             throw new Error(`Invalid status '${updateData.status}' provided for transaction ${id}.`);
           }
           writes.push({ ref: txDoc.ref, data: { ...updateData, updatedAt: FieldValue.serverTimestamp() } });
         }
         for (const w of writes) t.update(w.ref, w.data);
         return null;
       });
       if (conflict) {
         return res.status(409).json({
           error: 'version_conflict',
           message: `Transaction ${conflict.id} was modified by another user. Nothing in this batch was saved.`,
           conflictTransactionId: conflict.id,
           currentTransaction: conflict.current
         });
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
