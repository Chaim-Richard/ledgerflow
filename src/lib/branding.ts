import { z } from 'zod';

/**
 * How documents look (Y-11…Y-17, Y-33, Y-34): logo, brand colour, address under the company name,
 * a footer on every page, default terms per document type, and the "scan to pay" code on invoices.
 * Saved on the workspace (`branding`) by the server (PUT /api/v1/workspaces/:id/branding), read by
 * the PDF (src/server/services/pdfService.ts).
 */
export const BRANDED_DOCUMENTS = ['invoice', 'estimate', 'creditNote', 'statement', 'payment', 'purchaseOrder'] as const;
export type BrandedDocument = typeof BRANDED_DOCUMENTS[number];

export const BRANDED_DOCUMENT_LABELS: Record<BrandedDocument, string> = {
  invoice: 'Invoices', estimate: 'Estimates', creditNote: 'Credit notes', statement: 'Statements', payment: 'Payment receipts', purchaseOrder: 'Purchase orders',
};

/** Largest logo kept (as a data URL): logos are small, and the workspace row is read often. */
export const MAX_LOGO_BYTES = 200_000;
export const LOGO_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export const BrandingSchema = z.object({
  logoDataUrl: z.string().max(Math.ceil(MAX_LOGO_BYTES * 4 / 3) + 40).regex(LOGO_DATA_URL, 'The logo must be a PNG or JPEG image').optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #1F6FEB').optional().or(z.literal('')),
  address: z.string().max(300).optional(),
  footer: z.string().max(300).optional(),
  terms: z.object(Object.fromEntries(BRANDED_DOCUMENTS.map(d => [d, z.string().max(2000).optional()])) as Record<BrandedDocument, z.ZodOptional<z.ZodString>>).partial().strict().optional(),
  /** Print a QR code to the invoice's payment page (default on). */
  showPaymentQr: z.boolean().optional(),
}).strict();

export type WorkspaceBranding = z.infer<typeof BrandingSchema>;

export const DEFAULT_BRAND_COLOR = '#1F2937';

/** The brand colour as #RRGGBB, or the default when missing or invalid. */
export function brandColor(color?: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color!.toUpperCase() : DEFAULT_BRAND_COLOR;
}
