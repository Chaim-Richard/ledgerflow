import PDFDocument from 'pdfkit';
import { drawLine } from './pdfText';
import { fonts } from './pdfService';
import { orderDeliveries } from '../../lib/deliveries';
import type { Estimate, Transaction } from '../../types';

/**
 * The delivery note (M-12, BF-08): what left on one delivery of an order, to go with the goods:
 * the company, the customer, the order and its customer reference, the date, each item and how
 * many, and a line to sign on receipt. No prices (it travels with the goods). Laid out first
 * (`layoutDeliveryNote`, tested), then drawn; only what the delivery's entries kept is shown.
 */
export interface DeliveryNoteLayout {
  company: string;
  customer: string;
  order: string;
  customerReference: string;
  date: string;
  number: string;
  rows: Array<{ item: string; quantity: string }>;
}

const clean = (value: unknown, max = 120) => [...String(value ?? '')].map(ch => { const code = ch.charCodeAt(0); return code < 32 || code === 127 ? ' ' : ch; }).join('').trim().slice(0, max);

/** null when the delivery is not on the order (or was undone). */
export function layoutDeliveryNote(order: Estimate, entries: Transaction[], deliveryId: string, workspace: { name?: string }): DeliveryNoteLayout | null {
  const delivery = orderDeliveries(entries, order.id).find(d => d.deliveryId === deliveryId);
  if (!delivery) return null;
  const lines = order.lines || [];
  return {
    company: clean(workspace.name || ''),
    customer: clean((order as Estimate & { customerName?: string }).customerName || ''),
    order: clean(order.number || order.id, 60),
    customerReference: clean((order as Estimate & { customerReference?: string }).customerReference || '', 60),
    date: clean(delivery.date, 10),
    number: clean(deliveryId.replace(/^dlv_/, '').slice(0, 8).toUpperCase(), 20),
    rows: delivery.lines.sort((a, b) => a.position - b.position).map(l => ({ item: clean(lines[l.position]?.description || 'Item', 200), quantity: String(l.quantity) })),
  };
}

export async function generateDeliveryNotePdf(layout: DeliveryNoteLayout): Promise<Buffer> {
  const files = fonts();
  const pdf = new PDFDocument({ size: 'A4', margin: 54, font: files?.body || 'Helvetica', info: { Title: `Delivery note ${layout.number}`, Author: layout.company } });
  if (files) { pdf.registerFont('body', files.body); pdf.registerFont('bold', files.bold); }
  const body = files ? 'body' : 'Helvetica';
  const bold = files ? 'bold' : 'Helvetica-Bold';
  const latin = (s: string) => (files ? s : s.replace(/[^\x20-\xFF]/g, '?'));
  const text = (s: string, x: number, y: number, width: number, align: 'left' | 'right' = 'left') => drawLine(pdf, latin(s), x, y, width, align);
  const done = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  const left = 54;
  const right = 595 - 54;
  let y = 54;
  pdf.font(bold).fontSize(16).fillColor('#111827');
  text(layout.company, left, y, 300);
  text('Delivery note', 360, y, right - 360, 'right');
  y += 34;
  pdf.font(body).fontSize(10).fillColor('#374151');
  const meta: Array<[string, string]> = [['To', layout.customer], ['Order', layout.order], ...(layout.customerReference ? [['Your reference', layout.customerReference] as [string, string]] : []), ['Date', layout.date], ['Note', layout.number]];
  for (const [label, value] of meta) { text(`${label}: ${value}`, left, y, right - left); y += 15; }
  y += 12;
  pdf.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor('#D1D5DB').stroke();
  y += 10;
  pdf.font(bold).fontSize(10).fillColor('#111827');
  text('Item', left, y, 380);
  text('Quantity', 440, y, right - 440, 'right');
  y += 18;
  pdf.font(body);
  for (const row of layout.rows) {
    if (y > 760) { pdf.addPage(); y = 54; }
    text(row.item, left, y, 380);
    text(row.quantity, 440, y, right - 440, 'right');
    y += 16;
  }
  y = Math.max(y + 40, 680);
  pdf.fontSize(10).fillColor('#374151');
  text('Received in good order by (name, signature, date):', left, y, right - left);
  pdf.moveTo(left, y + 34).lineTo(right, y + 34).lineWidth(0.5).strokeColor('#9CA3AF').stroke();
  pdf.end();
  return done;
}
