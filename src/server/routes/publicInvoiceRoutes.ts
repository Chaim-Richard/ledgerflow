import express from 'express';
import { getDb } from '../db/firestore';
import { getTrustedAppUrl } from '../utils/urlHelper';
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
    const db = getDb();
    
    // Check top-level collection first, with collectionGroup fallback
    let snapshot = await db.collection('invoices').where('paymentToken', '==', token).limit(1).get();
    if (snapshot.empty) {
      snapshot = await db.collectionGroup('invoices').where('paymentToken', '==', token).limit(1).get();
    }
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = snapshot.docs[0];
    const invoice = doc.data();

    const lineTotal = Array.isArray(invoice.lines) 
      ? invoice.lines.reduce((sum: number, l: any) => {
          const lineAmt = typeof l.amountCents === 'number' 
            ? l.amountCents 
            : Math.round((Number(l.quantity) || 1) * (Number(l.unitPriceCents) || 0));
          return sum + lineAmt;
        }, 0)
      : 0;

    const totalInvoiceAmount = typeof invoice.totalCents === 'number'
      ? invoice.totalCents
      : (typeof invoice.amountCents === 'number' ? invoice.amountCents : lineTotal);
    const amountPaid = typeof invoice.amountPaidCents === 'number' 
      ? invoice.amountPaidCents 
      : (typeof invoice.paidAmountCents === 'number' ? invoice.paidAmountCents : 0);
    const remainingBalance = Math.max(0, totalInvoiceAmount - amountPaid);

    res.json({
      invoice: {
        id: invoice.id || doc.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate,
        status: invoice.status,
        amountCents: totalInvoiceAmount,
        totalCents: totalInvoiceAmount,
        amountPaidCents: amountPaid,
        remainingBalanceCents: remainingBalance,
        currency: invoice.currency || 'USD',
        customerName: invoice.customerName,
        paymentToken: invoice.paymentToken,
        lines: Array.isArray(invoice.lines) ? invoice.lines.map((l: any) => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          amountCents: typeof l.amountCents === 'number' ? l.amountCents : Math.round((Number(l.quantity) || 1) * (Number(l.unitPriceCents) || 0))
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
    const db = getDb();
    
    let snapshot = await db.collection('invoices').where('paymentToken', '==', token).limit(1).get();
    if (snapshot.empty) {
      snapshot = await db.collectionGroup('invoices').where('paymentToken', '==', token).limit(1).get();
    }
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = snapshot.docs[0];
    const invoice = doc.data();

    const payableStatuses = ['sent', 'unpaid', 'pending', 'overdue', 'approved', 'invoiced'];
    if (!payableStatuses.includes(invoice.status) || invoice.isLocked === true) {
      return res.status(400).json({ 
        error: `Invoice cannot be paid. Current status: ${invoice.status || 'unknown'}${invoice.isLocked ? ' (locked)' : ''}` 
      });
    }

    const stripe = getStripe();
    const lineTotal = Array.isArray(invoice.lines)
      ? invoice.lines.reduce((sum: number, l: any) => {
          const lineAmt = typeof l.amountCents === 'number' 
            ? l.amountCents 
            : Math.round((Number(l.quantity) || 1) * (Number(l.unitPriceCents) || 0));
          return sum + lineAmt;
        }, 0)
      : 0;

    const totalInvoiceAmount = typeof invoice.totalCents === 'number'
      ? invoice.totalCents
      : (typeof invoice.amountCents === 'number' ? invoice.amountCents : lineTotal);
    const amountPaid = typeof invoice.amountPaidCents === 'number' 
      ? invoice.amountPaidCents 
      : (typeof invoice.paidAmountCents === 'number' ? invoice.paidAmountCents : 0);
    const remainingBalance = totalInvoiceAmount - amountPaid;

    if (!Number.isInteger(remainingBalance) || remainingBalance <= 0) {
      return res.status(400).json({ error: 'Invoice has no outstanding unpaid balance or is already paid.' });
    }

    // Use configured trusted application URL to prevent host-header poisoning (#85)
    const origin = getTrustedAppUrl(req);

    const idempotencyKey = `checkout_${doc.id}_${remainingBalance}_${token.slice(-16)}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || 'usd').toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.number || 'Payment'}`,
              description: `Payment for ${invoice.customerName || 'Services'}`
            },
            unit_amount: remainingBalance,
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
    }, {
      idempotencyKey
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});
