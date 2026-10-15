/**
 * A-111: rule pack coverage. Which places (a country, or a state/province inside one) the packs have
 * rules for, and which kinds of rule: a **rate**, a **taxability** answer (an exemption or a reduced
 * rate that replaces or switches off a rate), a **nexus** threshold, a **registration** threshold and
 * a **filing** rule — plus the other kinds this lane writes (marketplace, withholding, reverse
 * charge, scheme, use tax, import VAT).
 *
 * What this is: an inventory of the rule graph, read from the packs themselves on a chosen date (a
 * rule not in force on that date is not counted). What it is not: a statement that a place has no
 * tax — a place absent here is a place this lane has not written rules for, and its own authority's
 * page governs. Every row names the packs it came from and how many distinct sources back it, so a
 * reader can tell a table with one row from a table with fifty-one.
 *
 * Pure: no storage, no fetching, no clock.
 */
import type { Rule } from './rules';
import type { TaxEffect, TaxRulePack } from './packs/shared';
import { taxRulePacks } from './packs/index';

export type CoverageKind =
  | 'rate' | 'taxability'
  | 'nexus' | 'registration' | 'filing'
  | 'marketplace' | 'withholding' | 'reverse-charge' | 'scheme' | 'use-tax' | 'import-vat';

/** The kinds the queue's own wording asks about, in the order a screen reads them. */
export const CORE_COVERAGE_KINDS: CoverageKind[] = ['rate', 'nexus', 'filing', 'registration'];

export const COVERAGE_KINDS: CoverageKind[] = [
  ...CORE_COVERAGE_KINDS,
  'taxability', 'marketplace', 'withholding', 'reverse-charge', 'scheme', 'use-tax', 'import-vat',
];

export const COVERAGE_KIND_LABELS: Record<CoverageKind, string> = {
  rate: 'Rate',
  taxability: 'Taxability',
  nexus: 'Nexus',
  registration: 'Registration',
  filing: 'Filing',
  marketplace: 'Marketplace',
  withholding: 'Withholding',
  'reverse-charge': 'Reverse charge',
  scheme: 'Scheme',
  'use-tax': 'Use tax',
  'import-vat': 'Import VAT',
};

/** One kind per rule. A rate that accumulates is a rate; one that replaces or switches off another is a taxability answer. */
export function coverageKindOf(rule: Rule<TaxEffect>): CoverageKind {
  switch (rule.effect.kind) {
    case 'rate': return rule.combine === 'accumulate' ? 'rate' : 'taxability';
    case 'sales-tax-holiday': return 'taxability';
    case 'nexus': return 'nexus';
    case 'registration-threshold': return 'registration';
    case 'filing': return 'filing';
    case 'marketplace': return 'marketplace';
    case 'withholding-default': return 'withholding';
    case 'reverse-charge': return 'reverse-charge';
    case 'flat-rate-scheme':
    case 'scheme-threshold': return 'scheme';
    case 'use-tax': return 'use-tax';
    case 'import-vat': return 'import-vat';
  }
}

export interface CoveragePlace {
  /** 'US/TX', 'CA/QC', 'IL' or 'GB' — the country, with the region when the rule names one */
  place: string;
  country: string;
  region?: string;
}

const valuesOf = (rule: Rule<TaxEffect>, attribute: string): string[] =>
  rule.when.filter(c => c.attribute === attribute).flatMap(c => c.values || []);

/**
 * The places a rule talks about. A rule that names a state or province covers those places inside its
 * country (a pack's federal rows name only the country, so both stay visible); a cross-border rule
 * that names only the buyer's country covers that country.
 */
export function coveragePlacesOf(rule: Rule<TaxEffect>): CoveragePlace[] {
  const countries = [...new Set(valuesOf(rule, 'country'))];
  const regions = [...new Set(valuesOf(rule, 'state'))];
  const buyers = [...new Set(valuesOf(rule, 'buyerCountry'))];
  if (countries.length) {
    return countries.flatMap(country =>
      regions.length ? regions.map(region => ({ place: `${country}/${region}`, country, region })) : [{ place: country, country }]);
  }
  if (regions.length) return regions.map(region => ({ place: region, country: '', region }));
  return buyers.map(country => ({ place: country, country }));
}

export interface CoverageRow {
  place: string;
  country: string;
  region?: string;
  /** how many rules of each kind cover this place on the chosen date */
  kinds: Partial<Record<CoverageKind, number>>;
  rules: number;
  packs: string[];
  /** the distinct source URLs behind the place's rules */
  sources: number;
  earliestValidFrom: string;
  latestValidFrom: string;
}

export interface CoverageGap {
  kind: CoverageKind;
  /** places that have at least one rule (of any kind) but none of this kind */
  places: string[];
}

export interface RuleCoverage {
  asOf: string;
  rows: CoverageRow[];
  /** for each of the four kinds the queue asks about: the places that have rules but not this kind */
  gaps: CoverageGap[];
  totals: { places: number; rules: number; packs: number };
}

export interface RuleCoverageInput {
  /** the packs to read; omitted means every pack this lane owns */
  packs?: TaxRulePack[];
  /** only rules in force on this date (YYYY-MM-DD); omitted means every rule in the packs */
  asOf?: string;
}

/** A rule is in force on a date: it has started and has not ended. */
const inForce = (rule: Rule<TaxEffect>, asOf?: string) =>
  !asOf || (rule.validFrom <= asOf && (!rule.validTo || asOf <= rule.validTo));

export function ruleCoverage(input: RuleCoverageInput = {}): RuleCoverage {
  const packs = input.packs || taxRulePacks();
  const rows = new Map<string, CoverageRow & { sourceUrls: Set<string> }>();
  let rules = 0;
  for (const pack of packs) {
    for (const rule of pack.rules) {
      if (!inForce(rule, input.asOf)) continue;
      rules += 1;
      const kind = coverageKindOf(rule);
      for (const place of coveragePlacesOf(rule)) {
        let row = rows.get(place.place);
        if (!row) {
          row = {
            place: place.place, country: place.country, ...(place.region ? { region: place.region } : {}),
            kinds: {}, rules: 0, packs: [], sources: 0,
            earliestValidFrom: rule.validFrom, latestValidFrom: rule.validFrom, sourceUrls: new Set<string>(),
          };
          rows.set(place.place, row);
        }
        row.kinds[kind] = (row.kinds[kind] || 0) + 1;
        row.rules += 1;
        if (!row.packs.includes(pack.id)) row.packs.push(pack.id);
        row.sourceUrls.add(rule.source.url);
        if (rule.validFrom < row.earliestValidFrom) row.earliestValidFrom = rule.validFrom;
        if (rule.validFrom > row.latestValidFrom) row.latestValidFrom = rule.validFrom;
      }
    }
  }

  const sorted = [...rows.values()]
    .map(({ sourceUrls, packs: rowPacks, ...row }) => ({ ...row, packs: rowPacks, sources: sourceUrls.size }))
    .sort((a, b) => a.country.localeCompare(b.country) || (a.region || '').localeCompare(b.region || '') || a.place.localeCompare(b.place));

  const gaps: CoverageGap[] = CORE_COVERAGE_KINDS.map(kind => ({
    kind,
    places: sorted.filter(row => !row.kinds[kind]).map(row => row.place),
  }));

  return {
    asOf: input.asOf || '',
    rows: sorted,
    gaps,
    totals: { places: sorted.length, rules, packs: packs.length },
  };
}

export const RULE_COVERAGE_CSV_HEADERS = [
  'Place', 'Country', 'Region', 'Rules', ...COVERAGE_KINDS.map(kind => COVERAGE_KIND_LABELS[kind]),
  'Packs', 'Distinct sources', 'Earliest validFrom', 'Latest validFrom',
];

/** One CSV row per place, with each kind's rule count (blank where the place has none). */
export function ruleCoverageCsvRows(coverage: RuleCoverage): Array<Array<string | number>> {
  return coverage.rows.map(row => [
    row.place, row.country, row.region || '', row.rules,
    ...COVERAGE_KINDS.map(kind => row.kinds[kind] || ''),
    row.packs.join(' '), row.sources, row.earliestValidFrom, row.latestValidFrom,
  ]);
}
