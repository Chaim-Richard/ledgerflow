import express from 'express';
import crypto from 'crypto';
import { getDb } from '../db/firestore';
import { getTrustedAppUrl } from '../utils/urlHelper';
import { deliverInvoiceEmail } from '../services/emailService';
import { generateDocumentPdf } from '../services/pdfService';

export const invoiceEmailRouter = express.Router();

invoiceEmailRouter.post('/:invoiceId/send', async (req, res) => {
  try {
    const { workspaceId, toEmail, subject, body } = req.body;
    const invoiceId = req.params.invoiceId;
    const user = (req as any).user;

    if (!workspaceId || !toEmail || typeof toEmail !== 'string') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail.trim())) {
      return res.status(400).json({ error: 'Invalid recipient email format' });
    }

    if (subject && (typeof subject !== 'string' || subject.length > 200)) {
      return res.status(400).json({ error: 'Subject must be under 200 characters' });
    }
    if (body && (typeof body !== 'string' || body.length > 5000)) {
      return res.status(400).json({ error: 'Body must be under 5000 characters' });
    }

    const db = getDb();
    
    // Verify user is a member of the workspace
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    const wsData = wsDoc.data();
    if (!wsDoc.exists || (wsData?.uid !== user.uid && !wsData?.members?.includes(user.uid) && wsData?.admins?.[user.uid] !== true && !user.admin)) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this workspace.' });
    }

    // Invoices are stored in the canonical top-level 'invoices' collection
    const invoiceRef = db.collection('invoices').doc(invoiceId);
    
    const doc = await invoiceRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = doc.data() as any || {};
    if (invoice.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Forbidden: Invoice does not belong to this workspace.' });
    }

    // Generate a cryptographically secure payment token if it doesn't have one
    let paymentToken = invoice.paymentToken;
    if (!paymentToken) {
      paymentToken = `pay_${crypto.randomBytes(32).toString('hex')}`;
      await invoiceRef.update({
        paymentToken,
        metadata: {
          ...invoice.metadata,
          tokenCreatedAt: new Date().toISOString()
        }
      });
    }

    // Resolve trusted URL without host-header poisoning (#85)
    const baseUrl = getTrustedAppUrl(req);
    const invoiceUrl = `${baseUrl}/i/${paymentToken}`;

    // #84 - Honest email delivery: check if an actual email service provider is configured
    const hasEmailService = Boolean(process.env.RESEND_API_KEY || process.env.POSTMARK_SERVER_TOKEN || process.env.SENDGRID_API_KEY);

    if (!hasEmailService) {
      return res.status(503).json({
        success: false,
        delivered: false,
        error: 'EMAIL_SERVICE_NOT_CONFIGURED',
        message: 'No external email delivery service (RESEND_API_KEY, POSTMARK_SERVER_TOKEN, or SENDGRID_API_KEY) is configured on this server.',
        paymentToken,
        invoiceUrl
      });
    }

    // Format amount for display if cents available
    const totalAmount = typeof invoice.totalCents === 'number'
      ? `$${(invoice.totalCents / 100).toFixed(2)}`
      : (typeof invoice.amountCents === 'number' ? `$${(invoice.amountCents / 100).toFixed(2)}` : undefined);

    // Generate PDF attachment for outgoing invoice email
    let pdfAttachment;
    try {
      const pdfBuffer = await generateDocumentPdf('invoice', { id: invoiceId, ...invoice }, wsData);
      pdfAttachment = {
        filename: `invoice_${invoice.invoiceNumber || invoice.number || invoiceId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      };
    } catch (pdfErr) {
      console.warn('[InvoiceEmail] Could not generate PDF attachment:', pdfErr);
    }

    // Dispatch real email delivery
    let deliveryResult;
    try {
      deliveryResult = await deliverInvoiceEmail({
        toEmail,
        subject: subject || `Invoice ${invoice.invoiceNumber || invoice.number || invoiceId} from ${wsData?.name || 'LedgerFlow'}`,
        invoiceNumber: invoice.invoiceNumber || invoice.number || invoiceId,
        customerName: invoice.customerName || invoice.customer?.name,
        totalFormatted: totalAmount,
        invoiceUrl,
        customBody: body,
        pdfAttachment
      });
    } catch (deliveryError: any) {
      console.error('[InvoiceEmail] Provider delivery failure:', deliveryError);
      return res.status(502).json({
        success: false,
        delivered: false,
        error: 'EMAIL_DELIVERY_FAILED',
        message: deliveryError.message || 'External email service rejected the dispatch request.',
        paymentToken,
        invoiceUrl
      });
    }

    // Update invoice status to 'sent' ONLY upon verified delivery success
    await invoiceRef.update({
      status: invoice.status === 'draft' || invoice.status === 'pending' ? 'sent' : invoice.status,
      metadata: {
        ...invoice.metadata,
        lastSentAt: new Date().toISOString(),
        sentTo: toEmail,
        emailProvider: deliveryResult.provider,
        emailMessageId: deliveryResult.messageId
      }
    });

    res.json({
      success: true,
      delivered: true,
      provider: deliveryResult.provider,
      messageId: deliveryResult.messageId,
      paymentToken,
      invoiceUrl
    });
  } catch (err) {
    console.error('Error sending invoice email:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
