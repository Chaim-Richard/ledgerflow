import { doc, writeBatch } from './db/firestore';
import { db } from '../firebase';
import { useAuthStore } from '../stores/useAuthStore';
import type { SupportTicket, SupportMessage } from '../types';
import appPackage from '../../package.json';
import { attachmentProblem, MAX_ATTACHMENT_BYTES, formatBytes } from './attachments';

/** Validate before creating a ticket; the attachment service retains its own size check. */
export function feedbackScreenshotProblem(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Choose a PNG, JPEG or WebP screenshot.';
  if (file.size > MAX_ATTACHMENT_BYTES) return `Choose a screenshot no larger than ${formatBytes(MAX_ATTACHMENT_BYTES)}.`;
  return attachmentProblem(file);
}

export const FEEDBACK_APP_VERSION = appPackage.version;
export function feedbackRecords(input: { id: string; workspaceId: string; uid: string; screen: string; body: string; date: string }) {
  const body = input.body.trim();
  if (!body || body.length > 5000) throw new Error('Describe what happened in 1–5000 characters.');
  const screen = input.screen.slice(0, 160);
  const ticket: SupportTicket = { id: input.id, workspaceId: input.workspaceId, uid: input.uid, subject: `Feedback: ${screen}`, status: 'open', priority: 'normal', createdAt: input.date, updatedAt: input.date, lastMessageAt: input.date, lastMessageBy: input.uid, unreadForUser: false, unreadForAdmin: true, errorDiagnostics: { message: `Screen: ${screen}`, release: FEEDBACK_APP_VERSION } };
  const message: SupportMessage = { id: `${input.id}-message`, ticketId: input.id, workspaceId: input.workspaceId, authorUid: input.uid, authorRole: 'user', body: `Screen: ${screen}\nApp version: ${FEEDBACK_APP_VERSION}\n\n${body}`, createdAt: input.date };
  return { ticket, message };
}
/** The existing append-only ticket/message collections, committed together without an orphan. */
export async function sendFeedback(workspaceId: string, uid: string, screen: string, body: string) {
  const state = useAuthStore.getState();
  if (state.currentWorkspaceId !== workspaceId || state.user?.uid !== uid) throw new Error('Workspace changed. Reopen feedback.');
  const records = feedbackRecords({ id: `feedback-${crypto.randomUUID()}`, workspaceId, uid, screen, body, date: new Date().toISOString() });
  const batch = writeBatch(db);
  batch.set(doc(db, 'supportTickets', records.ticket.id), records.ticket);
  batch.set(doc(db, 'supportMessages', records.message.id), records.message);
  await batch.commit();
  return records.ticket.id;
}
