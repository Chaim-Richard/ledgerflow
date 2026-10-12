/**
 * The filings each entity owes for a year (PLAN §10): for the books and for each entity label value,
 * its facts (composed from every dimension, inherited from parents) are run through the
 * entity-period filing rules on the year's last day. Each answer keeps the evidence trail: what is
 * due and why, what is blocked because a fact is only declared, and what is undecided because facts
 * conflict. Read-only. Pure.
 */
import { composeFacts, type FactSources } from '../rules/facts';
import { evaluateRules, type Rule } from '../rules/rules';
import type { FilingEffect, TaxEffect } from '../rules/packs/shared';
import { filingPack } from '../rules/packs/filingPack';

export interface EntityFilings {
  /** 'books' or the label key ('world:tx') */
  entity: string;
  due: Array<{ ruleId: string; form: string; frequency: FilingEffect['frequency']; due: string; because: string[]; source: string; status: string }>;
  blocked: Array<{ ruleId: string; form: string; unverified: string[] }>;
  undecided: Array<{ ruleId: string; form: string; conflicting: string[] }>;
}

const formOf = (r: Rule<TaxEffect>) => (r.effect.kind === 'filing' ? r.effect.form : r.name);

export function entityFilings(sources: FactSources, entities: string[], year: number, rules: Array<Rule<TaxEffect>> = filingPack().rules): EntityFilings[] {
  const date = `${year}-12-31`;
  const filingRules = rules.filter(r => r.scope === 'entity-period' && r.effect.kind === 'filing');
  return ['books', ...entities].map(entity => {
    const [dimension, node] = entity === 'books' ? ['', ''] : [entity.slice(0, entity.indexOf(':')), entity.slice(entity.indexOf(':') + 1)];
    const facts = composeFacts(sources, dimension ? { [dimension]: node } : {}, dimension ? [dimension] : [], date);
    const o = evaluateRules(filingRules, facts, { date, scope: 'entity-period' });
    return {
      entity,
      due: o.applied.map(({ rule, because }) => {
        const e = rule.effect as FilingEffect;
        return { ruleId: rule.id, form: e.form, frequency: e.frequency, due: e.due, because, source: rule.source.url, status: rule.status };
      }),
      blocked: o.blocked.map(b => ({ ruleId: b.rule.id, form: formOf(b.rule), unverified: b.unverified })),
      undecided: o.undecided.map(u => ({ ruleId: u.rule.id, form: formOf(u.rule), conflicting: u.conflicting })),
    };
  });
}
