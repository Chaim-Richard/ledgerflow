/**
 * Client queries (BD-07): a question about one entry ("What was this $340 at Amazon?") between the
 * bookkeeper or accountant and the owner, answered in the app instead of by email. Each question is
 * a short thread on the entry; the server writes it (src/server/services/clientQueryService.ts) and
 * notifies the other side. Shared here: the record shape, the length limits and how a list is shown.
 */
export type ClientQueryStatus = 'open' | 'answered' | 'closed';

export interface ClientQueryMessage {
  uid: string;
  email?: string;
  text: string;
  at: string;
}

export interface ClientQuery {
  id: string;
  workspaceId: string;
  transactionId: string;
  /** The entry as it was when asked (date, description, amount), so the list reads without loading the ledger. */
  entry: { date: string; description: string; amountCents: number; currency: string };
  askedBy: string;
  askedByEmail?: string;
  askedAt: string;
  status: ClientQueryStatus;
  messages: ClientQueryMessage[];
  updatedAt: string;
  closedBy?: string;
  closedAt?: string;
}

export const MAX_QUESTION = 1000;
export const MAX_REPLY = 2000;
export const MAX_MESSAGES = 50;
/** Questions still open on one entry; more is a sign something else is wrong. */
export const MAX_OPEN_PER_ENTRY = 5;

/** Who may ask about an entry; every member, viewers included, may answer. */
export const ASKER_ROLES = ['owner', 'accountant', 'bookkeeper'];

export const STATUS_LABEL: Record<ClientQueryStatus, string> = {
  open: 'Waiting for an answer',
  answered: 'Answered',
  closed: 'Closed',
};

export function questionProblem(text: unknown): string | null {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (clean.length < 3) return 'Write the question (at least 3 characters)';
  if (clean.length > MAX_QUESTION) return `Keep the question under ${MAX_QUESTION} characters`;
  return null;
}

export function replyProblem(text: unknown): string | null {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) return 'Write the answer first';
  if (clean.length > MAX_REPLY) return `Keep the answer under ${MAX_REPLY} characters`;
  return null;
}

const RANK: Record<ClientQueryStatus, number> = { open: 0, answered: 1, closed: 2 };

/** Waiting ones first, then answered, then closed; newest activity first within each. */
export function sortQueries<T extends Pick<ClientQuery, 'status' | 'updatedAt'>>(list: T[]): T[] {
  return [...list].sort((a, b) => RANK[a.status] - RANK[b.status] || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export type QueryFilter = 'waiting' | 'answered' | 'closed' | 'all';

export function filterQueries<T extends Pick<ClientQuery, 'status'>>(list: T[], filter: QueryFilter): T[] {
  if (filter === 'all') return list;
  if (filter === 'waiting') return list.filter(q => q.status === 'open');
  return list.filter(q => q.status === filter);
}
