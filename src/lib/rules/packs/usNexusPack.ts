/**
 * A-38: the US economic-nexus thresholds (A-27) written as `entity-period` rules: a state's test,
 * its threshold and its dates. A rule firing means "this state's test exists and these are its
 * numbers" — the watch that compares a seller's year to it is `nexusWatch` in A-27's module, and no
 * rule here says a seller must register.
 */
import { US_NEXUS_THRESHOLDS } from '../../tax/usNexus';
import { rateRule, where, slug, type TaxEffect, type TaxRulePack, type NexusEffect } from './shared';
import type { Rule } from '../rules';

export function usNexusPack(): TaxRulePack {
  const rules: Array<Rule<TaxEffect>> = US_NEXUS_THRESHOLDS.map(row => {
    const effect: NexusEffect = { kind: 'nexus', thresholdCents: row.salesThresholdCents, transactions: row.transactions, test: row.test };
    return rateRule({
      id: `us-nexus-${slug(row.state)}-${slug(row.validFrom)}`,
      name: `${row.stateName} economic nexus (${row.salesThresholdCents === null ? 'no sales-tax test' : `$${Math.round(row.salesThresholdCents / 100).toLocaleString('en-US')}`}${row.transactions ? ` or ${row.transactions} transactions` : ''}${row.test === 'both' ? ', both required' : ''})`,
      scope: 'entity-period',
      when: [where('country', ['US']), where('state', [row.state])],
      effect,
      validFrom: row.validFrom,
      ...(row.validTo ? { validTo: row.validTo } : {}),
      source: { authority: `${row.stateName} Department of Revenue`, url: row.source, retrieved: row.checked },
    });
  });
  return { id: 'us-nexus', name: 'US state economic-nexus thresholds', rules, unmapped: [] };
}
