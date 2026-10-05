import crypto from 'crypto';
import type { DocumentData, Firestore } from '../db/firestore';
import { calculateAmountDue } from '../../lib/documentMath';
import { dayNumber } from '../../lib/fiscalCalendar';
import { workspaceRole } from '../../lib/periodLock';
import { formatCurrency, formatTzDate } from '../../lib/utils';
import { renderEmail, resolveTemplate } from '../../lib/emailTemplates';
import type { EmailTemplateKey, EmailTemplates, TemplateValues } from '../../lib/emailTemplates';
import { isMailConfigured, sendMail } from './mailer';
import { notify } from './notificationService';
import { generateDocumentPdf } from './pdfService';

/**
 * Emailing an invoice or a payment reminder to the customer (S-01, BE-01, BL-03, BL-05, K-08).
 * - owner/accountant/bookkeeper; the invoice must be issued (a draft isn't in the books yet);
 * - addresses that bounced or complained are skipped (suppression list, BL-03);
 * - text from the workspace's templates (or the defaults), HTML + plain text, PDF attached;
 * - every attempt is logged in emailEvents (send log per document, BL-05), and the provider's
 *   bounce/complaint reports are added to the same log (emailWebhookRoutes.ts).
 */

export class EmailSendError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'EmailSendError';
  }
}

const WRITER_ROLES = ['owner', 'accountant', 'bookkeeper'];
const NOT_ISSUED = new Set(['draft', 'void', 'cancelled', 'rejected']);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function isSuppressed(db: Firestore, address: string): Promise<boolean> {
  const snap = await db.collection('emailEvents')
    .where('recipient', '==', address.trim().toLowerCase())
    .where('event', 'in', ['bounced', 'complaint'])
    .limit(1)
    .get();
  return !snap.empty;
}

export async function logEmailEvent(db: Firestore, event: DocumentData) {
  const ref = db.collection('emailEvents').doc();
  await ref.set({ id: ref.id, ...event, recipient: String(event.recipient || '').toLowerCase(), timestamp: new Date().toISOString() });
  return ref.id;
}

export interface EmailInvoiceInput {
  workspaceId: string;
  uid: string;
  invoiceId: string;
  template: Extract<EmailTemplateKey, 'invoice' | 'reminder'>;
  baseUrl: string;
  to?: string;
  subject?: string;
  body?: string;
  /** Scheduled reminders: no role check (the workspace's own schedule). */
  system?: boolean;
}

export async function emailInvoice(db: Firestore, input: EmailInvoiceInput) {
  const workspace = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
  if (!workspace) throw new EmailSendError(404, 'Workspace not found');
  if (!input.system && !WRITER_ROLES.includes(workspaceRole(workspace, input.uid))) throw new EmailSendError(403, 'Viewers cannot send emails');

  const invoiceRef = db.collection('invoices').doc(input.invoiceId);
  const invoice = (await invoiceRef.get()).data();
  if (!invoice || invoice.workspaceId !== input.workspaceId) throw new EmailSendError(404, 'Invoice not found');
  if (NOT_ISSUED.has(String(invoice.status))) {
    throw new EmailSendError(409, invoice.status === 'draft' ? 'Save the invoice as final (not a draft) before sending it' : `The invoice is ${invoice.status}`);
  }

  const customer = invoice.customerId ? (await db.collection('customers').doc(String(invoice.customerId)).get()).data() : undefined;
  const to = String(input.to || customer?.email || '').trim().toLowerCase();
  if (!EMAIL.test(to)) throw new EmailSendError(400, 'The customer has no valid email address');
  if (await isSuppressed(db, to)) throw new EmailSendError(409, `${to} bounced or reported an earlier email as spam; update the customer's email address`);
  if (!isMailConfigured()) throw new EmailSendError(503, 'Email sending is not set up yet (add an email provider key in the settings)');

  let token = typeof invoice.paymentToken === 'string' ? invoice.paymentToken : '';
  if (!token) token = `pay_${crypto.randomBytes(32).toString('hex')}`;

  const currency = String(invoice.currency || workspace.currency || 'USD');
  const today = formatTzDate(new Date(), typeof workspace.timezone === 'string' ? workspace.timezone : 'UTC');
  const due = typeof invoice.dueDate === 'string' ? invoice.dueDate.slice(0, 10) : '';
  const values: TemplateValues = {
    company: String(workspace.name || ''),
    customer: String(invoice.customerName || customer?.name || ''),
    number: String(invoice.number || input.invoiceId),
    amount: formatCurrency(Number(invoice.amountCents) || 0, currency),
    amount_due: formatCurrency(calculateAmountDue(invoice), currency),
    due_date: due,
    days_overdue: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? String(Math.max(0, dayNumber(today) - dayNumber(due))) : '0',
    link: `${input.baseUrl.replace(/\/+$/, '')}/i/${token}`,
  };
  const template = resolveTemplate(input.template, workspace.emailTemplates as EmailTemplates | undefined);
  const message = renderEmail({ subject: input.subject?.trim() || template.subject, body: input.body?.trim() || template.body }, values);

  let attachments;
  try {
    const pdf = await generateDocumentPdf('invoice', { ...invoice, id: input.invoiceId }, workspace, { paymentUrl: values.link });
    attachments = [{ filename: `invoice_${values.number}.pdf`, content: pdf, contentType: 'application/pdf' }];
  } catch {
    attachments = undefined;
  }

  const logBase = { workspaceId: input.workspaceId, documentType: 'invoice', documentId: input.invoiceId, invoiceId: input.invoiceId, template: input.template, subject: message.subject, recipient: to, sentBy: input.system ? 'schedule' : input.uid };
  let result;
  try {
    result = await sendMail({ to, subject: message.subject, html: message.html, text: message.text, attachments });
  } catch (err) {
    await logEmailEvent(db, { ...logBase, event: 'failed', error: err instanceof Error ? err.message.slice(0, 300) : String(err) });
    throw new EmailSendError(502, `The email could not be sent: ${err instanceof Error ? err.message : String(err)}`);
  }
  await logEmailEvent(db, { ...logBase, event: 'sent', provider: result.provider, messageId: result.messageId || null });

  const now = new Date().toISOString();
  const metadata = { ...(invoice.metadata || {}), lastSentAt: now, sentTo: to, sendCount: (Number(invoice.metadata?.sendCount) || 0) + 1 };
  if (input.template === 'reminder') {
    metadata.lastReminderAt = now;
    metadata.remindersSent = (Number(invoice.metadata?.remindersSent) || 0) + 1;
  }
  await invoiceRef.update({
    paymentToken: token,
    // pending/approved → sent (all are issued, already in the books); other statuses stay
    ...(invoice.status === 'pending' || invoice.status === 'approved' ? { status: 'sent' } : {}),
    metadata,
    updatedAt: now,
  });
  if (input.template === 'invoice') {
    await notify(db, {
      workspaceId: input.workspaceId, workspace, kind: 'invoice.sent',
      title: `Invoice ${values.number} emailed`,
      message: `Sent to ${to} (${values.customer || 'customer'}, ${values.amount_due} due).`,
      eventKey: `invoice.sent:${input.invoiceId}:${now}`, recordId: input.invoiceId,
      actorUid: input.system ? undefined : input.uid,
    });
  }
  return { to, subject: message.subject, provider: result.provider, messageId: result.messageId || null, invoiceUrl: values.link };
}

/**
 * Thank-you email after a payment (BE-02): when the workspace turned it on (Settings → Emails &
 * Reminders), the customer gets the "Payment received (thank you)" template for each invoice the
 * payment settled part of. Best effort: never throws, so a payment is never held up by an email;
 * every send or failure is in the invoice's send log. Returns what happened per invoice.
 */
export async function thankForPayment(db: Firestore, input: { workspaceId: string; allocations: Array<{ documentId: string; documentType: string; amountCents: number }> }): Promise<Array<{ invoiceId: string; result: string }>> {
  const out: Array<{ invoiceId: string; result: string }> = [];
  const invoices = (input.allocations || []).filter(a => a.documentType === 'invoice' && a.amountCents > 0);
  if (invoices.length === 0) return out;
  const workspace = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
  if (!workspace?.reminderSettings?.thankYou) return invoices.map(a => ({ invoiceId: a.documentId, result: 'off' }));
  for (const allocation of invoices) {
    let result: string;
    try {
      result = await sendReceipt(db, workspace, input.workspaceId, allocation.documentId, allocation.amountCents);
    } catch (err) {
      result = 'failed';
      await logEmailEvent(db, { workspaceId: input.workspaceId, documentType: 'invoice', documentId: allocation.documentId, invoiceId: allocation.documentId, template: 'receipt', event: 'failed', error: err instanceof Error ? err.message.slice(0, 300) : String(err), sentBy: 'payment' }).catch(() => undefined);
    }
    out.push({ invoiceId: allocation.documentId, result });
  }
  return out;
}

async function sendReceipt(db: Firestore, workspace: DocumentData, workspaceId: string, invoiceId: string, amountCents: number): Promise<string> {
  const invoice = (await db.collection('invoices').doc(invoiceId).get()).data();
  if (!invoice || invoice.workspaceId !== workspaceId) return 'no invoice';
  const customer = invoice.customerId ? (await db.collection('customers').doc(String(invoice.customerId)).get()).data() : undefined;
  const to = String(customer?.email || '').trim().toLowerCase();
  if (!EMAIL.test(to)) return 'no email';
  if (await isSuppressed(db, to)) return 'suppressed';
  if (!isMailConfigured()) return 'mail not set up';
  const currency = String(invoice.currency || workspace.currency || 'USD');
  const values: TemplateValues = {
    company: String(workspace.name || ''),
    customer: String(invoice.customerName || customer?.name || ''),
    number: String(invoice.number || invoiceId),
    amount: formatCurrency(amountCents, currency),
    amount_due: formatCurrency(calculateAmountDue(invoice), currency),
  };
  const message = renderEmail(resolveTemplate('receipt', workspace.emailTemplates as EmailTemplates | undefined), values);
  const sent = await sendMail({ to, subject: message.subject, html: message.html, text: message.text });
  await logEmailEvent(db, { workspaceId, documentType: 'invoice', documentId: invoiceId, invoiceId, template: 'receipt', subject: message.subject, recipient: to, sentBy: 'payment', event: 'sent', provider: sent.provider, messageId: sent.messageId || null });
  return 'sent';
}

/** The send log of a document (newest first): sends, failures, bounces, complaints. */
export async function emailLog(db: Firestore, workspaceId: string, documentId: string) {
  const snap = await db.collection('emailEvents').where('workspaceId', '==', workspaceId).where('documentId', '==', documentId).limit(200).get();
  return snap.docs
    .map(d => d.data())
    .map(e => ({ event: e.event, recipient: e.recipient, subject: e.subject || null, template: e.template || null, provider: e.provider || null, error: e.error || null, timestamp: e.timestamp }))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}
