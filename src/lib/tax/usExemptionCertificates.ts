/**
 * A-55 (PLAN): US sales-tax exemption certificate **types** and the two multistate forms — dated
 * rows with official sources — plus the type vocabulary the customer certificate (T-05) carries.
 *
 * What this is: the kinds of exemption a certificate can claim (resale, manufacturing, nonprofit,
 * government, agricultural, educational), the Streamlined Sales Tax multistate exemption certificate
 * and which states are its full member states, and the MTC's Uniform Sales & Use Tax Resale
 * Certificate with the pointer to the MTC's own accepting-states list.
 * What it is not: a per-state acceptance table for every type. Each state issues its own forms,
 * names its own types and accepts other states' and multistate forms on its own terms; where this
 * file does not state an answer, the state's own instructions govern and `certificateAcceptance`
 * says so instead of guessing. Nothing here exempts a document: the invoice's tax code decides, as
 * always (T-05).
 */

export type UsExemptionCertificateType =
  | 'resale'
  | 'manufacturing'
  | 'nonprofit'
  | 'government'
  | 'agricultural'
  | 'educational'
  | 'sst-multistate'
  | 'mtc-uniform-resale';

export interface ExemptionCertificateTypeRow {
  id: UsExemptionCertificateType;
  name: string;
  /** what the certificate claims, in plain words */
  whatItClaims: string;
  /** who issues or publishes the form */
  issuer: string;
  validFrom: string;
  source: { authority: string; url: string; retrieved: string };
  note?: string;
}

const CHECKED = '2026-10-13';
const SST = { authority: 'Streamlined Sales Tax Governing Board', url: 'https://www.streamlinedsalestax.org/', retrieved: CHECKED };
const MTC = { authority: 'Multistate Tax Commission', url: 'https://www.mtc.gov/resources/uniform-sales-use-tax-resale-certificate/', retrieved: CHECKED };

export const US_EXEMPTION_CERTIFICATE_TYPES: ExemptionCertificateTypeRow[] = [
  {
    id: 'resale', name: 'Resale', validFrom: '2000-01-01', issuer: 'each state\'s own revenue department',
    whatItClaims: 'the buyer holds the goods for resale, so the sale is not a retail sale; every sales-tax state has its own resale certificate and form',
    source: MTC,
    note: 'the form and its wording are the state\'s own; the MTC uniform certificate (below) is accepted for resale in many states on their own terms',
  },
  {
    id: 'manufacturing', name: 'Manufacturing / raw materials', validFrom: '2000-01-01', issuer: 'each state\'s own revenue department',
    whatItClaims: 'the goods become an ingredient or component of a manufactured product, or are machinery used directly in manufacturing, which the state exempts on its own terms',
    source: MTC,
    note: 'which purchases qualify, and the certificate that proves it, are the state\'s own rules',
  },
  {
    id: 'nonprofit', name: 'Nonprofit / charitable organisation', validFrom: '2000-01-01', issuer: 'each state\'s own revenue department',
    whatItClaims: 'the buyer is an exempt organisation; most states require their own exemption certificate or letter, and recognition of the organisation, before purchases are exempt',
    source: MTC,
    note: 'a federal determination letter alone does not exempt a state sale; the state\'s own certificate governs',
  },
  {
    id: 'government', name: 'Government body', validFrom: '2000-01-01', issuer: 'each state\'s own revenue department',
    whatItClaims: 'the buyer is a federal, state or local government entity, whose purchases many (not all) states exempt on their own forms',
    source: MTC,
  },
  {
    id: 'agricultural', name: 'Agricultural / farming', validFrom: '2000-01-01', issuer: 'each state\'s own revenue department',
    whatItClaims: 'the goods are used in agricultural production, which many states exempt on their own certificate',
    source: MTC,
  },
  {
    id: 'educational', name: 'Educational institution', validFrom: '2000-01-01', issuer: 'each state\'s own revenue department',
    whatItClaims: 'the buyer is a school or educational institution whose purchases the state exempts on its own terms',
    source: MTC,
  },
  {
    id: 'sst-multistate', name: 'SST multistate exemption certificate', validFrom: '2010-01-01', issuer: 'Streamlined Sales Tax Governing Board',
    whatItClaims: 'one form a buyer registered under the Streamlined Sales Tax agreement uses to claim exemption in every full member state',
    source: SST,
    note: 'for buyers registered through SST (SSTRS); membership changes — the governing board\'s list governs',
  },
  {
    id: 'mtc-uniform-resale', name: 'MTC Uniform Sales & Use Tax Resale Certificate', validFrom: '2000-01-01', issuer: 'Multistate Tax Commission',
    whatItClaims: 'one resale form many states accept from an out-of-state buyer; each accepting state is listed in the MTC\'s own instructions for the form',
    source: MTC,
    note: 'the accepting-states list is maintained by the MTC and changes; this file does not restate it',
  },
];

/**
 * The full member states of the Streamlined Sales Tax agreement, whose sellers accept the SST
 * multistate exemption certificate. Membership changes; the governing board's own list governs and
 * this row set is asserted from 2010-01-01 with the check date on it.
 */
export const SST_MEMBER_STATES: string[] = [
  'AR', 'IN', 'IA', 'KS', 'KY', 'LA', 'MI', 'MN', 'MS', 'NE', 'NV', 'NJ',
  'NC', 'ND', 'OH', 'OK', 'RI', 'SD', 'TN', 'VT', 'WA', 'WV', 'WI', 'WY',
];

export const SST_MEMBER_ROW = { validFrom: '2010-01-01', ...SST };

export type CertificateAcceptance = 'sst-member' | 'see-mtc-list' | 'own-form-only';

/**
 * What this file can honestly say about one state: SST full members accept the SST multistate
 * certificate; every other sales-tax state gets the MTC pointer (its own instructions list what it
 * accepts); the five no-sales-tax states have no state exemption certificate of their own here.
 */
export function certificateAcceptance(state: string): CertificateAcceptance {
  const code = (state || '').toUpperCase();
  if (SST_MEMBER_STATES.includes(code)) return 'sst-member';
  if (['AK', 'DE', 'MT', 'NH', 'OR'].includes(code)) return 'own-form-only';
  return 'see-mtc-list';
}

export const CERTIFICATE_TYPE_IDS: UsExemptionCertificateType[] = US_EXEMPTION_CERTIFICATE_TYPES.map(row => row.id);

/** The row for a type id. */
export function exemptionCertificateType(id: string | null | undefined): ExemptionCertificateTypeRow | undefined {
  if (!id) return undefined;
  return US_EXEMPTION_CERTIFICATE_TYPES.find(row => row.id === id.toLowerCase());
}

/** The plain name of a recorded type; the raw string when it is not in the vocabulary. */
export function certificateTypeName(id: string | null | undefined): string {
  return exemptionCertificateType(id)?.name || (id || '').trim();
}

/** Structural problems in the table (a bug in this file, not a tax opinion). */
export function exemptionCertificateProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of US_EXEMPTION_CERTIFICATE_TYPES) {
    if (seen.has(row.id)) problems.push(`${row.id}: duplicate type`);
    seen.add(row.id);
    if (!row.name || !row.whatItClaims) problems.push(`${row.id}: the row needs a name and what it claims`);
    if (!/^https:\/\//.test(row.source.url)) problems.push(`${row.id}: the source must be an https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.validFrom)) problems.push(`${row.id}: validFrom is not a date`);
  }
  if (new Set(SST_MEMBER_STATES).size !== SST_MEMBER_STATES.length) problems.push('SST member states contain a duplicate');
  for (const noTax of ['AK', 'DE', 'MT', 'NH', 'OR']) {
    if (SST_MEMBER_STATES.includes(noTax)) problems.push(`${noTax} has no sales tax but is listed as an SST member`);
  }
  return problems;
}
