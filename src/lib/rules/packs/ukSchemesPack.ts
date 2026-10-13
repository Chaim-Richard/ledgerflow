/**
 * A-53: the UK's VAT special schemes (ukVatSchemes.ts) written as rules. The Flat Rate Scheme is
 * one line-scope rule per business category: where the entity's own facts say it is a scheme user
 * of that category, the rule replaces the UK standard-rate rule (A-26's) with the percentage of
 * VAT-inclusive turnover GOV.UK publishes for the category. The scheme thresholds are entity-period
 * comparisons, never a conclusion that an entity may join or must leave. The category is the
 * business's declaration and FRS itself is an HMRC approval; status 'calculation' throughout, and
 * the GOV.UK table governs a category this pack does not list.
 */
import { UK_VAT_RATES } from '../../tax/ukVat';
import { UK_FRS_CATEGORIES, UK_FRS_FIRST_YEAR_DISCOUNT_POINTS, UK_VAT_SCHEME_THRESHOLDS } from '../../tax/ukVatSchemes';
import { rateRule, where, slug, type FlatRateSchemeEffect, type SchemeThresholdEffect, type TaxRulePack } from './shared';

/** The UK standard-rate rule ids an FRS rule replaces (the same id shape ukVatPack builds). */
export const ukStandardRuleIds = (): string[] =>
  UK_VAT_RATES.filter(row => row.kind === 'standard')
    .map(row => `uk-vat-standard-${slug(row.validFrom)}-${slug(String(row.rate))}`);

export function ukSchemesPack(): TaxRulePack {
  const standards = ukStandardRuleIds();
  const categoryRules = UK_FRS_CATEGORIES.map(row => rateRule<FlatRateSchemeEffect>({
    id: `uk-frs-${row.category}`,
    name: `UK Flat Rate Scheme: ${row.categoryName} — ${row.percent}% of VAT-inclusive turnover`,
    scope: 'line',
    when: [where('country', ['GB']), where('schemeCategory', [row.category])],
    combine: 'override',
    targets: standards,
    effect: {
      kind: 'flat-rate-scheme',
      category: row.category,
      categoryName: row.categoryName,
      percent: row.percent,
      firstYearDiscountPoints: UK_FRS_FIRST_YEAR_DISCOUNT_POINTS,
      note: row.note || 'the percentage applies to the VAT-inclusive turnover of the period; the first year of FRS registration takes 1 percentage point off',
    },
    validFrom: row.validFrom,
    ...(row.validTo ? { validTo: row.validTo } : {}),
    source: { authority: 'HM Revenue & Customs', url: row.source, retrieved: row.checked },
  }));
  const thresholdRules = UK_VAT_SCHEME_THRESHOLDS.map(row => rateRule<SchemeThresholdEffect>({
    id: `uk-scheme-${row.id}`,
    name: `UK ${row.name} threshold`,
    scope: 'entity-period',
    when: [where('country', ['GB'])],
    effect: {
      kind: 'scheme-threshold',
      scheme: row.id,
      currency: row.currency,
      thresholdCents: row.thresholdCents,
      measure: row.measure,
      note: row.note || '',
    },
    validFrom: row.validFrom,
    source: { authority: 'HM Revenue & Customs', url: row.source, retrieved: row.checked },
  }));
  return { id: 'uk-vat-schemes', name: 'United Kingdom VAT schemes (flat rate, cash and annual accounting)', rules: [...categoryRules, ...thresholdRules], unmapped: [] };
}
