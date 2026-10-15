/**
 * A-61: quote versions. An estimate keeps its earlier versions — who changed it, when, and what
 * changed — so a business can answer "what did we quote in June?". The versions live on the
 * estimate's own record (`metadata.quoteVersions`, this model, saved through the existing
 * updateEntity path like record notes); the customer portal always shows the estimate as it is
 * NOW, never an old version, and the version line it shows says which version that is.
 *
 * What this is: snapshots of the quote's visible content (lines, amount, expiry, notes, status)
 * and the plain-language change list between any two of them. What it is not: an audit log (the
 * workspace audit trail is its own collection) and not an edit history from before the first
 * recorded version — content that was never snapshotted cannot be recovered, and the screen says
 * so. Pure: it reads what it is given and writes nothing.
 */
import type { Estimate } from '../types';

export interface QuoteLineSnapshot {
  itemId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}

/** What a version holds: the quote's visible content, nothing about who is viewing it. */
export interface QuoteSnapshot {
  amountCents: number;
  expiryDate?: string;
  notes?: string;
  status: string;
  lines: QuoteLineSnapshot[];
}

export interface QuoteVersion {
  /** when the version was recorded (ISO) */
  at: string;
  /** who recorded it (uid) */
  by: string;
  /** who recorded it, in words */
  byName?: string;
  /** why, when the person recording it said so */
  note?: string;
  snapshot: QuoteSnapshot;
}

export type QuoteChangeKind = 'amount' | 'status' | 'expiry' | 'notes' | 'line-added' | 'line-removed' | 'line-changed';

export interface QuoteChange {
  kind: QuoteChangeKind;
  /** one plain sentence, the words the screen and the version record show */
  detail: string;
}

/** Where the versions live on the record (like `recordNotes`). */
export const QUOTE_VERSIONS_METADATA_KEY = 'quoteVersions';

type EstimateForVersions = Pick<Estimate, 'amountCents' | 'status'> & {
  expiryDate?: string;
  notes?: string;
  lines?: Array<Partial<QuoteLineSnapshot> & { description?: string }>;
};

/** The snapshot of an estimate as it is now. Missing numbers count as zero and say so by being zero. */
export function snapshotQuote(estimate: EstimateForVersions): QuoteSnapshot {
  return {
    amountCents: Math.round(estimate.amountCents || 0),
    ...(estimate.expiryDate ? { expiryDate: String(estimate.expiryDate).slice(0, 10) } : {}),
    ...(estimate.notes ? { notes: String(estimate.notes) } : {}),
    status: String(estimate.status || 'draft'),
    lines: (estimate.lines || []).map(line => ({
      ...(line.itemId ? { itemId: line.itemId } : {}),
      description: String(line.description ?? ''),
      quantity: Number(line.quantity || 0),
      unitPriceCents: Math.round(Number(line.unitPriceCents || 0)),
      amountCents: Math.round(Number(line.amountCents || 0)),
    })),
  };
}

const isLine = (value: unknown): value is QuoteLineSnapshot =>
  !!value && typeof value === 'object'
  && typeof (value as QuoteLineSnapshot).description === 'string'
  && typeof (value as QuoteLineSnapshot).amountCents === 'number';

const isVersion = (value: unknown): value is QuoteVersion => {
  if (!value || typeof value !== 'object') return false;
  const v = value as QuoteVersion;
  return typeof v.at === 'string' && !!v.at && typeof v.by === 'string' && !!v.by
    && !!v.snapshot && typeof v.snapshot === 'object' && typeof v.snapshot.amountCents === 'number'
    && Array.isArray(v.snapshot.lines) && v.snapshot.lines.every(isLine);
};

/** The versions a record's metadata carries; junk there is ignored, never guessed at. */
export function quoteVersionsFromMetadata(metadata: Record<string, unknown> | null | undefined): QuoteVersion[] {
  const raw = metadata?.[QUOTE_VERSIONS_METADATA_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isVersion).map(v => ({
    ...v,
    snapshot: {
      amountCents: Math.round(v.snapshot.amountCents || 0),
      ...(v.snapshot.expiryDate ? { expiryDate: String(v.snapshot.expiryDate).slice(0, 10) } : {}),
      ...(v.snapshot.notes ? { notes: String(v.snapshot.notes) } : {}),
      status: String(v.snapshot.status || 'draft'),
      lines: v.snapshot.lines.map(line => ({
        ...(line.itemId ? { itemId: line.itemId } : {}),
        description: String(line.description ?? ''),
        quantity: Number(line.quantity || 0),
        unitPriceCents: Math.round(Number(line.unitPriceCents || 0)),
        amountCents: Math.round(Number(line.amountCents || 0)),
      })),
    },
  }));
}

/** The metadata to save: the record's own other keys kept, the versions replaced wholesale. */
export function quoteVersionsToMetadata(
  existing: Record<string, unknown> | null | undefined,
  versions: QuoteVersion[],
): Record<string, unknown> {
  return { ...(existing || {}), [QUOTE_VERSIONS_METADATA_KEY]: versions };
}

const lineKey = (line: QuoteLineSnapshot, index: number): string =>
  (line.itemId ? `i:${line.itemId}` : `d:${line.description}`) + `#${index}`;

/** The change list from one snapshot to another (null on the left = "nothing was recorded before"). */
export function quoteChangeList(from: QuoteSnapshot | null, to: SnapshotLike): QuoteChange[] {
  const changes: QuoteChange[] = [];
  const next = to;
  if (!from) {
    changes.push({ kind: 'amount', detail: `first version: ${money(next.amountCents)}` });
    for (const line of next.lines) {
      changes.push({ kind: 'line-added', detail: `line “${line.description}” × ${line.quantity} at ${money(line.unitPriceCents)} = ${money(line.amountCents)}` });
    }
    return changes;
  }
  if (from.amountCents !== next.amountCents) {
    const delta = next.amountCents - from.amountCents;
    changes.push({
      kind: 'amount',
      detail: `amount ${money(from.amountCents)} → ${money(next.amountCents)} (${delta > 0 ? '+' : ''}${money(delta)})`,
    });
  }
  if (from.status !== next.status) changes.push({ kind: 'status', detail: `status ${from.status} → ${next.status}` });
  if ((from.expiryDate || '') !== (next.expiryDate || '')) {
    changes.push({ kind: 'expiry', detail: `valid until ${from.expiryDate || '—'} → ${next.expiryDate || '—'}` });
  }
  if ((from.notes || '') !== (next.notes || '')) changes.push({ kind: 'notes', detail: `notes ${from.notes ? 'changed' : 'added'}` });

  const before = new Map(from.lines.map((line, index) => [lineKey(line, index), line]));
  const after = new Map(next.lines.map((line, index) => [lineKey(line, index), line]));
  for (const [key, line] of after) {
    const was = before.get(key);
    if (!was) {
      changes.push({ kind: 'line-added', detail: `line added: “${line.description}” × ${line.quantity} at ${money(line.unitPriceCents)} = ${money(line.amountCents)}` });
    } else if (was.quantity !== line.quantity || was.unitPriceCents !== line.unitPriceCents || was.amountCents !== line.amountCents) {
      changes.push({
        kind: 'line-changed',
        detail: `line “${line.description}”: × ${was.quantity} at ${money(was.unitPriceCents)} = ${money(was.amountCents)} → × ${line.quantity} at ${money(line.unitPriceCents)} = ${money(line.amountCents)}`,
      });
    }
  }
  for (const [key, line] of before) {
    if (!after.has(key)) changes.push({ kind: 'line-removed', detail: `line removed: “${line.description}” = ${money(line.amountCents)}` });
  }
  return changes;
}

type SnapshotLike = QuoteSnapshot;

const money = (cents: number) => `${(cents / 100).toFixed(2)}`;

/**
 * Record the current content as a new version. A version is appended only when the content
 * actually differs from the last recorded one (or when nothing was recorded yet) — pressing the
 * button twice never writes two identical versions.
 */
export function recordQuoteVersion(
  versions: QuoteVersion[],
  input: { snapshot: QuoteSnapshot; by: string; byName?: string; at: string; note?: string },
): { versions: QuoteVersion[]; recorded: boolean; changes: QuoteChange[] } {
  const last = versions.at(-1) || null;
  const changes = quoteChangeList(last ? last.snapshot : null, input.snapshot);
  if (last && changes.length === 0) return { versions, recorded: false, changes: [] };
  const version: QuoteVersion = {
    at: input.at,
    by: input.by,
    ...(input.byName ? { byName: input.byName } : {}),
    ...(input.note ? { note: input.note } : {}),
    snapshot: input.snapshot,
  };
  return { versions: [...versions, version], recorded: true, changes };
}

/** What changed since the last recorded version (everything, when none was recorded). */
export function changesSinceLastVersion(versions: QuoteVersion[], current: QuoteSnapshot): QuoteChange[] {
  const last = versions.at(-1) || null;
  return quoteChangeList(last ? last.snapshot : null, current);
}

/**
 * Compare two recorded versions (indexes into the versions list, oldest = 0). Passing the same
 * index twice is refused with an empty list — a version does not differ from itself.
 */
export function compareQuoteVersions(versions: QuoteVersion[], fromIndex: number, toIndex: number): QuoteChange[] {
  const from = versions[fromIndex];
  const to = versions[toIndex];
  if (!from || !to || fromIndex === toIndex) return [];
  return quoteChangeList(from.snapshot, to.snapshot);
}

/** 'Version 3 · recorded 2026-10-01' — what the customer portal shows beside the quote. */
export function customerVersionLabel(versions: QuoteVersion[]): string | undefined {
  const last = versions.at(-1);
  if (!last) return undefined;
  return `Version ${versions.length} · recorded ${last.at.slice(0, 10)}`;
}

export const QUOTE_VERSIONS_CSV_HEADERS: string[] = ['Version', 'Recorded at', 'Recorded by', 'Amount', 'Valid until', 'Status', 'What changed'];

export function quoteVersionsCsvRows(versions: QuoteVersion[]): string[][] {
  return versions.map((version, index) => {
    const before = index > 0 ? versions[index - 1].snapshot : null;
    return [
      String(index + 1),
      version.at,
      version.byName || version.by,
      (version.snapshot.amountCents / 100).toFixed(2),
      version.snapshot.expiryDate || '',
      version.snapshot.status,
      quoteChangeList(before, version.snapshot).map(change => change.detail).join('; ') || 'first version',
    ];
  });
}
