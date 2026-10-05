import { errorMessage, requestUser } from '../auth/requestUser';
import express from 'express';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import type { Firestore } from '../db/firestore';
import { generateDocumentPdf } from '../services/pdfService';
import type { PdfDocument, PdfDocumentType, PdfWorkspace } from '../services/pdfService';
import type { Bill, CreditNote, Customer, Invoice, Payment, VendorCredit } from '../../types';
import { computeStatement } from '../reports/computeReports';
import { getLocalDateISO } from '../../lib/utils';
import { getTrustedAppUrl } from '../utils/urlHelper';
import { zipStore } from '../utils/zip';
import { z } from 'zod';

export const documentRouter = express.Router();

/** Stored documents a PDF can be made of: collection and the name used in "not found". */
const PDF_SOURCES = {
  invoice: { collection: 'invoices', label: 'Invoice' },
  estimate: { collection: 'estimates', label: 'Estimate' },
  creditNote: { collection: 'creditNotes', label: 'Credit Note' },
  payment: { collection: 'payments', label: 'Payment' },
  purchaseOrder: { collection: 'purchaseOrders', label: 'Purchase order' },
  bill: { collection: 'bills', label: 'Bill' },
  vendorCredit: { collection: 'vendorCredits', label: 'Vendor credit' },
} as const;
const PDF_TYPES: readonly PdfDocumentType[] = ['invoice', 'estimate', 'creditNote', 'payment', 'statement', 'purchaseOrder', 'bill', 'vendorCredit'];

/** A purchase order in the shape the PDF reads (its fields have their own names; BA-08). */
function purchaseOrderForPdf(po: Record<string, unknown>): PdfDocument {
  const items = Array.isArray(po.items) ? po.items as Array<Record<string, unknown>> : [];
  return {
    ...po,
    number: String(po.poNumber || po.number || ''),
    date: String(po.issueDate || po.date || ''),
    dueDate: typeof po.expectedDeliveryDate === 'string' ? po.expectedDeliveryDate : undefined,
    amountCents: Number(po.totalAmountCents) || 0,
    items: items.map(i => ({
      description: String(i.description || 'Item'),
      quantity: Number(i.quantity) || 1,
      amountCents: Number(i.totalCents ?? Math.round((Number(i.quantity) || 1) * (Number(i.unitPriceCents) || 0))),
    })),
  } as PdfDocument;
}
const isPdfType = (t: string): t is PdfDocumentType => (PDF_TYPES as readonly string[]).includes(t);

type DocType = keyof typeof PDF_SOURCES;

/** A document of this workspace ready for the PDF (null when missing or another workspace's). */
async function loadDocumentForPdf(db: Firestore, type: DocType, id: string, workspaceId: string, req: express.Request): Promise<{ docData: PdfDocument; paymentUrl?: string } | null> {
  const snap = await db.collection(PDF_SOURCES[type].collection).doc(id).get();
  const data = snap.exists ? snap.data() : undefined;
  if (!data || data.workspaceId !== workspaceId) return null;
  let paymentUrl: string | undefined;
  // a sent invoice has a payment page: its QR code goes on the PDF (Y-15)
  if (type === 'invoice' && typeof data.paymentToken === 'string' && data.paymentToken) {
    try { paymentUrl = `${getTrustedAppUrl(req).replace(/\/+$/, '')}/i/${data.paymentToken}`; } catch { paymentUrl = undefined; }
  }
  return { docData: type === 'purchaseOrder' ? purchaseOrderForPdf(data) : data as PdfDocument, paymentUrl };
}

const ZipSchema = z.object({
  workspaceId: z.string().min(1).max(200),
  type: z.enum(Object.keys(PDF_SOURCES) as [DocType, ...DocType[]]),
  ids: z.array(z.string().min(1).max(200)).min(1).max(100),
}).strict();

/**
 * Several documents of one kind as PDFs in one zip file (Y-18), e.g. the invoices chosen in the
 * list. Members only; documents of other workspaces or missing ones are left out.
 */
export async function handleZipRequest(req: express.Request, res: express.Response, dbOverride?: Firestore) {
  try {
    const user = requestUser(req);
    const body = ZipSchema.parse(req.body);
    const db = dbOverride || getDb();
    await validateWorkspaceMember(db, body.workspaceId, user);
    const wsSnap = await db.collection('workspaces').doc(body.workspaceId).get();
    const workspace: PdfWorkspace = wsSnap.exists ? (wsSnap.data() as PdfWorkspace) : { name: 'LedgerFlow Workspace' };
    const files: Array<{ name: string; data: Buffer }> = [];
    const used = new Set<string>();
    for (const id of [...new Set(body.ids)]) {
      const loaded = await loadDocumentForPdf(db, body.type, id, body.workspaceId, req);
      if (!loaded) continue;
      const base = `${body.type}_${String(loaded.docData.number || id).replace(/[^\p{L}\p{N}._-]+/gu, '-')}`;
      let name = `${base}.pdf`;
      for (let n = 2; used.has(name); n++) name = `${base}_${n}.pdf`;
      used.add(name);
      files.push({ name, data: await generateDocumentPdf(body.type, loaded.docData, workspace, { paymentUrl: loaded.paymentUrl }) });
    }
    if (files.length === 0) return res.status(404).json({ status: 'error', message: 'None of these documents were found' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${body.type}s_${files.length}.zip"`);
    return res.send(zipStore(files));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: err.issues[0]?.message || 'Invalid request' });
    if (errorMessage(err) === 'FORBIDDEN' || /not a member/i.test(errorMessage(err))) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    return res.status(500).json({ status: 'error', message: errorMessage(err) || 'Failed to build the zip' });
  }
}

export async function handlePdfRequest(req: express.Request, res: express.Response, dbOverride?: Firestore) {
  try {
    const user = requestUser(req);
    const { type, id } = req.params as Record<string, string>;
    const workspaceId = (req.query.workspaceId || req.body?.workspaceId || '') as string;

    if (!workspaceId) {
      return res.status(400).json({ status: 'error', message: 'workspaceId is required' });
    }

    if (!isPdfType(type)) {
      return res.status(400).json({ status: 'error', message: `Invalid document type. Must be one of: ${PDF_TYPES.join(', ')}` });
    }

    const db = dbOverride || getDb();
    await validateWorkspaceMember(db, workspaceId, user);

    // Fetch workspace
    const wsSnap = await db.collection('workspaces').doc(workspaceId).get();
    const workspace: PdfWorkspace = wsSnap.exists ? (wsSnap.data() as PdfWorkspace) : { name: 'LedgerFlow Workspace' };

    let docData: PdfDocument | null = null;
    let paymentUrl: string | undefined;

    if (type !== 'statement') {
      const loaded = await loadDocumentForPdf(db, type, id, workspaceId, req);
      // another workspace's document answers like a missing one
      if (!loaded) return res.status(404).json({ status: 'error', message: `${PDF_SOURCES[type].label} not found` });
      ({ docData, paymentUrl } = loaded);
    } else {
      // id is customer/vendor contact ID
      const customerSnap = await db.collection('customers').doc(id).get();
      const vendorSnap = await db.collection('vendors').doc(id).get();
      const customerInWs = customerSnap.exists && customerSnap.data()?.workspaceId === workspaceId;
      const vendorInWs = vendorSnap.exists && vendorSnap.data()?.workspaceId === workspaceId;
      if ((customerSnap.exists || vendorSnap.exists) && !customerInWs && !vendorInWs) {
        return res.status(404).json({ status: 'error', message: 'Contact not found' });
      }
      const contactData = (customerSnap.exists ? { id, ...customerSnap.data() } : (vendorSnap.exists ? { id, ...vendorSnap.data() } : { id, name: 'Contact' })) as Customer & { address?: string };
      const contactType = customerSnap.exists ? 'customer' : 'vendor';

      const invoices = contactType === 'customer'
        ? (await db.collection('invoices').where('workspaceId', '==', workspaceId).where('customerId', '==', id).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice)
        : [];
      const bills = contactType === 'vendor'
        ? (await db.collection('bills').where('workspaceId', '==', workspaceId).where('vendorId', '==', id).get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Bill)
        : [];
      const paymentsSnap = await db.collection('payments').where('workspaceId', '==', workspaceId).get();
      const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);

      const creditsSnap = await db.collection(contactType === 'customer' ? 'creditNotes' : 'vendorCredits')
        .where('workspaceId', '==', workspaceId).where(contactType === 'customer' ? 'customerId' : 'vendorId', '==', id).get();
      const credits = creditsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CreditNote | VendorCredit);

      const stmt = computeStatement(contactData, invoices, bills, payments, '1970-01-01', '2099-12-31', contactType, credits);

      docData = {
        number: `STMT-${id.substring(0, 6).toUpperCase()}`,
        date: getLocalDateISO(),
        customerName: stmt.contactName,
        amountCents: stmt.endingBalanceCents,
        transactions: stmt.entries.map((item) => ({
          description: `${item.date} ${item.type} ${item.reference || ''}`,
          amountCents: item.amountCents || 0,
        }))
      };
    }

    const pdfBuffer = await generateDocumentPdf(type, docData, workspace, { paymentUrl });

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
  } catch (err) {
    if (errorMessage(err) === 'FORBIDDEN' || /not a member/i.test(errorMessage(err))) return res.status(403).json({ status: 'error', message: 'Forbidden' });
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ status: 'error', message: errorMessage(err) || 'Failed to generate PDF' });
  }
}

// Express passes `next` third: never let it stand in for the database (every download failed so)
documentRouter.post('/zip', (req, res) => handleZipRequest(req, res));
documentRouter.post('/:type/:id/pdf', (req, res) => handlePdfRequest(req, res));
documentRouter.get('/:type/:id/pdf', (req, res) => handlePdfRequest(req, res));
