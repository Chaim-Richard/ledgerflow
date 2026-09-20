/**
 * Enterprise PDF Document Generator Service (Zero-Dependency PDF 1.4 Engine)
 * Generates standards-compliant PDF binary buffers for Invoices, Estimates, Credit Notes, Payments, and Statements.
 */
export async function generateDocumentPdf(
  type: 'invoice' | 'estimate' | 'creditNote' | 'payment' | 'statement',
  docData: any,
  workspace: any
): Promise<Buffer> {
  const wsName = (workspace?.name || workspace?.companyName || 'LedgerFlow Workspace').replace(/[()\\]/g, ' ');
  const docTitle = type.toUpperCase().replace(/([A-Z])/g, ' $1').trim();
  const docNum = String(docData?.number || docData?.id || 'N/A').replace(/[()\\]/g, ' ');
  const date = String(docData?.date || new Date().toISOString().slice(0, 10)).replace(/[()\\]/g, ' ');
  const recipient = String(docData?.customerName || docData?.vendorName || docData?.contactName || 'Valued Client').replace(/[()\\]/g, ' ');
  const totalCents = docData?.amountCents || 0;
  const totalFormatted = (totalCents / 100).toFixed(2);

  const items = docData?.items || docData?.transactions || [];
  let itemLines = '';
  let y = 600;

  if (Array.isArray(items) && items.length > 0) {
    items.slice(0, 15).forEach((item: any) => {
      const desc = String(item.description || item.name || 'Item').replace(/[()\\]/g, ' ').slice(0, 45);
      const qty = item.quantity !== undefined ? item.quantity : 1;
      const amt = item.amountCents !== undefined ? (item.amountCents / 100).toFixed(2) : '0.00';
      itemLines += `BT /F1 10 Tf 50 ${y} Td (${desc}) Tj ET\n`;
      itemLines += `BT /F1 10 Tf 350 ${y} Td (${qty}) Tj ET\n`;
      itemLines += `BT /F1 10 Tf 480 ${y} Td ($${amt}) Tj ET\n`;
      y -= 20;
    });
  } else {
    itemLines += `BT /F1 10 Tf 50 ${y} Td (Standard Ledger Transaction) Tj ET\n`;
    itemLines += `BT /F1 10 Tf 350 ${y} Td (1) Tj ET\n`;
    itemLines += `BT /F1 10 Tf 480 ${y} Td ($${totalFormatted}) Tj ET\n`;
    y -= 20;
  }

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
BT /F2 12 Tf 380 ${y - 25} Td (TOTAL: $${totalFormatted}) Tj ET
Q
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
