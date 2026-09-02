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
        customerName: invoice.customerName,
        paymentToken: invoice.paymentToken,
        metadata: invoice.metadata
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

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const stripe = getStripe();
    const amount = invoice.totalCents || invoice.amountCents;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
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
      success_url: `${req.protocol}://${req.get('host')}/i/${token}?success=true`,
      cancel_url: `${req.protocol}://${req.get('host')}/i/${token}?canceled=true`,
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
