import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { z } from 'zod';

export const invoiceEmailRouter = express.Router();

invoiceEmailRouter.post('/:invoiceId/send', async (req, res) => {
  try {
    const { workspaceId, toEmail, subject, body } = req.body;
    const invoiceId = req.params.invoiceId;
    const user = (req as any).user;

    if (!workspaceId || !toEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getFirestore();
    
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
        status: invoice.status === 'draft' || invoice.status === 'pending' ? 'sent' : invoice.status,
        metadata: {
          ...invoice.metadata,
          lastSentAt: new Date().toISOString(),
          sentTo: toEmail
        }
      });
    } else {
      await invoiceRef.update({
        status: invoice.status === 'pending' || invoice.status === 'draft' ? 'sent' : invoice.status,
        metadata: {
          ...invoice.metadata,
          lastSentAt: new Date().toISOString(),
          sentTo: toEmail
        }
      });
    }

    const host = (req.get('host') || 'localhost:3000').replace(/[^a-zA-Z0-9.:-]/g, '');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const invoiceUrl = `${baseUrl}/i/${paymentToken}`;

    // Here we would normally use Resend or Postmark.
    // e.g. await resend.emails.send({ ... })
    console.log(`[Email Service Mock] Sending invoice ${invoice.number} to ${toEmail}`);
    console.log(`[Email Service Mock] Subject: ${subject}`);
    console.log(`[Email Service Mock] Payment Link: ${invoiceUrl}`);
    console.log(`[Email Service Mock] Body: ${body}`);

    res.json({ success: true, paymentToken, invoiceUrl });
  } catch (err) {
    console.error('Error sending invoice email:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
