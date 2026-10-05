import type { Firestore } from '../db/firestore';
import type { PdfDocument } from './pdfService';
import type { Bill, CreditNote, Customer, Invoice, Payment, Vendor, VendorCredit } from '../../types';
import { computeStatement } from '../reports/computeReports';
import { getLocalDateISO } from '../../lib/utils';

export interface LoadedStatement {
  contactType: 'customer' | 'vendor';
  contact: Customer | Vendor;
  endingBalanceCents: number;
  pdf: PdfDocument;
}

/**
 * A customer's or vendor's statement (all their documents, payments and credits, oldest first) as
 * PDF data: used by the statement PDF and by emailing statements (BE-07). Null when the contact
 * isn't in this workspace (another workspace's contact answers like a missing one).
 */
export async function loadStatement(db: Firestore, workspaceId: string, contactId: string): Promise<LoadedStatement | null> {
  const [customerSnap, vendorSnap] = await Promise.all([db.collection('customers').doc(contactId).get(), db.collection('vendors').doc(contactId).get()]);
  const customer = customerSnap.data();
  const vendor = vendorSnap.data();
  const contactType = customer?.workspaceId === workspaceId ? 'customer' : vendor?.workspaceId === workspaceId ? 'vendor' : null;
  if (!contactType) return null;
  const contact = { ...(contactType === 'customer' ? customer : vendor), id: contactId } as Customer | Vendor;
  const rows = async <T>(collection: string, field: string) =>
    (await db.collection(collection).where('workspaceId', '==', workspaceId).where(field, '==', contactId).get()).docs.map(d => ({ id: d.id, ...d.data() }) as T);

  const invoices = contactType === 'customer' ? await rows<Invoice>('invoices', 'customerId') : [];
  const bills = contactType === 'vendor' ? await rows<Bill>('bills', 'vendorId') : [];
  // the statement only reads this contact's payments: no need to load the whole workspace's
  const payments = await rows<Payment>('payments', 'contactId');
  const credits = contactType === 'customer' ? await rows<CreditNote>('creditNotes', 'customerId') : await rows<VendorCredit>('vendorCredits', 'vendorId');
  const stmt = computeStatement(contact, invoices, bills, payments, '1970-01-01', '2099-12-31', contactType, credits);
  return {
    contactType,
    contact,
    endingBalanceCents: stmt.endingBalanceCents,
    pdf: {
      number: `STMT-${contactId.substring(0, 6).toUpperCase()}`,
      date: getLocalDateISO(),
      customerName: stmt.contactName,
      amountCents: stmt.endingBalanceCents,
      transactions: stmt.entries.map(item => ({ description: `${item.date} ${item.type} ${item.reference || ''}`, amountCents: item.amountCents || 0 })),
    },
  };
}
