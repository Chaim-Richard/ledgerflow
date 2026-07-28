import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

export const invoiceEmailRouter = express.Router();

invoiceEmailRouter.post('/:invoiceId/send', async (req, res) => {
  try {
    const { workspaceId, toEmail, subject, body } = req.body;
    const invoiceId = req.params.invoiceId;

    if (!workspaceId || !toEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getFirestore();
    const invoiceRef = db.collection('workspaces').doc(workspaceId).collection('invoices').doc(invoiceId);
    
    const doc = await invoiceRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    const invoice = doc.data() as any || {};

    // Generate a payment token if it doesn't have one
    let paymentToken = invoice.paymentToken;
    if (!paymentToken) {
      paymentToken = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await invoiceRef.update({
        paymentToken,
        status: 'sent',
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

    const invoiceUrl = `${req.protocol}://${req.get('host')}/i/${paymentToken}`;

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
