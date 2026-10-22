import type { Firestore } from '../db/firestore';
import type { RequestUser } from '../auth/requestUser';
import { roleInWorkspace } from '../middleware/requireLedgerWriter';
import type { AuditLogEntryInput } from './auditLogService';
import { BulkRefusal } from './ledgerBulkCommit';
import {
  creditLimitCheck, creditLimitForeignNote, creditLimitRefusalMessage,
  type CreditLimitCustomer, type CreditLimitInvoice,
} from '../../lib/customerCreditLimits';

/**
 * EG-5: the customer's credit limit, enforced when an invoice is saved as issued, inside the very database transaction
 * that saves it (ledgerBulkCommit's `beforeWrite`), so two saves at once cannot both slip under the limit. The maths is
 * the report's (customerCreditLimits.ts creditLimitCheck): issued invoices only, the unpaid part, base currency only,
 * nothing converted. Over the limit is refused (409, in words) unless the request carries an override with a reason
 * from an owner or accountant; the override is kept on the invoice (metadata.creditLimitOverride) and in the audit log.
 * The audit entry is written by the commit with the save. Called again on each attempt of the transaction: it keeps no state of its own.
 */
export const CREDIT_LIMIT_OVERRIDE_ROLES = ['owner', 'accountant'];

type Tx = Parameters<Parameters<Firestore['runTransaction']>[0]>[0];

export interface CreditLimitOutcome {
  /** fields merged into the invoice's metadata */
  metadata?: Record<string, unknown>;
  /** added to the answer */
  body?: Record<string, unknown>;
  /** written with the save (after the transaction's reads) */
  audit?: AuditLogEntryInput;
}

export async function enforceCreditLimit(db: Firestore, t: Tx, input: {
  user: RequestUser;
  workspaceId: string;
  workspace: Record<string, unknown> | undefined;
  docId: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  existing?: Record<string, unknown>;
  override?: { reason: string };
}): Promise<CreditLimitOutcome> {
  if (input.action === 'delete') return {};
  const invoice = { ...(input.existing || {}), ...input.data, id: input.docId } as unknown as CreditLimitInvoice;
  if (!invoice.customerId) return {};
  const customerSnap = await t.get(db.collection('customers').doc(String(invoice.customerId)));
  const customerData = customerSnap.exists ? customerSnap.data() : undefined;
  if (!customerData || customerData.workspaceId !== input.workspaceId) return {};
  const customer = { ...customerData, id: customerSnap.id, name: String(customerData.name || 'the customer') } as unknown as CreditLimitCustomer;
  const home = String(input.workspace?.currency || 'USD');
  const others = (await t.get(db.collection('invoices').where('workspaceId', '==', input.workspaceId).where('customerId', '==', customer.id)))
    .docs.map(d => ({ ...d.data(), id: d.id }) as unknown as CreditLimitInvoice);
  const check = creditLimitCheck({ customer, others, invoice, before: input.existing as CreditLimitInvoice | undefined, homeCurrency: home });
  if (!check) return {};
  if (check.foreignCurrency) return { body: { creditLimitNote: creditLimitForeignNote(customer.name, check, home) } };
  if (!check.over) return {};

  const message = creditLimitRefusalMessage(customer.name, check, home);
  const figures = { limitCents: check.limitCents, owedCents: check.owedCents, thisCents: check.thisCents, totalCents: check.totalCents, currency: home };
  const role = input.user.admin ? 'owner' : roleInWorkspace(input.workspace, input.user.uid);
  const mayOverride = CREDIT_LIMIT_OVERRIDE_ROLES.includes(role);
  if (!input.override) throw new BulkRefusal(409, { error: message, code: 'CREDIT_LIMIT', creditLimit: figures, canOverride: mayOverride });
  if (!mayOverride) throw new BulkRefusal(403, { error: `${message}. Only an owner or accountant can issue it anyway`, code: 'CREDIT_LIMIT_OVERRIDE_REFUSED', creditLimit: figures });

  const record = { reason: input.override.reason, by: input.user.uid, role, at: new Date().toISOString(), ...figures };
  const audit: AuditLogEntryInput = {
    workspaceId: input.workspaceId, uid: input.user.uid, email: input.user.email, action: 'CREDIT_LIMIT_OVERRIDE',
    entityType: 'invoices', entityId: input.docId, severity: 'warning',
    details: { description: `${message}, issued anyway: ${input.override.reason}`, ...record },
  };
  return { metadata: { creditLimitOverride: record }, audit };
}
