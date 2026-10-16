/** Return authorizations and serial warranty metadata workflows (A-66/A-67). */
import type { CreditNote, Customer, EntityMetadata, Invoice, InventoryItem } from '../types';
import { lineSerials, normalizeSerial } from './serialNumbers';
import {
  displayName,
  encodedPathPart,
  hasControlCharacters,
  isIsoDate,
  isIsoTime,
  isPlainRecord,
  isWorkspaceWriter,
  type WorkflowActor,
} from './warehouseRecordUtils';

export const RMAS_METADATA_FIELD = 'returnAuthorizationsById';
export const WARRANTIES_METADATA_FIELD = 'warrantiesById';

const UNISSUED_INVOICE_STATUSES = new Set(['draft', 'rejected', 'void', 'cancelled']);
const APPROVER_ROLES = new Set(['owner', 'accountant']);
const RMA_STATUSES = new Set(['requested', 'approved', 'declined', 'received', 'closed']);

export interface ReturnAuthorizationLine {
  invoiceLineId: string;
  itemId: string;
  description: string;
  quantity: number;
}

export interface ReturnAuthorizationRequestLine extends ReturnAuthorizationLine {
  /** The quantity sold on the source invoice line; used only to validate the request. */
  soldQuantity: number;
}

export type ReturnAuthorizationStatus = 'requested' | 'approved' | 'declined' | 'received' | 'closed';

export interface ReturnAuthorizationEvent {
  status: ReturnAuthorizationStatus;
  at: string;
  byUid: string;
  byName: string;
  note?: string;
}

export interface ReturnAuthorizationRecord {
  id: string;
  number: string;
  workspaceId: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  reason: string;
  lines: ReturnAuthorizationLine[];
  status: ReturnAuthorizationStatus;
  requestedAt: string;
  requestedByUid: string;
  requestedByName: string;
  events: ReturnAuthorizationEvent[];
  decidedAt?: string;
  decidedByUid?: string;
  decidedByName?: string;
  approvalNote?: string;
  receivedAt?: string;
  receivedByUid?: string;
  receivedByName?: string;
  linkedCreditNoteId?: string;
  linkedCreditNoteNumber?: string;
  linkedAt?: string;
  linkedByUid?: string;
  linkedByName?: string;
}

export interface WarrantyCandidate {
  id: string;
  workspaceId: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceLineId: string;
  itemId: string;
  itemName: string;
  sku: string;
  serial: string;
  customerLoaded: boolean;
}

export interface WarrantyChange {
  previousEndDate: string | null;
  endDate: string;
  at: string;
  byUid: string;
  byName: string;
}

export interface WarrantyRecord {
  id: string;
  workspaceId: string;
  customerId: string;
  invoiceId: string;
  invoiceLineId: string;
  itemId: string;
  serial: string;
  endDate: string;
  updatedAt: string;
  updatedByUid: string;
  updatedByName: string;
  changeLog: WarrantyChange[];
}

function validRmaLine(value: unknown): value is ReturnAuthorizationLine {
  if (!isPlainRecord(value)) return false;
  return typeof value.invoiceLineId === 'string' && Boolean(value.invoiceLineId.trim()) && value.invoiceLineId.length <= 200 &&
    typeof value.itemId === 'string' && Boolean(value.itemId.trim()) && value.itemId.length <= 200 &&
    typeof value.description === 'string' && value.description.length <= 500 && !hasControlCharacters(value.description) &&
    typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity > 0;
}

function validRmaRecord(value: unknown): value is ReturnAuthorizationRecord {
  if (!isPlainRecord(value)) return false;
  const record = value as unknown as ReturnAuthorizationRecord;
  return typeof record.id === 'string' && /^rma_[a-z0-9_-]+$/i.test(record.id) && record.id.length <= 100 &&
    typeof record.number === 'string' && Boolean(record.number.trim()) && record.number.length <= 40 && !hasControlCharacters(record.number) &&
    typeof record.workspaceId === 'string' && Boolean(record.workspaceId.trim()) && record.workspaceId.length <= 200 &&
    typeof record.customerId === 'string' && Boolean(record.customerId.trim()) && record.customerId.length <= 200 &&
    typeof record.customerName === 'string' && record.customerName.length <= 200 && !hasControlCharacters(record.customerName) &&
    typeof record.invoiceId === 'string' && Boolean(record.invoiceId.trim()) && record.invoiceId.length <= 200 &&
    typeof record.invoiceNumber === 'string' && record.invoiceNumber.length <= 200 && !hasControlCharacters(record.invoiceNumber) &&
    typeof record.reason === 'string' && record.reason.length <= 1000 && Boolean(record.reason.trim()) && !hasControlCharacters(record.reason) &&
    isIsoTime(record.requestedAt) && typeof record.requestedByUid === 'string' && Boolean(record.requestedByUid.trim()) &&
    typeof record.requestedByName === 'string' && record.requestedByName.length <= 120 &&
    Array.isArray(record.lines) && record.lines.length > 0 && record.lines.every(line =>
      validRmaLine(line) && Math.round(line.quantity * 100) / 100 === line.quantity,
    ) &&
    RMA_STATUSES.has(String(record.status)) && Array.isArray(record.events) && record.events.length > 0 &&
    record.events.every(event => isPlainRecord(event) && RMA_STATUSES.has(String(event.status)) &&
      isIsoTime(String(event.at)) && typeof event.byUid === 'string' && Boolean(event.byUid.trim()) &&
      typeof event.byName === 'string' && event.byName.length <= 120 &&
      (event.note === undefined || typeof event.note === 'string' && event.note.length <= 1000 && !hasControlCharacters(event.note)));
}

export function returnAuthorizationId(token: string): string {
  const clean = String(token ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return clean ? `rma_${clean.toLowerCase()}` : '';
}

export function returnAuthorizationNumber(date: string, token: string): string {
  if (!isIsoDate(date)) throw new Error('A valid date is required to make an RMA number.');
  const clean = String(token ?? '').toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(clean)) throw new Error('The RMA number token must be twelve secure characters.');
  return `RMA-${date.slice(0, 4)}-${clean}`;
}

export function returnAuthorizationsFromMetadata(
  metadata: EntityMetadata | undefined,
  customerId?: string,
  workspaceId?: string,
): ReturnAuthorizationRecord[] {
  const raw = metadata?.[RMAS_METADATA_FIELD];
  if (!isPlainRecord(raw)) return [];
  return Object.entries(raw).flatMap(([key, value]) => {
    if (!validRmaRecord(value) || key !== encodedPathPart(value.id)) return [];
    if (customerId && value.customerId !== customerId) return [];
    if (workspaceId && value.workspaceId !== workspaceId) return [];
    return [value];
  }).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.number.localeCompare(b.number));
}

export function rmaFieldPath(id: string): string {
  return `metadata.${RMAS_METADATA_FIELD}.${encodedPathPart(id)}`;
}

export function returnAuthorizationRequestProblem(input: {
  id: string;
  number: string;
  workspaceId: string;
  customerId: string;
  invoiceId: string;
  reason: string;
  lines: ReturnAuthorizationRequestLine[];
  actor: WorkflowActor;
  at: string;
}): string | null {
  if (!input.id.trim() || input.id.length > 100 || hasControlCharacters(input.id) || !/^rma_[a-z0-9_-]+$/i.test(input.id)) return 'A safe RMA identifier is required.';
  if (!input.number.trim() || input.number.length > 40 || hasControlCharacters(input.number)) return 'An RMA number is required.';
  if (!input.workspaceId.trim() || !input.customerId.trim() || !input.invoiceId.trim()) return 'Choose an invoice and its customer first.';
  if ([input.workspaceId, input.customerId, input.invoiceId].some(value => value.length > 200 || hasControlCharacters(value))) return 'The selected record identifiers cannot be used for an RMA.';
  if (!isWorkspaceWriter(input.actor)) return 'A workspace editor is required to request an RMA.';
  if (!isIsoTime(input.at)) return 'A valid request time is required.';
  const reason = String(input.reason ?? '').trim();
  if (!reason) return 'Enter a reason for the return.';
  if (reason.length > 1000 || hasControlCharacters(reason)) return 'The return reason must be 1,000 characters or fewer and contain no control characters.';
  if (!Array.isArray(input.lines) || input.lines.length === 0) return 'Choose at least one invoiced stock item.';
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (!validRmaLine(line)) return 'Each selected line needs an invoiced stock item and a quantity above zero.';
    if (seen.has(line.invoiceLineId)) return 'An invoice line can appear only once on an RMA.';
    seen.add(line.invoiceLineId);
    if (!Number.isFinite(line.soldQuantity) || line.soldQuantity <= 0) return `${line.description}: the sold quantity is not valid.`;
    if (Math.round(line.quantity * 100) / 100 !== line.quantity) return `${line.description}: use no more than two decimal places.`;
    if (line.quantity > line.soldQuantity) return `${line.description}: cannot request more than the ${line.soldQuantity} sold.`;
  }
  return null;
}

/**
 * Read-only guard for the request screen: existing non-declined RMAs reserve
 * invoice-line quantities, including already received/closed returns.
 *
 * This does NOT replace an authoritative atomic database check. Two clients
 * can create RMAs simultaneously; the server needs its own compare-and-swap.
 * Work in hundredths, not floating point, to avoid cumulative 0.1+0.2 drift.
 */
export function returnAuthorizationCapacityProblem(
  input: {
    workspaceId: string;
    customerId: string;
    invoiceId: string;
    lines: readonly ReturnAuthorizationRequestLine[];
  },
  existing: readonly ReturnAuthorizationRecord[],
): string | null {
  const reserved = new Map<string, number>();
  for (const rma of existing) {
    if (rma.workspaceId !== input.workspaceId || rma.customerId !== input.customerId ||
        rma.invoiceId !== input.invoiceId || rma.status === 'declined') continue;
    for (const line of rma.lines) {
      const units = Math.round(line.quantity * 100);
      if (!Number.isSafeInteger(units) || units <= 0 || units / 100 !== line.quantity)
        return 'Earlier RMA quantities cannot be verified. Review the return history before requesting more.';
      const total = (reserved.get(line.invoiceLineId) || 0) + units;
      if (!Number.isSafeInteger(total))
        return 'Earlier RMA quantities exceed the supported range. Review the return history.';
      reserved.set(line.invoiceLineId, total);
    }
  }
  for (const line of input.lines) {
    const sold = Math.round(line.soldQuantity * 100);
    const requested = Math.round(line.quantity * 100);
    if (!Number.isSafeInteger(sold) || sold <= 0 || sold / 100 !== line.soldQuantity ||
        !Number.isSafeInteger(requested) || requested <= 0 || requested / 100 !== line.quantity)
      return `${line.description}: invoice or return quantity cannot be verified to two decimal places.`;
    const used = reserved.get(line.invoiceLineId) || 0;
    if (used > sold || requested > sold - used)
      return `${line.description}: ${(used / 100).toFixed(2)} already requested or returned; only ${(Math.max(0, sold - used) / 100).toFixed(2)} of ${line.soldQuantity} sold remain available for a new RMA.`;
  }
  return null;
}

export function createReturnAuthorization(input: {
  id: string;
  number: string;
  workspaceId: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  reason: string;
  lines: ReturnAuthorizationRequestLine[];
  actor: WorkflowActor;
  at: string;
}): ReturnAuthorizationRecord {
  const problem = returnAuthorizationRequestProblem(input);
  if (problem) throw new Error(problem);
  if (!input.customerName.trim() || input.customerName.length > 200 || hasControlCharacters(input.customerName)) {
    throw new Error('A valid customer name is required for the RMA.');
  }
  if (!input.invoiceNumber.trim() || input.invoiceNumber.length > 200 || hasControlCharacters(input.invoiceNumber)) {
    throw new Error('A valid source invoice number is required for the RMA.');
  }
  const event: ReturnAuthorizationEvent = {
    status: 'requested', at: input.at, byUid: input.actor.uid, byName: displayName(input.actor.name),
  };
  return {
    id: input.id,
    number: input.number,
    workspaceId: input.workspaceId,
    customerId: input.customerId,
    customerName: input.customerName,
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    reason: input.reason.trim(),
    lines: input.lines.map(({ soldQuantity: _soldQuantity, ...line }) => ({ ...line, description: line.description.trim() })),
    status: 'requested',
    requestedAt: input.at,
    requestedByUid: input.actor.uid,
    requestedByName: displayName(input.actor.name),
    events: [event],
  };
}

export type ReturnAuthorizationAction =
  | { type: 'approve'; note?: string }
  | { type: 'decline'; note: string }
  | { type: 'receive'; note?: string }
  | { type: 'link-credit-note'; creditNote: Pick<CreditNote, 'id' | 'number' | 'workspaceId' | 'customerId' | 'invoiceId' | 'status'>; note?: string };

export type ReturnAuthorizationTransition =
  | { ok: true; record: ReturnAuthorizationRecord }
  | { ok: false; reason: string };

export function transitionReturnAuthorization(
  record: ReturnAuthorizationRecord,
  action: ReturnAuthorizationAction,
  actor: WorkflowActor,
  at: string,
): ReturnAuthorizationTransition {
  if (!isWorkspaceWriter(actor)) return { ok: false, reason: 'A workspace editor is required for this RMA action.' };
  if (!isIsoTime(at)) return { ok: false, reason: 'A valid action time is required.' };
  const note = String('note' in action ? action.note || '' : '').trim();
  if (note.length > 1000 || hasControlCharacters(note)) return { ok: false, reason: 'The note must be 1,000 characters or fewer and contain no control characters.' };

  let nextStatus: ReturnAuthorizationStatus;
  let extra: Partial<ReturnAuthorizationRecord>;
  if (action.type === 'approve' || action.type === 'decline') {
    if (record.status !== 'requested') return { ok: false, reason: 'Only a requested RMA can be approved or declined.' };
    if (!APPROVER_ROLES.has(actor.role)) return { ok: false, reason: 'Only an owner or accountant can decide an RMA.' };
    if (actor.uid === record.requestedByUid) return { ok: false, reason: 'The person who requested an RMA cannot approve or decline it.' };
    if (action.type === 'decline' && !note) return { ok: false, reason: 'Add a short reason before declining this RMA.' };
    nextStatus = action.type === 'approve' ? 'approved' : 'declined';
    extra = {
      decidedAt: at,
      decidedByUid: actor.uid,
      decidedByName: displayName(actor.name),
      ...(note ? { approvalNote: note } : {}),
    };
  } else if (action.type === 'receive') {
    if (record.status !== 'approved') return { ok: false, reason: 'Only an approved RMA can be marked received.' };
    nextStatus = 'received';
    extra = { receivedAt: at, receivedByUid: actor.uid, receivedByName: displayName(actor.name) };
  } else {
    if (record.status !== 'received') return { ok: false, reason: 'Mark the goods received before linking a credit note.' };
    const credit = action.creditNote;
    if (!credit?.id || credit.customerId !== record.customerId || credit.invoiceId !== record.invoiceId || credit.workspaceId !== record.workspaceId) {
      return { ok: false, reason: 'Choose a credit note for the same customer, invoice and workspace.' };
    }
    if (credit.status === 'draft' || credit.status === 'void') return { ok: false, reason: 'A draft or void credit note cannot close an RMA.' };
    nextStatus = 'closed';
    extra = {
      linkedCreditNoteId: credit.id,
      linkedCreditNoteNumber: credit.number || credit.id,
      linkedAt: at,
      linkedByUid: actor.uid,
      linkedByName: displayName(actor.name),
    };
  }

  return {
    ok: true,
    record: {
      ...record,
      ...extra,
      status: nextStatus,
      events: [...record.events, {
        status: nextStatus,
        at,
        byUid: actor.uid,
        byName: displayName(actor.name),
        ...(note ? { note } : {}),
      }],
    },
  };
}

function validWarrantyRecord(value: unknown): value is WarrantyRecord {
  if (!isPlainRecord(value)) return false;
  const record = value as unknown as WarrantyRecord;
  return typeof record.id === 'string' && typeof record.workspaceId === 'string' && Boolean(record.workspaceId.trim()) &&
    typeof record.customerId === 'string' && Boolean(record.customerId.trim()) &&
    typeof record.invoiceId === 'string' && Boolean(record.invoiceId.trim()) &&
    typeof record.invoiceLineId === 'string' && Boolean(record.invoiceLineId.trim()) &&
    typeof record.itemId === 'string' && Boolean(record.itemId.trim()) &&
    typeof record.serial === 'string' && Boolean(record.serial.trim()) && record.serial.length <= 80 && !hasControlCharacters(record.serial) &&
    isIsoDate(record.endDate) && isIsoTime(record.updatedAt) &&
    typeof record.updatedByUid === 'string' && Boolean(record.updatedByUid.trim()) &&
    typeof record.updatedByName === 'string' && record.updatedByName.length <= 120 &&
    Array.isArray(record.changeLog) && record.changeLog.length > 0 && record.changeLog.every(change =>
      isPlainRecord(change) &&
      (change.previousEndDate === null || isIsoDate(String(change.previousEndDate))) &&
      isIsoDate(String(change.endDate)) && isIsoTime(String(change.at)) &&
      typeof change.byUid === 'string' && Boolean(change.byUid.trim()) &&
      typeof change.byName === 'string' && change.byName.length <= 120,
    );
}

export function warrantyRecordKey(candidate: Pick<WarrantyCandidate, 'invoiceId' | 'invoiceLineId' | 'itemId' | 'serial'>): string {
  const foldedSerial = normalizeSerial(candidate.serial).toLowerCase();
  return `w_${[
    candidate.invoiceId,
    candidate.invoiceLineId,
    candidate.itemId,
    foldedSerial,
  ].map(value => encodedPathPart(String(value))).join('__')}`;
}

export function warrantyFieldPath(candidate: Pick<WarrantyCandidate, 'invoiceId' | 'invoiceLineId' | 'itemId' | 'serial'>): string {
  return `metadata.${WARRANTIES_METADATA_FIELD}.${warrantyRecordKey(candidate)}`;
}

export function warrantyRecordsFromMetadata(
  metadata: EntityMetadata | undefined,
  customerId?: string,
  workspaceId?: string,
): WarrantyRecord[] {
  const raw = metadata?.[WARRANTIES_METADATA_FIELD];
  if (!isPlainRecord(raw)) return [];
  return Object.entries(raw).flatMap(([key, value]) => {
    if (!validWarrantyRecord(value) || key !== value.id || key !== warrantyRecordKey(value)) return [];
    if (customerId && value.customerId !== customerId) return [];
    if (workspaceId && value.workspaceId !== workspaceId) return [];
    return [value];
  }).sort((a, b) => a.serial.localeCompare(b.serial, undefined, { sensitivity: 'base' }));
}

export function warrantyRecordForCandidate(
  records: WarrantyRecord[],
  candidate: Pick<WarrantyCandidate, 'invoiceId' | 'invoiceLineId' | 'itemId' | 'serial'>,
): WarrantyRecord | null {
  const key = warrantyRecordKey(candidate);
  return records.find(record => record.id === key) || null;
}

function invoiceIsIssued(invoice: Invoice): boolean {
  return !UNISSUED_INVOICE_STATUSES.has(String(invoice.status).toLowerCase());
}

function inventoryById(items: InventoryItem[]): Map<string, InventoryItem> {
  return new Map(items.filter(item => item && typeof item.id === 'string').map(item => [item.id, item]));
}

export function warrantyCandidates(
  invoices: Invoice[],
  customers: Customer[],
  items: InventoryItem[],
  workspaceId: string,
): WarrantyCandidate[] {
  const customerById = new Map(customers.filter(customer => customer.workspaceId === workspaceId).map(customer => [customer.id, customer]));
  const itemById = inventoryById(items.filter(item => item.workspaceId === workspaceId));
  const rows: WarrantyCandidate[] = [];
  for (const invoice of invoices) {
    if (invoice.workspaceId !== workspaceId || !invoiceIsIssued(invoice) || !invoice.customerId) continue;
    for (const line of invoice.items || []) {
      if (!line.itemId || !line.id) continue;
      const item = itemById.get(line.itemId);
      if (item?.itemType === 'service') continue;
      const seenSerials = new Set<string>();
      const serials = lineSerials(line);
      const customer = customerById.get(invoice.customerId);
      for (const serial of serials) {
        const cleanSerial = normalizeSerial(serial);
        const serialKey = cleanSerial.toLowerCase();
        if (!cleanSerial || cleanSerial.length > 80 || hasControlCharacters(cleanSerial) || seenSerials.has(serialKey)) continue;
        seenSerials.add(serialKey);
        const candidate: WarrantyCandidate = {
          id: '',
          workspaceId,
          customerId: invoice.customerId,
          customerName: customer?.name || invoice.customerName || 'Unknown customer',
          invoiceId: invoice.id,
          invoiceNumber: invoice.number || invoice.id,
          invoiceDate: String(invoice.date || '').slice(0, 10),
          invoiceLineId: line.id,
          itemId: line.itemId,
          itemName: item?.name || line.description || 'Inventory item',
          sku: item?.sku || '',
          serial: cleanSerial,
          customerLoaded: Boolean(customer),
        };
        candidate.id = warrantyRecordKey(candidate);
        rows.push(candidate);
      }
    }
  }
  return rows.sort((a, b) =>
    a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }) ||
    a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' }) ||
    a.serial.localeCompare(b.serial, undefined, { sensitivity: 'base' }) ||
    a.invoiceDate.localeCompare(b.invoiceDate),
  );
}

export function warrantyEndDateProblem(endDate: string): string | null {
  if (!isIsoDate(String(endDate ?? '').trim())) return 'Enter a valid warranty end date.';
  return null;
}

export function warrantyStatus(endDate: string | undefined, today: string): 'under warranty' | 'expired' | 'not set' {
  if (!endDate || !isIsoDate(endDate) || !isIsoDate(today)) return 'not set';
  return endDate >= today ? 'under warranty' : 'expired';
}

export function createWarrantyRecord(input: {
  candidate: WarrantyCandidate;
  endDate: string;
  actor: WorkflowActor;
  at: string;
  existing?: WarrantyRecord | null;
}): WarrantyRecord {
  const endDate = String(input.endDate ?? '').trim();
  const dateProblem = warrantyEndDateProblem(endDate);
  if (dateProblem) throw new Error(dateProblem);
  const candidate = input.candidate;
  if (!candidate.customerLoaded) throw new Error('Load the customer record before changing a warranty date.');
  if (!candidate.workspaceId.trim() || !candidate.customerId.trim() || !candidate.invoiceId.trim() ||
    !candidate.invoiceLineId.trim() || !candidate.itemId.trim() ||
    candidate.serial !== normalizeSerial(candidate.serial) || !candidate.serial || candidate.serial.length > 80 || hasControlCharacters(candidate.serial)) {
    throw new Error('Choose a valid serial record from an issued invoice.');
  }
  if (!isWorkspaceWriter(input.actor)) throw new Error('A workspace editor is required to change a warranty date.');
  if (!isIsoTime(input.at)) throw new Error('A valid update time is required.');
  const id = warrantyRecordKey(candidate);
  if (candidate.id !== id) throw new Error('The selected warranty candidate is invalid.');
  if (input.existing && (input.existing.id !== id || input.existing.workspaceId !== candidate.workspaceId || input.existing.customerId !== candidate.customerId)) {
    throw new Error('The saved warranty record does not match this invoice line.');
  }
  if (input.existing?.endDate === endDate) return input.existing;
  const previousEndDate = input.existing?.endDate || null;
  const change: WarrantyChange = {
    previousEndDate,
    endDate,
    at: input.at,
    byUid: input.actor.uid,
    byName: displayName(input.actor.name),
  };
  return {
    id,
    workspaceId: candidate.workspaceId,
    customerId: candidate.customerId,
    invoiceId: candidate.invoiceId,
    invoiceLineId: candidate.invoiceLineId,
    itemId: candidate.itemId,
    serial: candidate.serial,
    endDate,
    updatedAt: input.at,
    updatedByUid: input.actor.uid,
    updatedByName: displayName(input.actor.name),
    changeLog: [...(input.existing?.changeLog || []), change],
  };
}

/** Useful for exports and quick filters without having to duplicate date-boundary rules. */
export function filterWarrantyCandidates<T extends { endDate?: string }>(
  rows: T[],
  filter: 'all' | 'under warranty' | 'expired' | 'not set',
  today: string,
): T[] {
  return rows.filter(row => filter === 'all' || warrantyStatus(row.endDate, today) === filter);
}
