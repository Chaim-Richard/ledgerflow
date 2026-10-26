/**
 * A-144: a country-based timetable for reviewing old business records, not a legal retention
 * opinion or an authorization to delete. Periods are the owner-specified IL/US/UK inputs. This is
 * deliberately separate from Workspace.retention, which governs server logs and workspace recovery.
 */
import type { DimensionNode } from '../types';
import { addMonthsYMD } from './fiscalCalendar';
import { resolveDimensionLabel, stableLabelValue } from './dimensionUtils';
import { resolveSellerProfile, type TaxProfiles } from './tax/profile';
import { validCustomReportPeriod } from './reportCustomPeriod';

export type RetentionReviewCollection = 'invoices' | 'bills' | 'creditNotes' | 'vendorCredits' | 'estimates' | 'purchaseOrders';
export type RetentionReviewState = 'due' | 'not-due' | 'unclassified';

export interface RetentionPeriodInput {
  countryCode: 'IL' | 'US' | 'GB';
  countryName: string;
  years: number;
  /** These periods were supplied for A-144; they are not presented as statutory advice. */
  source: string;
}

export const RECORD_RETENTION_REVIEW_PERIODS: readonly RetentionPeriodInput[] = [
  { countryCode: 'IL', countryName: 'Israel', years: 7, source: 'Owner-specified A-144 review timetable' },
  { countryCode: 'US', countryName: 'United States', years: 7, source: 'Owner-specified A-144 review timetable' },
  { countryCode: 'GB', countryName: 'United Kingdom', years: 6, source: 'Owner-specified A-144 review timetable' },
];

const COUNTRY_PERIOD = new Map(RECORD_RETENTION_REVIEW_PERIODS.map(period => [period.countryCode, period]));
const REVIEWABLE_ATTACHMENT_COLLECTIONS = new Set<RetentionReviewCollection>(['invoices', 'bills', 'estimates', 'purchaseOrders']);
const COLLECTION_LABELS: Record<RetentionReviewCollection, string> = {
  invoices: 'Invoice',
  bills: 'Bill',
  creditNotes: 'Credit note',
  vendorCredits: 'Vendor credit',
  estimates: 'Estimate',
  purchaseOrders: 'Purchase order',
};

export interface RetentionSourceRecord {
  collection: RetentionReviewCollection;
  id: string;
  number?: string;
  date?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  /** Optional document-level Location/World dimension values. */
  dimensions?: Record<string, string>;
  /** Invoice/bill line dimension maps; an unlabelled line falls back to the books profile. */
  lineDimensions?: Array<Record<string, string> | undefined>;
}

export interface RetentionAttachmentLink {
  id: string;
  name?: string;
  linkedId: string;
  linkedCollection: string;
}

export interface RetentionReviewRow {
  key: string;
  recordId: string;
  recordNumber: string;
  recordType: string;
  recordDate: string;
  recordStatus: string;
  /** One row per source-record entity context; a mixed-entity document may appear more than once. */
  entity: string;
  profileSource: string;
  countryCode: string;
  countryName: string;
  periodYears?: number;
  reviewDueOn?: string;
  reviewState: RetentionReviewState;
  reason?: string;
  /** Present for an attachment row; the parent record is never deleted by this report. */
  relatedRecord?: string;
}

export interface RetentionReviewReport {
  rows: RetentionReviewRow[];
  asOfDate: string;
  dueCount: number;
  notDueCount: number;
  unclassifiedCount: number;
}

export interface RetentionReviewInput {
  records: readonly RetentionSourceRecord[];
  attachments?: readonly RetentionAttachmentLink[];
  profiles?: TaxProfiles | null;
  /** The workspace's World/Entity dimension; default is the system `world` dimension. */
  worldDimensionId?: string;
  dimensionNodes?: readonly DimensionNode[];
  asOfDate: string;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const day = value.slice(0, 10);
  return validCustomReportPeriod({ startDate: day, endDate: day });
}

function periodForCountry(value: unknown): RetentionPeriodInput | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase();
  return COUNTRY_PERIOD.get(code as 'IL' | 'US' | 'GB');
}

const stableDimensionValue = stableLabelValue;

function valuesForRecord(record: RetentionSourceRecord, dimensionId: string, nodes: readonly DimensionNode[]): Array<string | undefined> {
  const canonical = (value: string) => stableDimensionValue(value, dimensionId, nodes);
  const header = record.dimensions?.[dimensionId];
  if (typeof header === 'string' && header.trim()) return [canonical(header)];

  const metadataDimensions = asObject(record.metadata?.dimensions);
  const metadataValue = metadataDimensions?.[dimensionId];
  if (typeof metadataValue === 'string' && metadataValue.trim()) return [canonical(metadataValue)];

  const values = new Set<string>();
  let hasUnassignedLine = false;
  for (const dimensions of record.lineDimensions || []) {
    const value = dimensions?.[dimensionId];
    if (typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'unassigned') values.add(canonical(value));
    else hasUnassignedLine = true;
  }
  if (values.size === 0) return [undefined];
  if (hasUnassignedLine) return [...values, undefined];
  return [...values];
}

function recordLabel(record: RetentionSourceRecord): string {
  if (record.collection === 'bills' && asObject(record.metadata?.expenseClaim)) return 'Expense claim';
  return COLLECTION_LABELS[record.collection];
}

interface ResolvedEntityContext {
  entity: string;
  profileSource: string;
  countryCode: string;
  countryName: string;
  period?: RetentionPeriodInput;
}

function resolveEntityContext(
  rawValue: string | undefined,
  profiles: TaxProfiles | null | undefined,
  dimensionId: string,
  nodes: readonly DimensionNode[],
  cache: Map<string, ResolvedEntityContext>,
): ResolvedEntityContext {
  const cacheKey = rawValue ?? '';
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const dimensions = rawValue ? { [dimensionId]: rawValue } : undefined;
  const profile = resolveSellerProfile(profiles, dimensions, [dimensionId]);
  const countryCode = typeof profile.place?.country === 'string' && /^[A-Za-z]{2}$/.test(profile.place.country.trim())
    ? profile.place.country.trim().toUpperCase()
    : '';
  const period = periodForCountry(countryCode);
  const entity = profile.name || (rawValue
    ? resolveDimensionLabel(nodes as DimensionNode[], dimensionId, rawValue)
    : 'Books');
  const countryName = period?.countryName || (countryCode || 'Unknown');
  const resolved: ResolvedEntityContext = {
    entity,
    profileSource: profile.from[0] || 'No matching Tax profile',
    countryCode,
    countryName,
    period,
  };
  cache.set(cacheKey, resolved);
  return resolved;
}

function classify(input: {
  key: string;
  recordId: string;
  recordNumber: string;
  recordType: string;
  recordDate?: string;
  recordStatus?: string;
  rawValue?: string;
  relatedRecord?: string;
  profiles?: TaxProfiles | null;
  dimensionId: string;
  nodes: readonly DimensionNode[];
  asOfDate: string;
  missingSource?: boolean;
  contextCache: Map<string, ResolvedEntityContext>;
}): RetentionReviewRow {
  const { entity, profileSource, countryCode, countryName, period } = resolveEntityContext(
    input.rawValue,
    input.profiles,
    input.dimensionId,
    input.nodes,
    input.contextCache,
  );
  const date = validDate(input.recordDate) ? input.recordDate.slice(0, 10) : '';
  const reviewDueOn = period && date ? addMonthsYMD(date, period.years * 12) : undefined;
  const reviewState: RetentionReviewState = reviewDueOn
    ? (reviewDueOn <= input.asOfDate ? 'due' : 'not-due')
    : 'unclassified';
  const reason = input.missingSource ? 'The linked source record is not in the loaded history'
    : !date ? 'No valid document date'
    : !countryCode ? 'Country is not recorded in the resolved Tax profile'
    : !period ? `No A-144 review period is specified for ${countryCode}`
    : undefined;

  return {
    key: input.key,
    recordId: input.recordId,
    recordNumber: input.recordNumber,
    recordType: input.recordType,
    recordDate: date,
    recordStatus: input.recordStatus || '',
    entity,
    profileSource,
    countryCode,
    countryName,
    ...(period ? { periodYears: period.years } : {}),
    ...(reviewDueOn ? { reviewDueOn } : {}),
    reviewState,
    ...(reason ? { reason } : {}),
    ...(input.relatedRecord ? { relatedRecord: input.relatedRecord } : {}),
  };
}

function rowsForRecord(
  record: RetentionSourceRecord,
  input: RetentionReviewInput,
  dimensionId: string,
  nodes: readonly DimensionNode[],
  contextCache: Map<string, ResolvedEntityContext>,
): RetentionReviewRow[] {
  if (!record.id) return [];
  const type = recordLabel(record);
  const number = record.number || record.id;
  return valuesForRecord(record, dimensionId, nodes).map((raw, index) => classify({
    key: `${record.collection}:${record.id}:${raw || 'books'}:${index}`,
    recordId: record.id,
    recordNumber: number,
    recordType: type,
    recordDate: record.date,
    recordStatus: record.status,
    rawValue: raw,
    profiles: input.profiles,
    dimensionId,
    nodes,
    asOfDate: input.asOfDate,
    contextCache,
  }));
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Review supported documents and their linked files using saved Tax profiles and calendar-year arithmetic. */
export function retentionReview(input: RetentionReviewInput): RetentionReviewReport {
  if (!validDate(input.asOfDate)) throw new Error('Choose a valid as-of date.');
  const dimensionId = input.worldDimensionId || 'world';
  const nodes = input.dimensionNodes || [];
  const contextCache = new Map<string, ResolvedEntityContext>();
  const rowsByRecordKey = new Map<string, RetentionReviewRow[]>();
  const rows: RetentionReviewRow[] = [];
  for (const record of input.records) {
    const recordRows = rowsForRecord(record, input, dimensionId, nodes, contextCache);
    rowsByRecordKey.set(`${record.collection}:${record.id}`, recordRows);
    for (const r of recordRows) rows.push(r);
  }

  for (const attachment of input.attachments || []) {
    if (!attachment.id || !attachment.linkedId || !REVIEWABLE_ATTACHMENT_COLLECTIONS.has(attachment.linkedCollection as RetentionReviewCollection)) continue;
    const collection = attachment.linkedCollection as RetentionReviewCollection;
    const parentRows = rowsByRecordKey.get(`${collection}:${attachment.linkedId}`);
    if (!parentRows) {
      rows.push(classify({
        key: `attachment:${attachment.id}:missing-source`,
        recordId: attachment.id,
        recordNumber: attachment.name || attachment.id,
        recordType: `${COLLECTION_LABELS[collection]} attachment`,
        recordDate: undefined,
        recordStatus: '',
        profiles: input.profiles,
        dimensionId,
        nodes,
        asOfDate: input.asOfDate,
        missingSource: true,
        contextCache,
      }));
      continue;
    }
    for (const parentRow of parentRows) {
      rows.push({
        ...parentRow,
        key: `attachment:${attachment.id}:${parentRow.key}`,
        recordId: attachment.id,
        recordNumber: attachment.name || attachment.id,
        recordType: `${parentRow.recordType} attachment`,
        relatedRecord: parentRow.recordNumber,
      });
    }
  }

  rows.sort((a, b) => cmpStr(a.reviewState, b.reviewState) ||
    cmpStr(a.reviewDueOn || '', b.reviewDueOn || '') || cmpStr(a.recordDate, b.recordDate) ||
    cmpStr(a.recordType, b.recordType) || cmpStr(a.recordNumber, b.recordNumber));
  return {
    rows,
    asOfDate: input.asOfDate,
    dueCount: rows.filter(row => row.reviewState === 'due').length,
    notDueCount: rows.filter(row => row.reviewState === 'not-due').length,
    unclassifiedCount: rows.filter(row => row.reviewState === 'unclassified').length,
  };
}

export const RETENTION_REVIEW_CSV_HEADERS = [
  'Document type', 'Document', 'Record ID', 'Document date', 'Status', 'Entity', 'Tax-profile source',
  'Country', 'Review period (years)', 'Review due on', 'Review status', 'Reason', 'Related source record',
];

export function retentionReviewCsvRows(rows: readonly RetentionReviewRow[]): Array<Array<string | number>> {
  return rows.map(row => [
    row.recordType, row.recordNumber, row.recordId, row.recordDate, row.recordStatus, row.entity, row.profileSource,
    row.countryName, row.periodYears ?? '', row.reviewDueOn ?? '', row.reviewState, row.reason || '', row.relatedRecord || '',
  ]);
}
