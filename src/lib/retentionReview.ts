/**
 * A-144: a country-based timetable for reviewing old business records, not a legal retention
 * opinion or an authorization to delete. Periods are the owner-specified IL/US/UK inputs. This is
 * deliberately separate from Workspace.retention, which governs server logs and workspace recovery.
 */
import type { DimensionNode } from '../types';
import { addMonthsYMD } from './fiscalCalendar';
import { resolveDimensionLabel } from './dimensionUtils';
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

/** Resolve legacy descriptions and aliases to the stable node key used by Tax profiles. */
function stableDimensionValue(raw: string, dimensionId: string, nodes: readonly DimensionNode[]): string {
  const normalize = (value: string) => value.normalize('NFC').toLowerCase().trim();
  const dimension = normalize(dimensionId);
  const matches = (value: string) => {
    const key = normalize(value);
    return nodes.find(node => normalize(node.dimensionId) === dimension &&
      [node.id, node.description, ...(node.aliases || [])].some(label => normalize(label) === key));
  };
  const target = raw.trim();
  const exactNode = matches(target);
  if (exactNode) return exactNode.id;

  const [root, ...suffix] = target.split('/');
  if (!suffix.length) return target;
  const rootNode = matches(root);
  return rootNode ? [rootNode.id, ...suffix].join('/') : target;
}

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

function classify(input: {
  key: string;
  recordId: string;
  recordNumber: string;
  recordType: string;
  recordDate?: string;
  recordStatus?: string;
  dimensions?: Record<string, string>;
  relatedRecord?: string;
  profiles?: TaxProfiles | null;
  dimensionId: string;
  nodes: readonly DimensionNode[];
  asOfDate: string;
  missingSource?: boolean;
}): RetentionReviewRow {
  const rawValue = input.dimensions?.[input.dimensionId];
  const profile = resolveSellerProfile(input.profiles, input.dimensions, [input.dimensionId]);
  const countryCode = typeof profile.place?.country === 'string' && /^[A-Za-z]{2}$/.test(profile.place.country.trim())
    ? profile.place.country.trim().toUpperCase()
    : '';
  const period = periodForCountry(countryCode);
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
  const entity = profile.name || (rawValue
    ? resolveDimensionLabel(input.nodes as DimensionNode[], input.dimensionId, rawValue)
    : 'Books');
  const countryName = period?.countryName || (countryCode || 'Unknown');

  return {
    key: input.key,
    recordId: input.recordId,
    recordNumber: input.recordNumber,
    recordType: input.recordType,
    recordDate: date,
    recordStatus: input.recordStatus || '',
    entity,
    profileSource: profile.from[0] || 'No matching Tax profile',
    countryCode,
    countryName,
    ...(period ? { periodYears: period.years } : {}),
    ...(reviewDueOn ? { reviewDueOn } : {}),
    reviewState,
    ...(reason ? { reason } : {}),
    ...(input.relatedRecord ? { relatedRecord: input.relatedRecord } : {}),
  };
}

function rowsForRecord(record: RetentionSourceRecord, input: RetentionReviewInput, dimensionId: string, nodes: readonly DimensionNode[]): RetentionReviewRow[] {
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
    dimensions: raw ? { [dimensionId]: raw } : undefined,
    profiles: input.profiles,
    dimensionId,
    nodes,
    asOfDate: input.asOfDate,
  }));
}

/** Review supported documents and their linked files using saved Tax profiles and calendar-year arithmetic. */
export function retentionReview(input: RetentionReviewInput): RetentionReviewReport {
  if (!validDate(input.asOfDate)) throw new Error('Choose a valid as-of date.');
  const dimensionId = input.worldDimensionId || 'world';
  const nodes = input.dimensionNodes || [];
  const recordsByKey = new Map<string, RetentionSourceRecord>();
  const rows = input.records.flatMap(record => {
    recordsByKey.set(`${record.collection}:${record.id}`, record);
    return rowsForRecord(record, input, dimensionId, nodes);
  });

  for (const attachment of input.attachments || []) {
    if (!attachment.id || !attachment.linkedId || !REVIEWABLE_ATTACHMENT_COLLECTIONS.has(attachment.linkedCollection as RetentionReviewCollection)) continue;
    const collection = attachment.linkedCollection as RetentionReviewCollection;
    const parent = recordsByKey.get(`${collection}:${attachment.linkedId}`);
    if (!parent) {
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
      }));
      continue;
    }
    const parentRows = rowsForRecord(parent, input, dimensionId, nodes);
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

  rows.sort((a, b) => a.reviewState.localeCompare(b.reviewState) ||
    a.reviewDueOn?.localeCompare(b.reviewDueOn || '') || a.recordDate.localeCompare(b.recordDate) ||
    a.recordType.localeCompare(b.recordType) || a.recordNumber.localeCompare(b.recordNumber));
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
