/**
 * Item photos are ordinary workspace-scoped document attachments. They are visual references only:
 * they never affect price, stock, tax, or a posted document.
 */
import { MAX_ATTACHMENT_BYTES, attachmentProblem, type Attachment } from './attachments';

export const ITEM_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function itemImageProblem(file: { name: string; size: number; type?: string }): string | null {
  const fileProblem = attachmentProblem(file);
  if (fileProblem) return fileProblem;
  if (!ITEM_IMAGE_MIME_TYPES.includes(file.type as (typeof ITEM_IMAGE_MIME_TYPES)[number])) {
    return `${file.name} must be a JPEG, PNG, or WebP image`;
  }
  return null;
}

/** Safe raster images in the attachment store, newest first; other files are never rendered inline. */
export function itemImages(files: readonly Attachment[]): Attachment[] {
  return files.filter(file => {
    const mime = file.mimeType?.toLowerCase();
    return ITEM_IMAGE_MIME_TYPES.includes(mime as (typeof ITEM_IMAGE_MIME_TYPES)[number]) &&
      typeof file.fileUrl === 'string' &&
      new RegExp(`^data:${mime};base64,`).test(file.fileUrl);
  });
}

export function latestItemImage(files: readonly Attachment[]): Attachment | undefined {
  return itemImages(files)[0];
}

export const ITEM_IMAGE_MAX_BYTES = MAX_ATTACHMENT_BYTES;
