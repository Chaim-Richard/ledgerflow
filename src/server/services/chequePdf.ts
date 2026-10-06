import PDFDocument from 'pdfkit';
import { amountInWords } from '../../lib/amountInWords';
import { drawLine } from './pdfText';
import { fonts } from './pdfService';

/**
 * Cheque printing (BE-13): a payment made to a vendor printed on US Letter cheque stock with the
 * cheque on top and two vouchers below (one for the vendor, one for the records), the common
 * "cheque on top" layout. The amount is printed in figures behind asterisks and written out in words;
 * the vouchers list the bills it pays. The layout is worked out first (`layoutCheque`, tested), then
 * drawn. Nothing is posted: the payment already is.
 */
export class ChequeError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface ChequePayment {
  direction?: string;
  status?: string;
  amountCents?: number;
  date?: string;
  paymentDate?: string;
  number?: string;
  reference?: string;
  referenceNumber?: string;
  contactName?: string;
  entityName?: string;
  memo?: string;
  currency?: string;
  allocations?: Array<{ documentId: string; documentType?: string; amountCents: number }>;
  unappliedCents?: number;
}

export interface ChequeLayout {
  company: string;
  chequeNumber: string;
  date: string;
  payee: string;
  figures: string;
  words: string;
  memo: string;
  stub: Array<{ label: string; amount: string }>;
  total: string;
  /** the word printed after the amount in words: DOLLARS for USD, else the currency code */
  unit: string;
}

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// control characters become spaces (as pdfService's clean), then trimmed and cut to `max`
const clean = (value: unknown, max = 120) => [...String(value ?? '')].map(ch => { const code = ch.charCodeAt(0); return code < 32 || code === 127 ? ' ' : ch; }).join('').trim().slice(0, max);

/** What the cheque says. Bills are looked up by id for their numbers (missing ones show their id). */
export function layoutCheque(payment: ChequePayment, workspace: { name?: string; companyName?: string }, billNumbers: Record<string, string> = {}): ChequeLayout {
  if (payment.direction !== 'made') throw new ChequeError('A cheque is printed for a payment made to a vendor');
  if (payment.status === 'void') throw new ChequeError('This payment was voided: there is nothing to print');
  const cents = Math.round(Number(payment.amountCents) || 0);
  if (cents <= 0) throw new ChequeError('The payment has no amount');
  const stub = (payment.allocations || []).filter(a => a.amountCents > 0).map(a => ({ label: `Bill ${clean(billNumbers[a.documentId] || a.documentId, 60)}`, amount: money(a.amountCents) }));
  if ((payment.unappliedCents || 0) > 0) stub.push({ label: 'Paid in advance (not yet billed)', amount: money(payment.unappliedCents || 0) });
  return {
    company: clean(workspace.name || workspace.companyName || ''),
    chequeNumber: clean(payment.reference || payment.referenceNumber || payment.number || '', 30),
    date: clean(payment.date || payment.paymentDate || '', 10),
    payee: clean(payment.contactName || payment.entityName || ''),
    figures: `**${money(cents)}`,
    words: amountInWords(cents),
    memo: clean(payment.memo || '', 80),
    stub,
    total: money(cents),
    unit: (() => { const code = clean(payment.currency || 'USD', 3).toUpperCase(); return code === 'USD' ? 'DOLLARS' : code; })(),
  };
}

const LETTER = { width: 612, height: 792 };
const THIRD = LETTER.height / 3;
const M = 36;

export async function generateChequePdf(layout: ChequeLayout): Promise<Buffer> {
  const files = fonts();
  const pdf = new PDFDocument({ size: 'LETTER', margin: 0, font: files?.body || 'Helvetica', info: { Title: `Cheque ${layout.chequeNumber}`.trim(), Author: layout.company } });
  if (files) { pdf.registerFont('body', files.body); pdf.registerFont('bold', files.bold); }
  const body = files ? 'body' : 'Helvetica';
  const bold = files ? 'bold' : 'Helvetica-Bold';
  const latin = (s: string) => (files ? s : s.replace(/[^\x20-\xFF]/g, '?'));
  const text = (s: string, x: number, y: number, width: number, align: 'left' | 'right' | 'center' = 'left') => drawLine(pdf, latin(s), x, y, width, align);
  const done = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  const right = LETTER.width - M;

  // --- the cheque
  pdf.fillColor('#111827').font(bold).fontSize(11);
  text(layout.company, M, M, 300);
  pdf.font(body).fontSize(10);
  if (layout.chequeNumber) text(`No. ${layout.chequeNumber}`, 400, M, right - 400, 'right');
  text(`Date ${layout.date}`, 400, M + 34, right - 400, 'right');
  pdf.fontSize(8).fillColor('#6B7280');
  text('PAY TO THE ORDER OF', M, M + 74, 140);
  pdf.font(bold).fontSize(11).fillColor('#111827');
  text(layout.payee, M + 120, M + 72, 300);
  pdf.moveTo(M + 118, M + 86).lineTo(440, M + 86).lineWidth(0.5).strokeColor('#9CA3AF').stroke();
  pdf.rect(460, M + 66, right - 460, 24).lineWidth(0.8).strokeColor('#111827').stroke();
  text(layout.figures, 466, M + 73, right - 472, 'right');
  pdf.font(body).fontSize(10);
  // the words, filled to the end of the line so nothing can be added after them
  const words = `${layout.words} `;
  let filled = words;
  while (pdf.widthOfString(latin(`${filled}*`)) < right - M - 60) filled += '*';
  text(filled, M, M + 112, right - M - 50);
  pdf.fontSize(8).fillColor('#6B7280');
  text(layout.unit, right - 46, M + 114, 46, 'right');
  pdf.moveTo(M, M + 126).lineTo(right, M + 126).lineWidth(0.5).strokeColor('#9CA3AF').stroke();
  pdf.fontSize(9).fillColor('#111827');
  text(`Memo ${layout.memo}`, M, M + 182, 300);
  pdf.moveTo(380, M + 192).lineTo(right, M + 192).lineWidth(0.5).strokeColor('#111827').stroke();
  pdf.fontSize(7).fillColor('#6B7280');
  text('AUTHORIZED SIGNATURE', 380, M + 196, right - 380, 'center');

  // --- two vouchers: one goes with the cheque, one stays with the records
  for (const [i, top] of [THIRD, THIRD * 2].entries()) {
    pdf.moveTo(M, top).lineTo(right, top).dash(3, { space: 3 }).lineWidth(0.5).strokeColor('#9CA3AF').stroke().undash();
    let y = top + 24;
    pdf.font(bold).fontSize(10).fillColor('#111827');
    text(layout.company, M, y, 300);
    pdf.font(body).fontSize(9);
    text(i === 0 ? 'Vendor copy' : 'For your records', 400, y, right - 400, 'right');
    y += 18;
    text(`${layout.payee} · ${layout.date}${layout.chequeNumber ? ` · Cheque ${layout.chequeNumber}` : ''}`, M, y, right - M);
    y += 20;
    for (const line of layout.stub.slice(0, 10)) {
      text(line.label, M, y, 360);
      text(line.amount, 400, y, right - 400, 'right');
      y += 14;
    }
    if (layout.stub.length > 10) { text(`and ${layout.stub.length - 10} more`, M, y, 360); y += 14; }
    pdf.font(bold);
    text('Total', M, y + 4, 360);
    text(layout.total, 400, y + 4, right - 400, 'right');
    pdf.font(body);
    if (layout.memo) text(`Memo ${layout.memo}`, M, y + 22, right - M);
  }
  pdf.end();
  return done;
}
