const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const webhookCode = `
  // Stripe Webhook needs raw body
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'];
      let event;

      try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (webhookSecret && sig) {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
          event = JSON.parse(req.body.toString());
        }
      } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(\`Webhook Error: \${err.message}\`);
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        if (session.metadata?.invoiceId) {
          const invoiceId = session.metadata.invoiceId;
          const workspaceId = session.metadata.workspaceId;
          const amountTotal = session.amount_total;
          
          const db = getFirestore();
          const invoiceRef = db.collection('workspaces').doc(workspaceId).collection('invoices').doc(invoiceId);
          
          await db.runTransaction(async (t) => {
            const doc = await t.get(invoiceRef);
            if (!doc.exists) return;
            
            const inv = doc.data();
            if (inv.status !== 'paid') {
              t.update(invoiceRef, {
                status: 'paid',
                amountPaidCents: amountTotal,
                paidAt: new Date().toISOString()
              });
              
              const accountsSnap = await t.get(db.collection('workspaces').doc(workspaceId).collection('accounts'));
              const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              
              let cashAccount = accounts.find(a => a.subtype === 'cash' || (a.name || '').toLowerCase().includes('cash') || (a.name || '').toLowerCase().includes('bank') || (a.name || '').toLowerCase().includes('stripe'));
              let arAccount = accounts.find(a => a.subtype === 'accounts_receivable' || (a.name || '').toLowerCase().includes('receivable'));
              
              if (!cashAccount) cashAccount = { id: 'unknown_cash', name: 'Stripe Clearing' };
              if (!arAccount) arAccount = { id: 'unknown_ar', name: 'Accounts Receivable' };
              
              const txRef = db.collection('workspaces').doc(workspaceId).collection('transactions').doc();
              t.set(txRef, {
                uid: 'system',
                workspaceId,
                date: new Date().toLocaleDateString('en-CA'),
                description: \`Invoice \${inv.number} Payment via Stripe\`,
                totalAmountCents: amountTotal,
                currency: inv.currency || 'USD',
                exchangeRate: 1,
                status: 'completed',
                type: 'actual',
                createdAt: new Date().toISOString(),
                metadata: {
                  invoiceId,
                  stripeSessionId: session.id,
                  type: 'invoice-payment'
                },
                lines: [
                  {
                    accountId: cashAccount.id,
                    accountName: cashAccount.name,
                    amountCents: amountTotal, // Debit Cash
                    description: \`Stripe Payment for Invoice \${inv.number}\`,
                    exchangeRate: 1
                  },
                  {
                    accountId: arAccount.id,
                    accountName: arAccount.name,
                    amountCents: -amountTotal, // Credit AR
                    description: \`A/R Clearance for Invoice \${inv.number}\`,
                    exchangeRate: 1
                  }
                ]
              });
            }
          });
        }
      }

      res.json({received: true});
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  });
`;

// replace old webhook if exists
if (code.includes('/api/webhook/stripe')) {
  // Regex match the whole block and replace
  const regex = /\/\/ Stripe Webhook needs raw body[\s\S]*?res\.status\(500\)\.send\('Internal Server Error'\);\n    }\n  }\);/g;
  code = code.replace(regex, webhookCode.trim());
  fs.writeFileSync('server.ts', code);
}
