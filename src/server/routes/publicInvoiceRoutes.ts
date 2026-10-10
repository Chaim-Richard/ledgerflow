import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { getTrustedAppUrl } from '../utils/urlHelper';
import { calculateAmountDue, depositAppliedCents } from '../../lib/documentMath';
import Stripe from 'stripe';
import { publicPortalRouter } from './customerPortalRoutes';
import { publicEstimateRouter } from './estimateSignRoutes';
import { recordInvoiceView } from '../services/invoiceViewService';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Payments are not set up yet (STRIPE_SECRET_KEY is missing).');
    stripeClient = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
  }
  return stripeClient;
}

export const publicInvoiceRouter = express.Router();
// the customer portal (K-27) shares this public route and its rate limit: /api/v1/invoices/public/portal/<token>
publicInvoiceRouter.use('/portal', publicPortalRouter);
// signing an estimate (Y-20): /api/v1/invoices/public/estimate/<token>
publicInvoiceRouter.use('/estimate', publicEstimateRouter);

const publicInvoiceTokenParamsSchema = z.object({
  token: z.string().regex(/^pay_[a-zA-Z0-9_-]{10,128}$/, 'Invalid payment token format')
});

const publicInvoicePayBodySchema = z.object({
  paymentMethod: z.string().optional()
}).passthrough();

publicInvoiceRouter.get('/:token', async (req, res) => {
  try {
    const parsedParams = publicInvoiceTokenParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Invalid token format', details: parsedParams.error.issues });
    }
    const { token } = parsedParams.data;
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

    const totalInvoiceAmount = typeof invoice.amountCents === 'number'
      ? invoice.amountCents
      : lineTotal;
    const amountPaid = typeof invoice.amountPaidCents === 'number' 
      ? invoice.amountPaidCents 
      : 0;
    // What is still due, by the one money rule (discounts, retainage, credits, payments)
    const remainingBalance = calculateAmountDue(invoice);
    // S-02: the customer opened it (recorded before answering: work after the answer may not run on the host)
    if (!['draft', 'void', 'voided'].includes(String(invoice.status || '').toLowerCase())) await recordInvoiceView(db, doc.ref, invoice);

    res.json({
      invoice: {
        id: invoice.id || doc.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate,
        status: invoice.status,
        amountCents: totalInvoiceAmount,
        amountPaidCents: amountPaid,
        depositCents: depositAppliedCents(invoice),
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
    const parsedParams = publicInvoiceTokenParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Invalid token format', details: parsedParams.error.issues });
    }
    const { token } = parsedParams.data;

    const parsedBody = publicInvoicePayBodySchema.safeParse(req.body || {});
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Invalid request payload', details: parsedBody.error.issues });
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

    const totalInvoiceAmount = typeof invoice.amountCents === 'number'
      ? invoice.amountCents
      : lineTotal;
    const amountPaid = typeof invoice.amountPaidCents === 'number' 
      ? invoice.amountPaidCents 
      : 0;
    // What is still due, by the one money rule (discounts, retainage, credits, payments)
    const remainingBalance = calculateAmountDue(invoice);

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
