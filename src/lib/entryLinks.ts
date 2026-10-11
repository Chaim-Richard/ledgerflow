/**
 * Transaction links (M-10): two entries said to belong together, e.g. a refund and the sale it
 * refunds, a bank transfer's two sides, or a correction and what it corrects, with an optional
 * note. A link changes nothing in the books; it shows on both entries and opens the other one.
 * Kept with the workspace's documents (kind "entryLink", no `uid`), written by the server only.
 */
export const ENTRY_LINK_KIND = 'entryLink';
export const MAX_LINKS_PER_ENTRY = 50;
export const MAX_LINK_NOTE = 300;

export interface EntryLink {
  id: string;
  kind: typeof ENTRY_LINK_KIND;
  workspaceId: string;
  /** the two entries' ids, in no particular order */
  a: string;
  b: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

/** The entry at the other end of a link from this one, or undefined when the link is not on it. */
export const otherEnd = (link: Pick<EntryLink, 'a' | 'b'>, entryId: string) => (link.a === entryId ? link.b : link.b === entryId ? link.a : undefined);
