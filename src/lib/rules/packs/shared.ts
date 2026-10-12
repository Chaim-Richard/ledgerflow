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

export type TaxEffect = RateEffect | NexusEffect;

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
