import { getDb } from '../db/firestore';
import crypto from 'crypto';

export interface InboundAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface InboundEmailPayload {
  to: string;
  from: string;
  subject: string;
  text?: string;
  attachments?: InboundAttachment[];
}

export async function processInboundEmail(payload: InboundEmailPayload) {
  const db = getDb();
  console.log(`[InboundEmail] Processing email to: ${payload.to} from: ${payload.from}`);

  // Extract workspace ID from recipient address: w-{workspaceId}@inbox... or default
  const match = payload.to.match(/w-([a-zA-Z0-9_\-]+)@/);
  const workspaceId = match ? match[1] : 'default';

  const attachments = payload.attachments || [];
  const inboxItems = [];

  for (const att of attachments) {
    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    const inboxItem = {
      id: docId,
      workspaceId,
      fileName: att.filename,
      contentType: att.contentType,
      source: 'email_inbound',
      sender: payload.from,
      subject: payload.subject,
      status: 'review_pending',
      contentBase64: att.contentBase64,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('inbox').doc(docId).set(inboxItem);
    inboxItems.push(inboxItem);
  }

  // If no attachments, capture email body as text document
  if (attachments.length === 0 && payload.text) {
    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    const inboxItem = {
      id: docId,
      workspaceId,
      fileName: `Email_${payload.subject.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
      contentType: 'text/plain',
      source: 'email_inbound',
      sender: payload.from,
      subject: payload.subject,
      status: 'review_pending',
      textBody: payload.text,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('inbox').doc(docId).set(inboxItem);
    inboxItems.push(inboxItem);
  }

  return {
    workspaceId,
    processedCount: inboxItems.length,
    inboxItemIds: inboxItems.map(i => i.id)
  };
}
