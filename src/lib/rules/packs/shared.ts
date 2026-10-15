/**
 * A-38 / PLAN §10: shared shapes for the tax rule packs. A pack turns a dated rate table into
 * `Rule` rows the rule graph reads, so a country's table is content and `evaluateRules` is the only
 * place that decides. Nothing here posts: the packs are data with sources and a status.
 */
import type { Condition, Rule, RuleScope } from '../rules';
import type { FactAttribute } from '../facts';

/** The effect of a rate rule: one component the line's tax is built from. */
export interface RateEffect {
  kind: 'rate';
  /** country, state, county, city or district — the same levels `resolveLineTax` uses */
  level: 'country' | 'state' | 'county' | 'city' | 'district';
  /** the name shown on the line and in a return */
  name: string;
  rate: number;
}

/** The effect of a nexus rule: the point a state may require registration (never a conclusion). */
export interface NexusEffect {
  kind: 'nexus';
  thresholdCents: number | null;
  transactions: number | null;
  test: 'either' | 'both';
}

/** A dated turnover comparison, not a conclusion that an entity must register. */
export type RegistrationThresholdWindow =
  | 'calendar-year-to-date'
  | 'rolling-12-months'
  | 'canada-single-quarter-series'
  | 'canada-previous-four-quarters'
  | 'eu-current-and-previous-calendar-year';

export interface RegistrationThresholdEffect {
  kind: 'registration-threshold';
  scheme: 'il-osek-patur' | 'uk-vat' | 'ca-gst-small-supplier' | 'eu-oss-place-of-supply';
  currency: string;
  thresholdCents: number;
  activityValue: string;
  window: RegistrationThresholdWindow;
  note: string;
  guidanceUrl?: string;
}

/** The effect of a filing rule (PLAN §10, entity-period scope): a return or form the entity files. */
export interface FilingEffect {
  kind: 'filing';
  /** the form's own name, e.g. "Form 1120-S", "דוח שנתי 1214" */
  form: string;
  frequency: 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';
  /** when it is due, in words from the source ("15th day of the 3rd month after year end") */
  due: string;
  /** A-51: which tax the return is for ("GST/HST", "QST", "BC PST"), where the row says so */
  tax?: string;
  /** A-51: the annual-revenue band the authority commonly assigns this frequency to */
  revenueBand?: { minCents: number | null; maxCents: number | null; currency: string };
}

/**
 * A-41: the effect of a channel rule. It answers who taxes the sale, not how much: 'marketplace'
 * means the facilitator is required to collect, so the seller's own rate rules are switched off.
 * It is never a rate of zero written on the line, so a screen can say why the line has no tax.
 */
export interface MarketplaceEffect {
  kind: 'marketplace';
  state: string;
  stateName: string;
  /** the date this row is asserted from (never the law's own effective date) */
  assertedFrom: string;
  note: string;
}

/**
 * A-43: the effect of a withholding-at-source rule — the default percentage the payer holds back on a
 * payment to a vendor who has no current approval. It is a suggested rate with the source it was read
 * from; the vendor's own approval always replaces it, and a person confirms before the payment.
 */
export interface WithholdingDefaultEffect {
  kind: 'withholding-default';
  paymentType: string;
  /** 'israel' for an Israeli resident, 'foreign' for a non-resident */
  residence: 'israel' | 'foreign';
  ratePercent: number;
  /** what the percentage is taken from, where the source settles it */
  base: 'payment-less-vat' | 'payment-including-vat' | 'unspecified';
  note: string;
}

/**
 * A-52: the effect of an EU reverse-charge rule — the buyer accounts for the tax in their own
 * member state, so the supplier's domestic rate rule is switched off. It is never a rate of zero
 * written on the line by the supplier's own choice: the rule says who taxes the supply, and a
 * screen can say why the line carries no supplier VAT. The buyer's valid VAT number must be
 * verified (VIES or the certificate itself) before the rule can apply — a label never proves it.
 */
export interface ReverseChargeEffect {
  kind: 'reverse-charge';
  /** the supplier's member state (ISO alpha-2; EL for Greece) */
  supplierCountry: string;
  supply: 'goods' | 'services';
  /** the directive articles the rule was read from, in words */
  basis: string;
  taxedBy: 'buyer';
  note: string;
}

/**
 * A-53: the effect of a UK Flat Rate Scheme rule — the percentage of VAT-inclusive turnover the
 * scheme user pays HMRC in place of output VAT at the standard rate. The category is the business's
 * own declared one (GOV.UK's table); the first-year discount is a percentage point off, per GOV.UK.
 */
export interface FlatRateSchemeEffect {
  kind: 'flat-rate-scheme';
  /** the slug in ukVatSchemes.ts (`accountancy`, `limited-cost-trader`, …) */
  category: string;
  categoryName: string;
  /** percent of VAT-inclusive turnover (14.5 means 14.5%) */
  percent: number;
  /** percentage points off in the first year of FRS registration */
  firstYearDiscountPoints: number;
  note: string;
}

/**
 * A-54: the effect of a US use-tax rule — where the seller charged none of its state's tax and the
 * purchase is taxable in the buyer's (this workspace's) state, the state's own use tax applies at
 * its sales-tax rate. The effect names the state-level rate only; county, city and district
 * additions follow the state's own use-tax rules and are not concluded here.
 */
export interface UseTaxEffect {
  kind: 'use-tax';
  state: string;
  stateName: string;
  /** the state-level rate in force from validFrom, as a fraction of the purchase */
  rate: number;
  note: string;
}

/**
 * A-53: the effect of a UK VAT scheme threshold — the turnover figure GOV.UK gives for joining or
 * leaving a scheme. Like the registration thresholds it is a dated comparison, never a conclusion
 * that an entity may or must join.
 */
export interface SchemeThresholdEffect {
  kind: 'scheme-threshold';
  scheme: 'uk-flat-rate-entry' | 'uk-flat-rate-exit' | 'uk-cash-accounting' | 'uk-annual-accounting';
  currency: string;
  thresholdCents: number;
  /** what is measured, in words from the source */
  measure: string;
  note: string;
}

/**
 * A-56: the effect of an imported-purchase rule — Israel taxes a purchase from a foreign supplier
 * outside the invoice: services are self-assessed by the Israeli business (Section 20, "מע״מ
 * עסקאות"), and goods' VAT is paid to customs at the import. The effect says which mechanism and
 * the rate in force from validFrom; posting the self-assessment is the accountant's lane (AI #1).
 */
export interface ImportVatEffect {
  kind: 'import-vat';
  supply: 'goods' | 'services';
  /** who collects the tax: the business self-assesses, or customs collects at the border */
  collectedBy: 'self-assessment' | 'customs';
  /** the Israeli VAT rate in force from validFrom, as a fraction */
  rate: number;
  basis: string;
  note: string;
}

/**
 * A-58: the effect of a sales-tax-holiday rule — the dated window in which qualifying items stop
 * being taxed. The rule's `when` cannot see an item's price (prices are not facts), so the
 * per-item test lives in the effect: a line is exempt only inside one band and under (or at) that
 * band's `capCents` (`capInclusive` is the state's own "under $100" vs "$100 or less" wording).
 * `holidayItemAnswer()` in `src/lib/tax/usSalesTaxHolidays.ts` is the reference application of
 * this effect; an engine reading the override must apply it only to a line that passes one band's
 * cap — outside the caps the named rate rules stand, exactly as before the holiday.
 */
export interface SalesTaxHolidayEffect {
  kind: 'sales-tax-holiday';
  /** the row id in `src/lib/tax/usSalesTaxHolidays.ts` (state + holiday + year) */
  holiday: string;
  /** the bands a line may qualify under; one line uses at most one band */
  bands: Array<{
    id: string;
    label: string;
    /** the most an item's sales price may be and still be exempt, in cents */
    capCents: number;
    capInclusive: boolean;
  }>;
  note: string;
}

export type TaxEffect = RateEffect | NexusEffect | RegistrationThresholdEffect | FilingEffect | MarketplaceEffect | WithholdingDefaultEffect | ReverseChargeEffect | FlatRateSchemeEffect | UseTaxEffect | SchemeThresholdEffect | ImportVatEffect | SalesTaxHolidayEffect;

/** A table row a pack could not turn into a rule (a category it cannot name, a place it does not know). */
export interface UnmappedRow {
  /** what the row was about: a row id, a country and a label */
  row: string;
  /** why no rule was written */
  reason: string;
}

export interface TaxRulePack {
  id: string;
  name: string;
  /** the rules, in the order they were built */
  rules: Array<Rule<TaxEffect>>;
  /** rows deliberately left out, each with the reason (never silently dropped) */
  unmapped: UnmappedRow[];
}

/** One condition on a fact, for readability at the call sites. */
export const where = (attribute: FactAttribute, values: string[]): Condition => ({ attribute, op: 'in', values });

/** A rate rule whose conditions are the facts that must hold and whose effect is one component. */
export function rateRule<E extends TaxEffect = RateEffect>(input: {
  id: string;
  name: string;
  scope?: RuleScope;
  when: Condition[];
  effect: E;
  validFrom: string;
  validTo?: string;
  source: { authority: string; url: string; retrieved?: string };
  status?: Rule<E>['status'];
  combine?: Rule<E>['combine'];
  targets?: string[];
  requiresVerified?: FactAttribute[];
}): Rule<E> {
  return {
    id: input.id,
    name: input.name,
    scope: input.scope || 'line',
    when: input.when,
    combine: input.combine || 'accumulate',
    ...(input.targets ? { targets: input.targets } : {}),
    ...(input.requiresVerified ? { requiresVerified: input.requiresVerified } : {}),
    effect: input.effect,
    validFrom: input.validFrom,
    ...(input.validTo ? { validTo: input.validTo } : {}),
    source: input.source,
    status: input.status || 'calculation',
  };
}

/** A stable rule id piece: dates and codes only, so `targets` can name rules before they are built. */
export const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
