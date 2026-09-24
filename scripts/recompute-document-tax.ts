import admin from 'firebase-admin';
import fs from 'node:fs';
import { calculateDocumentTax } from '../src/lib/documentMath';

// Initialize Firebase Admin
if (!admin.apps.length) {
  let firebaseConfig: any = {};
  try {
    firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  } catch (e) {}
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (projectId) {
    admin.initializeApp({ projectId });
  } else {
    admin.initializeApp();
  }
}

async function run() {
  const args = process.argv.slice(2);
  const workspaceIndex = args.indexOf('--workspace');
  const workspaceId = workspaceIndex !== -1 ? args[workspaceIndex + 1] : null;
  const apply = args.includes('--apply');

  if (!workspaceId) {
    console.error("Usage: npx tsx scripts/recompute-document-tax.ts --workspace <workspaceId> [--apply]");
    process.exit(1);
  }

  if (apply) {
    console.log("not implemented yet");
    process.exit(0);
  }

  const db = admin.firestore();

  console.log(`Recomputing document tax for workspace: ${workspaceId} (Read-only mode)`);

  // 1. Fetch Invoices
  const invoicesSnap = await db.collection('invoices')
    .where('workspaceId', '==', workspaceId)
    .get();

  console.log(`Found ${invoicesSnap.size} invoices total.`);

  for (const doc of invoicesSnap.docs) {
    const data = doc.data() || {};
    if (data.status === 'draft' || data.status === 'void') {
      continue;
    }

    const storedTax = data.taxAmountCents ?? data.taxCents ?? data.salesTaxCents ?? 0;
    const correctTax = calculateDocumentTax({
      amountCents: data.amountCents,
      taxRate: data.taxRate,
      taxInclusive: data.taxInclusive,
      discountCents: data.discountCents,
      retainageCents: data.retainageCents
    });

    if (storedTax !== correctTax) {
      console.log(`Invoice mismatch [${doc.id}]: stored tax = ${storedTax}, correct tax = ${correctTax}`);
    }
  }

  // 2. Fetch Bills
  const billsSnap = await db.collection('bills')
    .where('workspaceId', '==', workspaceId)
    .get();

  console.log(`Found ${billsSnap.size} bills total.`);

  for (const doc of billsSnap.docs) {
    const data = doc.data() || {};
    if (data.status === 'draft' || data.status === 'void') {
      continue;
    }

    const storedTax = data.taxAmountCents ?? data.taxCents ?? data.salesTaxCents ?? 0;
    const correctTax = calculateDocumentTax({
      amountCents: data.amountCents,
      taxRate: data.taxRate,
      taxInclusive: data.taxInclusive,
      discountCents: data.discountCents,
      retainageCents: data.retainageCents
    });

    if (storedTax !== correctTax) {
      console.log(`Bill mismatch [${doc.id}]: stored tax = ${storedTax}, correct tax = ${correctTax}`);
    }
  }

  console.log("Recomputation completed successfully.");
  process.exit(0);
}

run().catch(err => {
  console.error("Recomputation script failed:", err);
  process.exit(1);
});
