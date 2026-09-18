import express from 'express';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { generateDocumentPdf } from '../services/pdfService';
import { computeStatement } from '../reports/computeReports';

export const documentRouter = express.Router();

export async function handlePdfRequest(req: express.Request, res: express.Response, dbOverride?: any) {
  try {
    const authReq = req as any;
    const { type, id } = req.params;
    const workspaceId = (req.query.workspaceId || req.body?.workspaceId || '') as string;

    if (!workspaceId) {
      return res.status(400).json({ status: 'error', message: 'workspaceId is required' });
    }

    const validTypes = ['invoice', 'estimate', 'creditNote', 'payment', 'statement'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ status: 'error', message: `Invalid document type. Must be one of: ${validTypes.join(', ')}` });
    }

    const db = dbOverride || getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);

    // Fetch workspace
    const wsSnap = await db.collection('workspaces').doc(workspaceId).get();
    const workspace = wsSnap.exists ? wsSnap.data() : { name: 'LedgerFlow Workspace' };

    let docData: any = null;

    if (type === 'invoice') {
      const snap = await db.collection('invoices').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Invoice not found' });
      docData = snap.data();
    } else if (type === 'estimate') {
      const snap = await db.collection('estimates').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Estimate not found' });
      docData = snap.data();
    } else if (type === 'creditNote') {
      const snap = await db.collection('creditNotes').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Credit Note not found' });
      docData = snap.data();
    } else if (type === 'payment') {
      const snap = await db.collection('payments').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Payment not found' });
      docData = snap.data();
    } else if (type === 'statement') {
      // id is customer/vendor contact ID
      const customerSnap = await db.collection('customers').doc(id).get();
      const vendorSnap = await db.collection('vendors').doc(id).get();
      const contactData: any = customerSnap.exists ? { id, ...customerSnap.data() } : (vendorSnap.exists ? { id, ...vendorSnap.data() } : { id, name: 'Contact' });
      const contactType = customerSnap.exists ? 'customer' : 'vendor';

      const invsSnap = await db.collection('invoices').where('workspaceId', '==', workspaceId).get();
      const billsSnap = await db.collection('bills').where('workspaceId', '==', workspaceId).get();
      const paymentsSnap = await db.collection('payments').where('workspaceId', '==', workspaceId).get();

      const invoices = invsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const bills = billsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const payments = paymentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      const stmt: any = computeStatement(contactData, invoices, bills, payments, '1970-01-01', '2099-12-31', contactType);

      docData = {
        number: `STMT-${id.substring(0, 6).toUpperCase()}`,
        date: new Date().toISOString().substring(0, 10),
        customerName: stmt.contactName,
        customerEmail: contactData.email || '',
        customerAddress: contactData.billingAddress || contactData.address || '',
        amountCents: stmt.endingBalanceCents,
        transactions: stmt.entries.map((item: any) => ({
          date: item.date,
          description: `${item.type} ${item.number || item.reference || ''}`,
          amountCents: item.amountCents || 0,
          balanceCents: item.runningBalanceCents || 0
        }))
      };
    }

    const pdfBuffer = await generateDocumentPdf(type as any, docData, workspace);

    if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.json({
        status: 'success',
        data: {
          filename: `${type}_${id}.pdf`,
          pdfBase64: pdfBuffer.toString('base64')
        }
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${type}_${id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to generate PDF' });
  }
}

documentRouter.post('/:type/:id/pdf', handlePdfRequest);
documentRouter.get('/:type/:id/pdf', handlePdfRequest);

import { requireOpenPeriod } from '../middleware/periodLock';

export function createLedgerDocumentRouter(collectionName: string) {
  const router = express.Router();

  router.post('/', requireOpenPeriod(collectionName), async (req, res) => {
    try {
      const authReq = req as any;
      const { workspaceId, ...payload } = req.body;
      if (!workspaceId) {
        return res.status(400).json({ status: 'error', message: 'workspaceId is required' });
      }
      const db = getDb();
      await validateWorkspaceMember(db, workspaceId, authReq.user);
      const docRef = payload.id ? db.collection(collectionName).doc(payload.id) : db.collection(collectionName).doc();
      const docData = {
        ...payload,
        id: docRef.id,
        workspaceId,
        uid: authReq.user?.uid || 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await docRef.set(docData);
      res.json({ status: 'success', data: docData });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
      res.status(400).json({ status: 'error', message: err.message });
    }
  });

  router.put('/:id', requireOpenPeriod(collectionName), async (req, res) => {
    try {
      const authReq = req as any;
      const { id } = req.params;
      const db = getDb();
      const docRef = db.collection(collectionName).doc(id);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Not found' });
      const currentData = snap.data();
      await validateWorkspaceMember(db, currentData?.workspaceId, authReq.user);
      const updateData = { ...req.body, updatedAt: new Date().toISOString() };
      delete updateData.id;
      delete updateData.workspaceId;
      await docRef.update(updateData);
      res.json({ status: 'success', data: { ...currentData, ...updateData } });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
      res.status(400).json({ status: 'error', message: err.message });
    }
  });

  router.delete('/:id', requireOpenPeriod(collectionName), async (req, res) => {
    try {
      const authReq = req as any;
      const { id } = req.params;
      const db = getDb();
      const docRef = db.collection(collectionName).doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ status: 'error', message: `${collectionName} document not found` });
      }
      const data = snap.data();
      await validateWorkspaceMember(db, data?.workspaceId, authReq.user);

      if (data?.status && data.status !== 'draft') {
        return res.status(403).json({
          status: 'error',
          code: 'CANNOT_DELETE_POSTED',
          message: `Forbidden: Only draft documents can be deleted. Current status: ${data.status}. Posted documents must be voided, never deleted.`
        });
      }

      await docRef.delete();
      res.json({ status: 'success', message: `${collectionName} document deleted` });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
      res.status(400).json({ status: 'error', message: err.message });
    }
  });

  return router;
}

export const invoiceRouter = createLedgerDocumentRouter('invoices');
export const billRouter = createLedgerDocumentRouter('bills');
export const creditNoteRouter = createLedgerDocumentRouter('creditNotes');
export const vendorCreditRouter = createLedgerDocumentRouter('vendorCredits');

documentRouter.delete('/:type/:id', async (req, res) => {
  const typeMap: Record<string, string> = {
    invoice: 'invoices',
    bill: 'bills',
    creditNote: 'creditNotes',
    vendorCredit: 'vendorCredits',
    payment: 'payments',
    transaction: 'transactions'
  };
  const col = typeMap[req.params.type];
  if (!col) return res.status(400).json({ status: 'error', message: `Invalid document type: ${req.params.type}` });
  return requireOpenPeriod(col)(req, res, async () => {
    try {
      const authReq = req as any;
      const db = getDb();
      const docRef = db.collection(col).doc(req.params.id);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Document not found' });
      const data = snap.data();
      await validateWorkspaceMember(db, data?.workspaceId, authReq.user);
      if (data?.status && data.status !== 'draft') {
        return res.status(403).json({
          status: 'error',
          code: 'CANNOT_DELETE_POSTED',
          message: `Forbidden: Only draft documents can be deleted. Current status: ${data.status}. Posted documents must be voided, never deleted.`
        });
      }
      await docRef.delete();
      return res.json({ status: 'success', message: 'Document deleted' });
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
      return res.status(400).json({ status: 'error', message: err.message });
    }
  });
});
