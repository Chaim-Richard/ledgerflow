import { getLocalDateISO } from '../../lib/utils';
import { depositAppliedCents } from '../../lib/documentMath';

/**
 * Enterprise PDF Document Generator Service (Zero-Dependency PDF 1.4 Engine)
 * Generates standards-compliant PDF binary buffers for Invoices, Estimates, Credit Notes, Payments, and Statements.
 */
export type PdfDocumentType = 'invoice' | 'estimate' | 'creditNote' | 'payment' | 'statement';

/** One printed row: invoice items, estimate lines or statement entries. */
export interface PdfLine { description?: string; name?: string; quantity?: number; amountCents?: number | string }

/** What a document PDF prints. Any saved invoice, estimate, credit note, payment or statement fits. */
export interface PdfDocument {
  id?: string;
  number?: string;
  date?: string;
  customerName?: string;
  vendorName?: string;
  contactName?: string;
  amountCents?: number;
  currency?: string;
  items?: PdfLine[];
  lines?: PdfLine[];
  transactions?: PdfLine[];
  taxAmountCents?: number;
  discountCents?: number;
  lineSumCents?: number;
  taxRate?: number;
  taxBreakdown?: Array<{ name?: string; rate?: number; taxCents?: number }>;
  pricesIncludeTax?: boolean;
  depositCents?: number;
}

export interface PdfWorkspace { name?: string; companyName?: string; currency?: string }

export async function generateDocumentPdf(
  type: PdfDocumentType,
  docData: PdfDocument | null | undefined,
  workspace: PdfWorkspace | null | undefined
): Promise<Buffer> {
  const wsName = (workspace?.name || workspace?.companyName || 'LedgerFlow Workspace').replace(/[()\\]/g, ' ');
  const docTitle = type.toUpperCase().replace(/([A-Z])/g, ' $1').trim();
  const docNum = String(docData?.number || docData?.id || 'N/A').replace(/[()\\]/g, ' ');
  const date = String(docData?.date || getLocalDateISO()).replace(/[()\\]/g, ' ');
  const recipient = String(docData?.customerName || docData?.vendorName || docData?.contactName || 'Valued Client').replace(/[()\\]/g, ' ');
  const totalCents = docData?.amountCents || 0;
  // Amounts in the document's own currency, as a code (the built-in PDF fonts have no € or ₪)
  const currency = String(docData?.currency || workspace?.currency || 'USD').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'USD';
  const money = (cents: number) => `${currency} ${(Math.round(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalFormatted = money(totalCents);

  // invoices keep `items`, estimates `lines`, statements `transactions`
  const items = docData?.items || docData?.lines || docData?.transactions || [];
  let itemLines = '';
  let y = 600;

  if (Array.isArray(items) && items.length > 0) {
    items.slice(0, 15).forEach((item) => {
      const desc = String(item.description || item.name || 'Item').replace(/[()\\]/g, ' ').slice(0, 45);
      const qty = item.quantity !== undefined ? item.quantity : 1;
      const amt = money(Number(item.amountCents) || 0);
      itemLines += `BT /F1 10 Tf 50 ${y} Td (${desc}) Tj ET\n`;
      itemLines += `BT /F1 10 Tf 350 ${y} Td (${qty}) Tj ET\n`;
      itemLines += `BT /F1 10 Tf 450 ${y} Td (${amt}) Tj ET\n`;
      y -= 20;
    });
  } else {
    itemLines += `BT /F1 10 Tf 50 ${y} Td (Standard Ledger Transaction) Tj ET\n`;
    itemLines += `BT /F1 10 Tf 350 ${y} Td (1) Tj ET\n`;
    itemLines += `BT /F1 10 Tf 450 ${y} Td (${totalFormatted}) Tj ET\n`;
    y -= 20;
  }

  // Subtotal, discount and tax above the total (documents saved with the tax-code forms)
  const taxCents = Number(docData?.taxAmountCents) || 0;
  const discountCents = Number(docData?.discountCents) || 0;
  const summary: Array<[string, string]> = [];
  if (taxCents > 0 || discountCents > 0) {
    if (typeof docData?.lineSumCents === 'number') summary.push(['Subtotal', money(docData.lineSumCents)]);
    if (discountCents > 0) summary.push(['Discount', `-${money(discountCents)}`]);
    const parts = Array.isArray(docData?.taxBreakdown) && docData.taxBreakdown.length ? docData.taxBreakdown : [{ name: 'Tax', rate: docData?.taxRate, taxCents }];
    for (const p of parts) {
      const label = `${String(p.name || 'Tax').replace(/[()\\]/g, ' ').slice(0, 30)}${p.rate ? ` ${p.rate}%` : ''}${docData?.pricesIncludeTax ? ' incl.' : ''}`;
      summary.push([label, money(Number(p.taxCents) || 0)]);
    }
  }
  y -= 5;
  for (const [label, value] of summary) {
    y -= 18;
    itemLines += `BT /F1 10 Tf 330 ${y} Td (${label}) Tj ET\n`;
    itemLines += `BT /F1 10 Tf 450 ${y} Td (${value}) Tj ET\n`;
  }

  // A deposit is a payment in advance: the total keeps its tax, the deposit lowers what is due (AF-03)
  const depositCents = type === 'invoice' ? depositAppliedCents(docData || {}) : 0;
  const depositLines = depositCents > 0
    ? `BT /F1 10 Tf 330 ${y - 43} Td (Deposit received: -${money(depositCents)}) Tj ET\nBT /F2 12 Tf 330 ${y - 61} Td (AMOUNT DUE: ${money(totalCents - depositCents)}) Tj ET\n`
    : '';

  const streamContent = `
q
0.1 0.1 0.1 rg
BT /F2 20 Tf 50 740 Td (${wsName}) Tj ET
BT /F2 22 Tf 400 740 Td (${docTitle}) Tj ET
BT /F1 10 Tf 400 720 Td (Doc #: ${docNum}) Tj ET
BT /F1 10 Tf 400 705 Td (Date: ${date}) Tj ET
0.8 0.8 0.8 RG 1 w 50 690 m 550 690 l S
BT /F1 9 Tf 50 670 Td (BILLED TO:) Tj ET
BT /F2 12 Tf 50 655 Td (${recipient}) Tj ET
0.8 0.8 0.8 RG 1 w 50 630 m 550 630 l S
BT /F2 10 Tf 50 615 Td (DESCRIPTION) Tj ET
BT /F2 10 Tf 350 615 Td (QTY) Tj ET
BT /F2 10 Tf 480 615 Td (AMOUNT) Tj ET
${itemLines}
0.8 0.8 0.8 RG 1 w 50 ${y - 5} m 550 ${y - 5} l S
BT /F2 12 Tf 330 ${y - 25} Td (TOTAL: ${totalFormatted}) Tj ET
${depositLines}Q
`.trim();

  const streamBytes = Buffer.from(streamContent, 'utf-8');
  const streamLen = streamBytes.length;

  const objects = [
    `%PDF-1.4\n`,
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`
  ];

  const offsets: number[] = [];
  let pdfStr = objects[0];
  let offset = Buffer.byteLength(pdfStr, 'utf-8');

  for (let i = 1; i < objects.length; i++) {
    offsets.push(offset);
    pdfStr += objects[i];
    offset = Buffer.byteLength(pdfStr, 'utf-8');
  }

  const startxref = offset;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += String(off).padStart(10, '0') + ` 00000 n \n`;
  });

  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  const finalPdf = pdfStr + xref + trailer;

  return Buffer.from(finalPdf, 'utf-8');
}
