import express from 'express';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { generateDocumentPdf } from '../services/pdfService';
import { computeStatement } from '../reports/computeReports';
import { getLocalDateISO } from '../../lib/utils';

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
      if (docData.workspaceId && docData.workspaceId !== workspaceId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Document belongs to another workspace' });
      }
    } else if (type === 'estimate') {
      const snap = await db.collection('estimates').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Estimate not found' });
      docData = snap.data();
      if (docData.workspaceId && docData.workspaceId !== workspaceId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Document belongs to another workspace' });
      }
    } else if (type === 'creditNote') {
      const snap = await db.collection('creditNotes').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Credit Note not found' });
      docData = snap.data();
      if (docData.workspaceId && docData.workspaceId !== workspaceId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Document belongs to another workspace' });
      }
    } else if (type === 'payment') {
      const snap = await db.collection('payments').doc(id).get();
      if (!snap.exists) return res.status(404).json({ status: 'error', message: 'Payment not found' });
      docData = snap.data();
      if (docData.workspaceId && docData.workspaceId !== workspaceId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Document belongs to another workspace' });
      }
    } else if (type === 'statement') {
      // id is customer/vendor contact ID
      const customerSnap = await db.collection('customers').doc(id).get();
      const vendorSnap = await db.collection('vendors').doc(id).get();
      if (customerSnap.exists && customerSnap.data()?.workspaceId && customerSnap.data().workspaceId !== workspaceId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Customer belongs to another workspace' });
      }
      if (vendorSnap.exists && vendorSnap.data()?.workspaceId && vendorSnap.data().workspaceId !== workspaceId) {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Vendor belongs to another workspace' });
      }
      const contactData: any = customerSnap.exists ? { id, ...customerSnap.data() } : (vendorSnap.exists ? { id, ...vendorSnap.data() } : { id, name: 'Contact' });
      const contactType = customerSnap.exists ? 'customer' : 'vendor';

      const invsSnap = contactType === 'customer'
        ? await db.collection('invoices').where('workspaceId', '==', workspaceId).where('customerId', '==', id).get()
        : { docs: [] };
      const billsSnap = contactType === 'vendor'
        ? await db.collection('bills').where('workspaceId', '==', workspaceId).where('vendorId', '==', id).get()
        : { docs: [] };
      const paymentsSnap = await db.collection('payments').where('workspaceId', '==', workspaceId).get();

      const invoices = invsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const bills = billsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const payments = paymentsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      const stmt: any = computeStatement(contactData, invoices, bills, payments, '1970-01-01', '2099-12-31', contactType);

      docData = {
        number: `STMT-${id.substring(0, 6).toUpperCase()}`,
        date: getLocalDateISO(),
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
