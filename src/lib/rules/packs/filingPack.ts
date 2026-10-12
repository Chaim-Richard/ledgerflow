/**
 * Filings as rules (PLAN §10, entity-period scope): which returns an entity files for a year,
 * from its facts. A tax treatment that is an election (S corporation) or a recognised exemption
 * needs a verified fact: a label alone never makes an entity file as one. Status 'calculation'.
 */
import { rateRule, where, type FilingEffect, type TaxRulePack } from './shared';

const IRS = (form: string) => ({ authority: 'Internal Revenue Service', url: `https://www.irs.gov/forms-pubs/about-form-${form}`, retrieved: '2026-10-12' });
const ITA = { authority: 'Israel Tax Authority', url: 'https://www.gov.il/he/departments/israel_tax_authority', retrieved: '2026-10-12' };

export function filingPack(): TaxRulePack {
  const filing = (id: string, name: string, when: ReturnType<typeof where>[], effect: FilingEffect, source: { authority: string; url: string; retrieved: string }, requiresVerified?: Array<'taxTreatment' | 'exemptStatus'>) =>
    rateRule<FilingEffect>({ id, name, scope: 'entity-period', when, effect, validFrom: '2000-01-01', source, ...(requiresVerified ? { requiresVerified } : {}) });
  return {
    id: 'filings',
    name: 'Yearly and periodic filings by entity',
    rules: [
      filing('us-1120', 'US corporation income tax return', [where('country', ['US']), where('taxTreatment', ['c_corporation'])],
        { kind: 'filing', form: 'Form 1120', frequency: 'yearly', due: '15th day of the 4th month after the tax year ends' }, IRS('1120')),
      filing('us-1120s', 'S corporation income tax return', [where('country', ['US']), where('taxTreatment', ['s_corporation'])],
        { kind: 'filing', form: 'Form 1120-S', frequency: 'yearly', due: '15th day of the 3rd month after the tax year ends' }, IRS('1120-s'), ['taxTreatment']),
      filing('us-1065', 'Partnership return', [where('country', ['US']), where('taxTreatment', ['partnership'])],
        { kind: 'filing', form: 'Form 1065', frequency: 'yearly', due: '15th day of the 3rd month after the tax year ends' }, IRS('1065')),
      filing('us-990', 'Exempt organization return', [where('country', ['US']), where('exemptStatus', ['recognized_exempt'])],
        { kind: 'filing', form: 'Form 990 (or 990-EZ / 990-N by size)', frequency: 'yearly', due: '15th day of the 5th month after the tax year ends' }, IRS('990'), ['exemptStatus']),
      filing('il-1214', 'Israeli company annual return', [where('country', ['IL']), where('taxTreatment', ['il_company'])],
        { kind: 'filing', form: 'דוח שנתי 1214', frequency: 'yearly', due: 'by 31 May after the tax year (extensions are common)' }, ITA),
      filing('il-vat-report', 'Israeli periodic VAT report', [where('country', ['IL']), where('taxTreatment', ['il_company', 'il_osek_murshe'])],
        { kind: 'filing', form: 'דוח תקופתי למע"מ', frequency: 'bimonthly', due: 'by the 15th of the month after the period (monthly or bimonthly by turnover)' }, ITA),
      filing('il-patur-declaration', 'Osek patur yearly turnover declaration', [where('country', ['IL']), where('taxTreatment', ['il_osek_patur'])],
        { kind: 'filing', form: 'הצהרת עוסק פטור', frequency: 'yearly', due: 'by 31 January after the year' }, ITA),
    ],
    unmapped: [],
  };
}
