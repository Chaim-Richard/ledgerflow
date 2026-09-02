import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY as string;
    stripeClient = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
  }
  return stripeClient;
}

export const publicInvoiceRouter = express.Router();

publicInvoiceRouter.get('/:token', async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || typeof token !== 'string' || !/^pay_[a-zA-Z0-9_-]{10,128}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    const db = getFirestore();
    
    const snapshot = await db.collectionGroup('invoices').where('paymentToken', '==', token).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = snapshot.docs[0];
    const invoice = doc.data();

    res.json({
      invoice: {
        id: invoice.id || doc.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate,
        status: invoice.status,
        amountCents: invoice.amountCents,
        totalCents: invoice.totalCents,
        currency: invoice.currency || 'USD',
        customerName: invoice.customerName,
        paymentToken: invoice.paymentToken,
        lines: Array.isArray(invoice.lines) ? invoice.lines.map((l: any) => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          amountCents: l.amountCents
        })) : []
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicInvoiceRouter.post('/:token/pay', async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || typeof token !== 'string' || !/^pay_[a-zA-Z0-9_-]{10,128}$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    const db = getFirestore();
    
    const snapshot = await db.collectionGroup('invoices').where('paymentToken', '==', token).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = snapshot.docs[0];
    const invoice = doc.data();

    const payableStatuses = ['sent', 'unpaid', 'pending', 'overdue'];
    if (!payableStatuses.includes(invoice.status) || invoice.isLocked === true) {
      return res.status(400).json({ 
        error: `Invoice cannot be paid. Current status: ${invoice.status || 'unknown'}${invoice.isLocked ? ' (locked)' : ''}` 
      });
    }

    const stripe = getStripe();
    const amount = invoice.totalCents || invoice.amountCents;

    // Use configured application URL to prevent host-header poisoning
    const hostHeader = (req.get('host') || 'localhost:3000').replace(/[^a-zA-Z0-9.:-]/g, '');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const origin = process.env.APP_URL || process.env.VITE_APP_URL || `${protocol}://${hostHeader}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || 'usd').toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.number}`,
              description: `Payment for ${invoice.customerName}`
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/i/${token}?success=true`,
      cancel_url: `${origin}/i/${token}?canceled=true`,
      client_reference_id: doc.id,
      metadata: {
        invoiceId: doc.id,
        workspaceId: invoice.workspaceId,
        paymentToken: token
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});
