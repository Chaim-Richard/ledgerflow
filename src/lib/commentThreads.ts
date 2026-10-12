/**
 * A-21 (CF-07): a comment thread on a record's page — customers and projects first (any record type
 * the panel is put on). A comment is written with who and when, can be edited by its own writer for
 * ten minutes, and @mentions tell the named teammates (the existing `mentions.ts` rules).
 *
 * The comments themselves are stored by the caller (server or workspace store); this module is the
 * thread's own rules. Pure.
 */
import { mentionedPeople, type Mentionable } from './mentions';

export type CommentEntityType = 'customer' | 'project' | 'vendor' | 'item' | 'invoice' | 'bill' | 'estimate';

export interface CommentAuthor {
  uid: string;
  name?: string;
  email?: string;
}

export interface ThreadComment {
  id: string;
  workspaceId: string;
  entityType: CommentEntityType;
  entityId: string;
  authorUid: string;
  authorName?: string;
  authorEmail?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  /** uids told by @mention, in the order first named */
  mentions: string[];
}

/** How long a writer may still change what they wrote. */
export const COMMENT_EDIT_WINDOW_MS = 10 * 60 * 1000;
export const COMMENT_MAX_LENGTH = 4000;

/** Why this text cannot be a comment, in plain words, or null when it can. */
export function commentProblem(body: string): string | null {
  const text = String(body ?? '').trim();
  if (!text) return 'Write something first.';
  if (text.length > COMMENT_MAX_LENGTH) return `A comment can be up to ${COMMENT_MAX_LENGTH} characters.`;
  return null;
}

/** Why this person cannot edit this comment now, in plain words, or null when they can. */
export function commentEditProblem(comment: Pick<ThreadComment, 'authorUid' | 'createdAt'>, uid: string, now: string | number = Date.now()): string | null {
  if (!uid) return 'Only the person who wrote a comment can change it.';
  if (comment.authorUid !== uid) return 'Only your own comment can be edited.';
  const written = Date.parse(comment.createdAt);
  const at = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(written) || !Number.isFinite(at)) return 'Only your own comment can be edited.';
  if (at - written > COMMENT_EDIT_WINDOW_MS) return 'A comment can be changed for 10 minutes after it is written.';
  return null;
}

/** A new comment: the text, who wrote it, when, and the teammates @mentioned in it. */
export function newThreadComment(
  input: { id: string; workspaceId: string; entityType: CommentEntityType; entityId: string; author: CommentAuthor; body: string },
  people: Mentionable[],
  now: string = new Date().toISOString(),
): ThreadComment {
  const body = String(input.body).trim();
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    entityId: input.entityId,
    authorUid: input.author.uid,
    ...(input.author.name ? { authorName: input.author.name } : {}),
    ...(input.author.email ? { authorEmail: input.author.email } : {}),
    body,
    createdAt: now,
    mentions: mentionedPeople(body, people, input.author.uid),
  };
}

/** An edited comment: the new text, the new mentions, and when it was changed (the first time stands). */
export function editedThreadComment(comment: ThreadComment, body: string, people: Mentionable[], now: string = new Date().toISOString()): ThreadComment {
  const text = String(body).trim();
  return {
    ...comment,
    body: text,
    mentions: mentionedPeople(text, people, comment.authorUid),
    editedAt: comment.editedAt || now,
  };
}

/** The thread of one record: oldest first, other records and other workspaces left out. */
export function threadComments(comments: ThreadComment[], entityType: CommentEntityType, entityId: string, workspaceId?: string): ThreadComment[] {
  return comments
    .filter(c => c.entityType === entityType && c.entityId === entityId && (!workspaceId || c.workspaceId === workspaceId))
    .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
}

/** The people who took part in a thread, each once, in first-post order. */
export function threadParticipants(comments: ThreadComment[]): CommentAuthor[] {
  const seen = new Map<string, CommentAuthor>();
  for (const c of comments) {
    if (!seen.has(c.authorUid)) seen.set(c.authorUid, { uid: c.authorUid, ...(c.authorName ? { name: c.authorName } : {}), ...(c.authorEmail ? { email: c.authorEmail } : {}) });
  }
  return [...seen.values()];
}

/** "today at 14:05", "yesterday at 09:12", "3 days ago" — a plain label for the thread. */
export function commentWhen(comment: Pick<ThreadComment, 'createdAt'>, now: Date = new Date()): string {
  const at = new Date(comment.createdAt);
  if (Number.isNaN(at.getTime())) return '';
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const days = Math.floor((Date.parse(`${day(now)}T00:00:00Z`) - Date.parse(`${day(at)}T00:00:00Z`)) / 86_400_000);
  const time = at.toISOString().slice(11, 16);
  if (days <= 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  if (days < 30) return `${days} days ago`;
  return at.toISOString().slice(0, 10);
}
