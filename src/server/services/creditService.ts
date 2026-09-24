import { FieldValue } from '../db/firestore';
import type { DocumentData, Firestore } from '../db/firestore';
import { calculateAmountDue } from '../../lib/documentMath';
import { resolveAccountRole } from '../../lib/accountUtils';
import { TransactionValidator } from '../../kernel/validation/TransactionValidator';
import type { ChartAccount } from '../../types';

/**
 * Customer credit notes and vendor credits after they are issued:
 * - apply: settle an open invoice (bill) with the credit. No ledger entry: issuing the credit
 *   already reduced receivables (payables); applying only links the two documents.
 * - refund: pay the credit out (customer) or receive it back (vendor): DR A/R, CR Cash
 *   (customer) or DR Cash, CR A/P (vendor), and lower what is left on the credit.
 * Each runs in one database transaction.
 */

export class CreditError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CreditError';
  }
}

export type CreditKind = 'customer' | 'vendor';

const SIDES = {
  customer: { credits: 'creditNotes', documents: 'invoices', party: 'customerId', control: 'ar', label: 'Credit note', documentLabel: 'invoice' },
  vendor: { credits: 'vendorCredits', documents: 'bills', party: 'vendorId', control: 'ap', label: 'Vendor credit', documentLabel: 'bill' },
} as const;

const USABLE_CREDIT = new Set(['open', 'partially_applied']);
const CLOSED_DOCUMENT = new Set(['draft', 'void', 'cancelled', 'rejected']);

function positiveCents(amountCents: unknown): number {
  if (typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new CreditError(400, 'Amount must be a positive whole number of cents.');
  }
  return amountCents;
}

function remainingOf(credit: DocumentData): number {
  return typeof credit.remainingCents === 'number' ? credit.remainingCents : credit.amountCents || 0;
}

function creditStatus(remaining: number): 'applied' | 'partially_applied' {
  return remaining === 0 ? 'applied' : 'partially_applied';
}

export interface ApplyCreditInput {
  workspaceId: string;
  kind: CreditKind;
  creditId: string;
  documentId: string;
  amountCents: number;
}

export async function applyCredit(db: Firestore, input: ApplyCreditInput) {
  const side = SIDES[input.kind];
  const amountCents = positiveCents(input.amountCents);
  const creditRef = db.collection(side.credits).doc(input.creditId);
  const documentRef = db.collection(side.documents).doc(input.documentId);

  return db.runTransaction(async (t) => {
    const [creditSnap, documentSnap] = await t.getAll(creditRef, documentRef);
    const credit = creditSnap.data();
    const document = documentSnap.data();
    if (!credit || credit.workspaceId !== input.workspaceId) throw new CreditError(404, `${side.label} not found`);
    if (!document || document.workspaceId !== input.workspaceId) throw new CreditError(404, `The ${side.documentLabel} was not found`);
    if (!USABLE_CREDIT.has(credit.status)) throw new CreditError(409, `${side.label} is ${credit.status}; nothing left to apply`);
    if (CLOSED_DOCUMENT.has(document.status)) throw new CreditError(409, `A ${document.status} ${side.documentLabel} can't be settled`);
    if (credit[side.party] !== document[side.party]) throw new CreditError(400, `The ${side.documentLabel} belongs to a different ${input.kind}`);
    if ((credit.currency || 'USD') !== (document.currency || 'USD')) throw new CreditError(400, 'The credit and the document are in different currencies');

    const remaining = remainingOf(credit);
    const due = calculateAmountDue(document);
    if (due === 0) throw new CreditError(409, `The ${side.documentLabel} is already paid`);
    if (amountCents > remaining) throw new CreditError(400, `Only ${remaining} cents are left on this credit`);
    if (amountCents > due) throw new CreditError(400, `Only ${due} cents are due on this ${side.documentLabel}`);

    const newRemaining = remaining - amountCents;
    const newPaid = (document.amountPaidCents || 0) + amountCents;
    const now = new Date().toISOString();
    t.update(creditRef, { remainingCents: newRemaining, status: creditStatus(newRemaining), updatedAt: now });
    t.update(documentRef, {
      amountPaidCents: newPaid,
      settledByRecordsCents: (document.settledByRecordsCents || 0) + amountCents,
      status: newPaid >= (document.amountCents || 0) ? 'paid' : 'partially_paid',
      updatedAt: now,
    });
    return { creditRemainingCents: newRemaining, documentAmountDueCents: due - amountCents };
  });
}

export interface RefundCreditInput {
  workspaceId: string;
  uid: string;
  kind: CreditKind;
  creditId: string;
  amountCents: number;
  cashAccountId: string;
  date: string;
  memo?: string;
}

export async function refundCredit(db: Firestore, input: RefundCreditInput) {
  const side = SIDES[input.kind];
  const amountCents = positiveCents(input.amountCents);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new CreditError(400, 'Date must be YYYY-MM-DD');
  const workspaceRef = db.collection('workspaces').doc(input.workspaceId);
  const creditRef = db.collection(side.credits).doc(input.creditId);
  const cashRef = db.collection('chartAccounts').doc(input.cashAccountId);

  return db.runTransaction(async (t) => {
    const [workspaceSnap, creditSnap, cashSnap] = await t.getAll(workspaceRef, creditRef, cashRef);
    const workspace = workspaceSnap.data();
    const credit = creditSnap.data();
    const cash = cashSnap.data() as ChartAccount | undefined;
    if (!workspace) throw new CreditError(404, 'Workspace not found');
    if (!credit || credit.workspaceId !== input.workspaceId) throw new CreditError(404, `${side.label} not found`);
    if (!cash || cash.workspaceId !== input.workspaceId || resolveAccountRole(cash) !== 'cash') {
      throw new CreditError(400, 'Choose a cash or bank account of this workspace');
    }
    if (workspace.lockDate && input.date <= workspace.lockDate) throw new CreditError(400, `Period is locked on or before ${workspace.lockDate}`);
    if (!USABLE_CREDIT.has(credit.status)) throw new CreditError(409, `${side.label} is ${credit.status}; nothing left to refund`);
    const remaining = remainingOf(credit);
    if (amountCents > remaining) throw new CreditError(400, `Only ${remaining} cents are left on this credit`);

    // Receivables / payables account: the workspace mapping, else the chart's first account with that role
    const accountsSnap = await t.get(db.collection('chartAccounts').where('workspaceId', '==', input.workspaceId));
    const accounts = accountsSnap.docs.map(d => ({ ...(d.data() as ChartAccount), id: d.id }));
    const mappedId = workspace.defaultAccountMappings?.[side.control];
    const control = accounts.find(a => a.id === mappedId) || accounts.find(a => resolveAccountRole(a) === side.control);
    if (!control) throw new CreditError(400, `Add an ${side.control === 'ar' ? 'Accounts Receivable' : 'Accounts Payable'} account first`);

    const description = `${side.label} ${credit.number || input.creditId} refund${input.memo ? `: ${input.memo}` : ''}`;
    const controlLine = { accountId: control.id, accountName: control.name, description };
    const cashLine = { accountId: cash.id || input.cashAccountId, accountName: cash.name, description };
    const lines = input.kind === 'customer'
      ? [{ ...controlLine, amountCents }, { ...cashLine, amountCents: -amountCents }]
      : [{ ...cashLine, amountCents }, { ...controlLine, amountCents: -amountCents }];
    const ledgerTx = await TransactionValidator.validateAndPrepare({
      id: db.collection('transactions').doc().id,
      workspaceId: input.workspaceId,
      uid: input.uid,
      date: input.date,
      description,
      totalAmountCents: amountCents,
      currency: credit.currency || workspace.currency || 'USD',
      exchangeRate: credit.exchangeRate || 1,
      status: 'completed',
      type: 'actual',
      metadata: { type: 'credit-refund', refundOfCreditId: input.creditId, creditKind: input.kind, [side.party]: credit[side.party] },
      lines,
    }, { workspaceId: input.workspaceId, user: { uid: input.uid }, wsData: workspace }, undefined, t);

    const newRemaining = remaining - amountCents;
    t.create(db.collection('transactions').doc(ledgerTx.id), { ...ledgerTx, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    t.update(creditRef, { remainingCents: newRemaining, status: creditStatus(newRemaining), updatedAt: new Date().toISOString() });
    return { transactionId: ledgerTx.id, creditRemainingCents: newRemaining };
  });
}
