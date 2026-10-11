/**
 * E-11: read-only normalization of HUMAN-REVIEWED state/local rate tables.
 *
 * Not a raw XLSX/PDF/ZIP parser; not a ZIP-to-tax-jurisdiction engine.
 * Never use these rows to calculate, post, or file taxes. Import previews are
 * explicitly unapproved even when no row-level issues are found.
 */
import { validCustomReportPeriod } from '../reportCustomPeriod';

export type LocalRateState = 'TX' | 'CA' | 'NY' | 'WA' | 'CO';

export interface StateLocalRateRow {
  state: LocalRateState;
  jurisdiction: string;
  /** Fraction of the transaction base (8.25% = 0.0825), NOT percentage points. */
  rate: number;
  /** Inclusive source-edition validity. Null means end date was not established. */
  validFrom: string;
  validTo: string | null;
  /** Official publication URL, not proof of address applicability. */
  source: string;
  /** A combined figure must never be added to its constituent rates. */
  basis: 'combined' | 'component';
  /** The row number in the reviewed source table, including its header. */
  sourceRow: number;
  /** Optional human-verified edition identifier for audit traceability. */
  edition?: string;
  code?: string;
  zip?: string;
  zip4Low?: string;
  zip4High?: string;
}

export interface LocalRateImport {
  rows: StateLocalRateRow[];
  issues: Array<{ row: number; reason: string }>;
  /** No normalized table is sufficient for trustworthy address-level taxation. */
  readyForTaxCalculation: false;
}

export interface LocalRateImportOptions {
  /** Inclusive end date from the source; omitted means unknown, not indefinitely valid. */
  validTo?: string;
  /** A specific verified publication identifier (e.g. WA 2026 Q4 short file). */
  edition?: string;
  /** Specific official publication URL when verified, instead of its index page. */
  publicationUrl?: string;
}

const SOURCES: Record<LocalRateState, string> = {
  TX: 'https://comptroller.texas.gov/taxes/sales/city.php',
  CA: 'https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
  NY: 'https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_tax_rate_publications.htm',
  WA: 'https://dor.wa.gov/taxes-rates/sales-use-tax-rates/downloadable-database',
  CO: 'https://tax.colorado.gov/DR1002',
};

const normalizeHeader = (value: string) =>
  value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = (names: readonly string[]) => names.map(normalizeHeader);
const REQUIRED: Record<LocalRateState, readonly (readonly string[])[]> = {
  TX: [['Name', 'City County Name'], ['Local Code'], ['Local Rate', 'Total Rate']],
  CA: [['Location', 'City', 'City County'], ['Rate', 'Tax Rate', 'Total Rate']],
  NY: [['County or other locality', 'Jurisdiction', 'Taxing Jurisdiction'], ['Tax rate %', 'Tax Rate', 'Rate'], ['Reporting code', 'Code']],
  WA: [['ZIP', 'ZIP Code', 'ZIP5'], ['ZIP+4 Low', 'Zip4Low', 'Low', 'Plus4 Low'], ['ZIP+4 High', 'Zip4High', 'High', 'Plus4 High'], ['Location Code', 'Location ID'], ['Rate', 'Combined Rate', 'Total Rate']],
  CO: [['Location', 'Taxing Jurisdiction', 'City County', 'Jurisdiction'], ['Sales Tax Rate', 'Sales Rate', 'Tax Rate', 'Rate']],
};

function validateHeaders(state: LocalRateState, headers: readonly string[]): void {
  if (!headers.length || headers.every(x => !String(x ?? '').trim())) {
    throw new Error('Missing column headings.');
  }
  const seen = new Set<string>();
  for (const cell of headers) {
    const normalized = normalizeHeader(String(cell ?? ''));
    if (!normalized) continue;
    if (seen.has(normalized)) throw new Error('Duplicate column heading: ' + cell);
    seen.add(normalized);
  }
  for (const group of REQUIRED[state]) {
    const hits = headers.filter(column => aliases(group).includes(normalizeHeader(column))).length;
    if (hits === 0) {
      throw new Error('Unrecognized source headings: expected ' + group.join(' / ') + '. Review the publication layout.');
    }
    // Texas rate tables may legitimately include both a local component and a total.
    if (hits > 1 && !(state === 'TX' && group.includes('Total Rate'))) {
      throw new Error('Ambiguous source headings for ' + group.join(' / ') + '; review column mapping.');
    }
  }
}

const val = (headers: readonly string[], cells: readonly string[], ...names: string[]) => {
  const expected = aliases(names);
  const idx = headers.findIndex(column => expected.includes(normalizeHeader(column)));
  return idx < 0 ? '' : String(cells[idx] ?? '').trim();
};

function validDate(value: string): boolean {
  return validCustomReportPeriod({ startDate: value, endDate: value });
}

/**
 * Parse a known unit, not an inferred unit. An unmarked 0.5 is ambiguous:
 * 0.5 percent and 50 percent must never be silently interchanged.
 */
export function parseRateFraction(raw: string, mode: 'decimal' | 'percentage' | 'auto'): number {
  let text = raw.trim().replace(/,/g, '');
  const pct = text.endsWith('%');
  if (pct) text = text.slice(0, -1).trim();
  const mixedVulgar = text.match(/^(\d+)\s*([¼½¾])$/);
  const vulgar: Record<string, string> = { '¼': '.25', '½': '.5', '¾': '.75' };
  if (mixedVulgar) text = mixedVulgar[1] + vulgar[mixedVulgar[2]];
  const mixedAscii = text.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
  if (mixedAscii) {
    const numerator = Number(mixedAscii[2]), denominator = Number(mixedAscii[3]);
    if (denominator === 0 || numerator >= denominator) throw new Error('Invalid fractional rate.');
    text = String(Number(mixedAscii[1]) + numerator / denominator);
  }
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw new Error('Rate is not numeric or has an unsupported format.');
  const value = Number(text);
  if (mode === 'auto' && !pct) {
    // Kept for external callers; never use an inferred unit in state importers.
    throw new Error('Ambiguous rate units: provide a fraction or explicit percent mode.');
  }
  const rate = pct || mode === 'percentage' ? value / 100 : value;
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.2) {
    throw new Error('Rate exceeds the 0–20% staging validation range or has the wrong units.');
  }
  return Number(rate.toFixed(8));
}

function checkWashingtonRanges(rows: readonly StateLocalRateRow[], issues: LocalRateImport['issues']): void {
  const byZip = new Map<string, StateLocalRateRow[]>();
  for (const row of rows) {
    if (row.state !== 'WA' || !row.zip) continue;
    const group = byZip.get(row.zip) ?? [];
    group.push(row);
    byZip.set(row.zip, group);
  }
  for (const [zip, group] of byZip) {
    group.sort((a, b) => (a.zip4Low ?? '').localeCompare(b.zip4Low ?? ''));
    let furthest: StateLocalRateRow | undefined;
    for (const row of group) {
      if (furthest && (row.zip4Low ?? '') <= (furthest.zip4High ?? '')) {
        issues.push({
          row: row.sourceRow,
          reason: 'Overlapping WA ZIP+4 coverage for ' + zip + ' (source rows ' +
            furthest.sourceRow + ', ' + row.sourceRow + '); requires manual adjudication.',
        });
      }
      if (!furthest || (row.zip4High ?? '') > (furthest.zip4High ?? '')) furthest = row;
    }
  }
}

export function parseStateLocalRateRows(
  state: LocalRateState,
  table: readonly (readonly string[])[],
  validFrom: string,
  options: LocalRateImportOptions = {},
): LocalRateImport {
  if (!validDate(validFrom)) throw new Error('Supply a valid effective date from the source publication.');
  if (options.validTo !== undefined && (!validDate(options.validTo) || options.validTo < validFrom)) {
    throw new Error('Invalid publication end date: it must be a real date on or after validFrom.');
  }
  if (!Object.prototype.hasOwnProperty.call(SOURCES, state)) throw new Error('Unsupported state source.');
  if (!table.length) throw new Error('Missing column headings.');
  const [headers, ...data] = table;
  validateHeaders(state, headers);
  let source = SOURCES[state];
  if (options.publicationUrl !== undefined) {
    try {
      const url = new URL(options.publicationUrl);
      const expectedHost = new URL(SOURCES[state]).hostname;
      if (url.protocol !== 'https:' || url.hostname !== expectedHost ||
          url.username || url.password) throw new Error('Invalid authority URL.');
      source = url.toString();
    } catch {
      throw new Error('The source publication must have an HTTPS URL.');
    }
  }
  if (options.edition !== undefined && (!options.edition.trim() || options.edition.length > 160)) {
    throw new Error('Edition identifier must be 1–160 nonblank characters.');
  }
  const rows: StateLocalRateRow[] = [];
  const issues: LocalRateImport['issues'] = [];
  const distinctRows = new Set<string>();
  const ratesByJurisdiction = new Map<string, { rate: number; sourceRow: number }>();

  for (let i = 0; i < data.length; i++) {
    const cells = data[i];
    if (cells.every(cell => !String(cell ?? '').trim())) continue;
    try {
      let jurisdiction = '', raw = '', basis: StateLocalRateRow['basis'] = 'combined';
      let code = '', zip = '', zip4Low = '', zip4High = '';
      switch (state) {
        case 'TX': {
          jurisdiction = val(headers, cells, 'Name', 'City County Name');
          code = val(headers, cells, 'Local Code');
          const combined = val(headers, cells, 'Total Rate');
          raw = combined || val(headers, cells, 'Local Rate');
          basis = combined ? 'combined' : 'component';
          if (!code) throw new Error('Missing Texas local code.');
          break;
        }
        case 'CA':
          jurisdiction = val(headers, cells, 'Location', 'City', 'City County');
          raw = val(headers, cells, 'Rate', 'Tax Rate', 'Total Rate');
          code = val(headers, cells, 'Type');
          break;
        case 'NY':
          jurisdiction = val(headers, cells, 'County or other locality', 'Jurisdiction', 'Taxing Jurisdiction');
          raw = val(headers, cells, 'Tax rate %', 'Tax Rate', 'Rate');
          code = val(headers, cells, 'Reporting code', 'Code');
          if (!code) throw new Error('Missing New York reporting code.');
          break;
        case 'WA':
          jurisdiction = val(headers, cells, 'Location', 'Jurisdiction', 'City', 'Location Name') || 'ZIP region';
          zip = val(headers, cells, 'ZIP', 'ZIP Code', 'ZIP5');
          zip4Low = val(headers, cells, 'ZIP+4 Low', 'Zip4Low', 'Low', 'Plus4 Low');
          zip4High = val(headers, cells, 'ZIP+4 High', 'Zip4High', 'High', 'Plus4 High');
          code = val(headers, cells, 'Location Code', 'Location ID');
          raw = val(headers, cells, 'Rate', 'Combined Rate', 'Total Rate');
          if (!/^\d{5}$/.test(zip)) throw new Error('Washington entry must include a five-digit ZIP (preserve leading zeroes).');
          if (!/^\d{4}$/.test(zip4Low) || !/^\d{4}$/.test(zip4High) || zip4Low > zip4High) {
            throw new Error('Washington staging requires a complete, ordered ZIP+4 interval.');
          }
          if (!code) throw new Error('Missing Washington location code.');
          break;
        case 'CO':
          jurisdiction = val(headers, cells, 'Location', 'Taxing Jurisdiction', 'City County', 'Jurisdiction');
          raw = val(headers, cells, 'Sales Tax Rate', 'Sales Rate', 'Tax Rate', 'Rate');
          code = val(headers, cells, 'Location Code', 'Code');
          basis = 'component'; // A component is not a verified full location rate.
          break;
      }
      if (!jurisdiction || !raw) throw new Error('Missing jurisdiction or rate.');
      const rate = parseRateFraction(
        raw, state === 'TX' || state === 'WA' ? 'decimal' : 'percentage',
      );
      const row: StateLocalRateRow = {
        state, jurisdiction, rate, validFrom, validTo: options.validTo ?? null, source,
        basis, sourceRow: i + 2,
        ...(options.edition ? { edition: options.edition } : {}),
        ...(code ? { code } : {}),
        ...(zip ? { zip, zip4Low, zip4High } : {}),
      };
      const identity = JSON.stringify([row.jurisdiction, row.rate, row.basis, row.code, row.zip, row.zip4Low, row.zip4High]);
      if (distinctRows.has(identity)) throw new Error('Duplicate row in this publication edition.');
      distinctRows.add(identity);
      const locationKey = JSON.stringify([row.jurisdiction.toLowerCase(), row.code,
        row.zip, row.zip4Low, row.zip4High, row.basis]);
      const previousRate = ratesByJurisdiction.get(locationKey);
      if (previousRate && previousRate.rate !== row.rate) {
        issues.push({ row: row.sourceRow,
          reason: 'Conflicting rates for the same location key (source rows ' +
            previousRate.sourceRow + ', ' + row.sourceRow + '); location must be adjudicated.' });
      } else if (!previousRate) {
        ratesByJurisdiction.set(locationKey, { rate: row.rate, sourceRow: row.sourceRow });
      }
      rows.push(row);
    } catch (error) {
      issues.push({ row: i + 2, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  if (rows.length === 0) issues.push({ row: 1, reason: 'No valid source rows; reject this import.' });
  if (state === 'WA') checkWashingtonRanges(rows, issues);
  return { rows, issues, readyForTaxCalculation: false };
}

export const parseTexasLocalRates = (
  table: readonly (readonly string[])[], validFrom: string, options?: LocalRateImportOptions,
) => parseStateLocalRateRows('TX', table, validFrom, options);
export const parseCaliforniaLocalRates = (
  table: readonly (readonly string[])[], validFrom: string, options?: LocalRateImportOptions,
) => parseStateLocalRateRows('CA', table, validFrom, options);
export const parseNewYorkLocalRates = (
  table: readonly (readonly string[])[], validFrom: string, options?: LocalRateImportOptions,
) => parseStateLocalRateRows('NY', table, validFrom, options);
export const parseWashingtonLocalRates = (
  table: readonly (readonly string[])[], validFrom: string, options?: LocalRateImportOptions,
) => parseStateLocalRateRows('WA', table, validFrom, options);
export const parseColoradoLocalRates = (
  table: readonly (readonly string[])[], validFrom: string, options?: LocalRateImportOptions,
) => parseStateLocalRateRows('CO', table, validFrom, options);
