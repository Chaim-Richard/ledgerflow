/**
 * A-72: a customer's or vendor's statement scoped to one entity label (the workspace's World /
 * Entity dimension — "World A", "Entity B", …).
 *
 * What this module does and does not do:
 *   - It picks the documents that carry the chosen entity label and hands them to the same
 *     `computeStatement` the whole-account statement uses, so opening balance, rows and running
 *     balance come from one implementation. No amount is recalculated here.
 *   - A posted payment counts only for the part it was allocated to a document of this entity;
 *     money received but not applied to any invoice has no entity yet and is left out of a
 *     by-entity statement (the screen says so and counts it).
 *   - A credit note has no labels of its own; it belongs to the entity of the invoice or bill it
 *     credits, which the caller names through `creditSourceId`.
 *   - The server statement JSON and PDF still cover the whole account (AI #1's `loadStatement` has
 *     no entity argument), so the screen refuses those two buttons while an entity is chosen
 *     rather than showing a page that disagrees with the one beside it.
 */

/** The one value that means "documents with no entity label at all". */
export const UNLABELLED_ENTITY = '(no entity label)';

/** Documents are read structurally: an invoice keeps labels on its items, a bill on its splits. */
type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function propertyOf(doc: unknown, key: string): unknown {
  const record = asRecord(doc);
  return record ? record[key] : undefined;
}

/** A `dimensionId → value` map with only string values, or null. */
function dimensionsOf(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  if (!record) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === 'string') out[key] = raw;
  }
  return out;
}

/** Every child row that can carry labels: invoice items, bill splits, transaction lines. */
function childRows(doc: unknown): unknown[] {
  const rows: unknown[] = [];
  for (const key of ['lines', 'items', 'splits']) {
    const list = propertyOf(doc, key);
    if (Array.isArray(list)) rows.push(...list);
  }
  return rows;
}

function labelFromDimensions(dims: Record<string, string> | null, key: string): string {
  if (!dims) return '';
  const found = Object.keys(dims).find(k => k.normalize('NFC').toLowerCase().trim() === key);
  const value = found ? dims[found] : '';
  return typeof value === 'string' && value.trim() && value.trim() !== 'Unassigned' ? value.trim() : '';
}

/** The label written on one document for the entity dimension, or '' when it carries none. */
export function entityLabelOf(doc: unknown, entityDimensionId = 'world'): string {
  if (!doc) return '';
  const key = (entityDimensionId || 'world').normalize('NFC').toLowerCase().trim();
  const own = labelFromDimensions(dimensionsOf(propertyOf(doc, 'dimensions')), key);
  if (own) return own;
  for (const row of childRows(doc)) {
    const value = labelFromDimensions(dimensionsOf(propertyOf(row, 'dimensions')), key);
    if (value) return value;
  }
  return '';
}

/** True when the document belongs to the chosen entity; an empty choice means the whole account. */
export function matchesEntity(doc: unknown, entity: string, entityDimensionId = 'world'): boolean {
  if (!entity) return true;
  const label = entityLabelOf(doc, entityDimensionId);
  return entity === UNLABELLED_ENTITY ? !label : label === entity;
}

/** Every entity label the contact's documents use, alphabetically. */
export function entityOptions(documents: unknown[], entityDimensionId = 'world'): string[] {
  const values = new Set<string>();
  for (const doc of documents) {
    const label = entityLabelOf(doc, entityDimensionId);
    if (label) values.add(label);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

/** A payment, read structurally: the amount and the documents it was applied to. */
export interface PaymentAllocationLike {
  documentId: string;
  documentType: 'invoice' | 'bill';
  amountCents: number;
}

export interface ScopedStatementDocuments<I, B, P, C> {
  invoices: I[];
  bills: B[];
  payments: P[];
  credits: C[];
  /** posted payments left out because none of their allocation names an in-scope document */
  paymentsWithoutScope: number;
  /** money of those payments (absolute cents), so the screen can say how much is not shown */
  paymentsWithoutScopeCents: number;
  /** true when the statement is the whole account and nothing was left out */
  wholeAccount: boolean;
}

function idOf(doc: unknown): string {
  const id = propertyOf(doc, 'id');
  return typeof id === 'string' ? id : '';
}

function allocationsOf(payment: unknown): PaymentAllocationLike[] {
  const list = propertyOf(payment, 'allocations');
  if (!Array.isArray(list)) return [];
  const out: PaymentAllocationLike[] = [];
  for (const raw of list) {
    const record = asRecord(raw);
    if (!record) continue;
    const documentId = record.documentId;
    const amountCents = record.amountCents;
    const documentType = record.documentType;
    if (typeof documentId === 'string' && typeof amountCents === 'number' && Number.isFinite(amountCents)) {
      out.push({
        documentId,
        amountCents,
        documentType: documentType === 'bill' ? 'bill' : 'invoice',
      });
    }
  }
  return out;
}

/**
 * The documents a by-entity statement is built from. `entity` is an entity label,
 * `UNLABELLED_ENTITY` for documents with none, or '' for the whole account (the same lists,
 * untouched).
 *
 * A payment is copied, never changed: its `amountCents` becomes the part allocated to this entity's
 * documents and `allocations` keeps only those, so the same `computeStatement` reads it correctly
 * and the stored record is untouched.
 */
export function scopeStatementDocuments<I, B, P, C>(
  documents: { invoices: I[]; bills: B[]; payments: P[]; credits: C[] },
  entity: string,
  entityDimensionId = 'world',
  options: { creditSourceId?: (credit: C) => string | undefined } = {},
): ScopedStatementDocuments<I, B, P, C> {
  const { invoices, bills, payments, credits } = documents;
  if (!entity) {
    return { invoices, bills, payments, credits, paymentsWithoutScope: 0, paymentsWithoutScopeCents: 0, wholeAccount: true };
  }

  const scopedInvoices = invoices.filter(doc => matchesEntity(doc, entity, entityDimensionId));
  const scopedBills = bills.filter(doc => matchesEntity(doc, entity, entityDimensionId));

  const documentIds = new Set<string>();
  for (const doc of [...scopedInvoices, ...scopedBills]) {
    const id = idOf(doc);
    if (id) documentIds.add(id);
  }

  // A credit note carries no labels of its own: it belongs to the entity of the document it credits.
  const scopedCredits = credits.filter(credit => {
    if (entityLabelOf(credit, entityDimensionId)) return matchesEntity(credit, entity, entityDimensionId);
    const source = options.creditSourceId?.(credit);
    return Boolean(source && documentIds.has(source));
  });
  for (const credit of scopedCredits) {
    const id = idOf(credit);
    if (id) documentIds.add(id);
  }

  const scopedPayments: P[] = [];
  let paymentsWithoutScope = 0;
  let paymentsWithoutScopeCents = 0;
  for (const payment of payments) {
    const allocations = allocationsOf(payment).filter(a => documentIds.has(a.documentId));
    if (allocations.length === 0) {
      paymentsWithoutScope += 1;
      const amount = propertyOf(payment, 'amountCents');
      paymentsWithoutScopeCents += Math.abs(typeof amount === 'number' && Number.isFinite(amount) ? amount : 0);
      continue;
    }
    const allocatedCents = allocations.reduce((sum, a) => sum + a.amountCents, 0);
    const copy = { ...(payment as AnyRecord), amountCents: allocatedCents, allocations } as unknown as P;
    scopedPayments.push(copy);
  }

  return {
    invoices: scopedInvoices,
    bills: scopedBills,
    credits: scopedCredits,
    payments: scopedPayments,
    paymentsWithoutScope,
    paymentsWithoutScopeCents,
    wholeAccount: false,
  };
}

/**
 * What the screen says when an entity is chosen, in plain words. Says the three things a reader
 * must know: which label these figures are for, that unapplied money is not in them, and that the
 * PDF is the whole account.
 */
export function entityStatementNote(input: {
  entity: string;
  paymentsWithoutScope: number;
  paymentsWithoutScopeCents: number;
  formattedMissing?: string;
}): string {
  if (!input.entity) return '';
  const scope = input.entity === UNLABELLED_ENTITY ? 'documents with no entity label' : `the entity “${input.entity}”`;
  const missing = input.paymentsWithoutScope > 0
    ? ` ${input.paymentsWithoutScope} posted payment${input.paymentsWithoutScope === 1 ? '' : 's'}${
        input.formattedMissing ? ` (${input.formattedMissing})` : ''
      } allocated to no invoice of this entity ${input.paymentsWithoutScope === 1 ? 'is' : 'are'} not in this statement.`
    : '';
  return `This statement covers ${scope} only, read from the same documents as the whole-account statement.${missing} The PDF and the server statement still cover the whole account, so they are switched off while an entity is chosen.`;
}
